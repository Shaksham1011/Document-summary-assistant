import os
import re
import io

import json
import tempfile
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

import fitz  # PyMuPDF
import pytesseract
from PIL import Image
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai

MAX_FILE_SIZE = 10 * 1024 * 1024
ALLOWED_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
}
MODEL = os.getenv("GEMINI_MODEL", "gemini-3.7-flash")

app = FastAPI(
    title="Document Summary Assistant API",
    version="1.0.0",
    description="Extracts text from PDFs/images and generates AI summaries."
)

frontend_url = os.getenv("FRONTEND_URL", "*")
origins = ["*"] if frontend_url == "*" else [frontend_url]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

def clean_text(text: str) -> str:
    text = text.replace("\x00", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

def ocr_image(image_bytes: bytes) -> str:
    try:
        image = Image.open(io.BytesIO(image_bytes))
        return clean_text(pytesseract.image_to_string(image))
    except Exception as exc:
        raise RuntimeError(f"OCR failed: {exc}") from exc

def extract_pdf(pdf_bytes: bytes) -> tuple[str, int, bool]:
    text_parts = []
    ocr_used = False

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid or corrupted PDF.") from exc

    page_count = len(doc)
    for page in doc:
        text = clean_text(page.get_text("text"))
        # Scanned/near-empty page -> render and OCR it.
        if len(text) < 40:
            ocr_used = True
            pix = page.get_pixmap(matrix=fitz.Matrix(1.8, 1.8), alpha=False)
            page_img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            text = clean_text(pytesseract.image_to_string(page_img))
        if text:
            text_parts.append(text)

    doc.close()
    return "\n\n".join(text_parts), page_count, ocr_used

def extract_document(file_bytes: bytes, content_type: str, filename: str):
    suffix = Path(filename).suffix.lower()
    if content_type == "application/pdf" or suffix == ".pdf":
        return extract_pdf(file_bytes)

    if content_type in {"image/png", "image/jpeg", "image/jpg", "image/webp"}:
        return ocr_image(file_bytes), 1, True

    raise HTTPException(
        status_code=415,
        detail="Unsupported file type. Upload PDF, PNG, JPG, or WEBP."
    )

def make_prompt(text: str, length: str) -> str:
    length_rules = {
        "short": "80-120 words",
        "medium": "180-250 words",
        "long": "350-500 words",
    }

    target = length_rules.get(length, "180-250 words")

    return f"""
You are DocuBrief, an expert document summarization assistant.

Analyze ONLY the document provided below.

Generate a {length} summary of approximately {target}.

IMPORTANT:
- Do not invent information.
- Do not make assumptions that are not supported by the document.
- Preserve important names, dates, numbers, qualifications, technologies,
  requirements, and conclusions.
- Keep the information faithful to the source.
- Avoid repeating the same information.

Your response MUST follow this EXACT structure.

SUMMARY:
Write the main summary here.

KEY POINTS:
- Key point 1
- Key point 2
- Key point 3
- Key point 4
- Key point 5

MAIN IDEAS:
- Main idea 1
- Main idea 2
- Main idea 3

IMPROVEMENT SUGGESTIONS:
- Specific suggestion based on the document
- Another useful suggestion
- Another useful suggestion

IMPORTANT:
You MUST provide all four sections:
SUMMARY
KEY POINTS
MAIN IDEAS
IMPROVEMENT SUGGESTIONS

Do not omit any section, even if the document is short.

DOCUMENT:
{text}
""".strip()

def parse_ai_response(raw: str):
    sections = {
        "summary": "",
        "key_points": [],
        "main_ideas": [],
        "suggestions": [],
    }

    current = None

    for line in raw.splitlines():
        # Remove markdown formatting and whitespace
        stripped = re.sub(r"[*_#`]", "", line).strip()

        if not stripped:
            continue

        normalized = stripped.upper().rstrip(":").strip()

        # Detect section headings even if Gemini changes formatting slightly
        if normalized in {"SUMMARY", "EXECUTIVE SUMMARY"}:
            current = "summary"
            continue

        if normalized in {
            "KEY POINTS",
            "KEY POINTS AND FINDINGS",
            "KEY FINDINGS",
            "IMPORTANT POINTS",
        }:
            current = "key_points"
            continue

        if normalized in {
            "MAIN IDEAS",
            "MAIN IDEA",
            "CORE IDEAS",
            "MAIN THEMES",
        }:
            current = "main_ideas"
            continue

        if normalized in {
            "IMPROVEMENT SUGGESTIONS",
            "SUGGESTIONS",
            "IMPROVEMENTS",
            "RECOMMENDATIONS",
        }:
            current = "suggestions"
            continue

        if current == "summary":
            sections["summary"] += (
                (" " if sections["summary"] else "") + stripped
            )

        elif current in {"key_points", "main_ideas", "suggestions"}:
            item = re.sub(r"^[-*•·]\s*", "", stripped).strip()

            # Also handle numbered lists such as:
            # 1. Something
            # 2. Something
            item = re.sub(r"^\d+[.)]\s*", "", item).strip()

            if item:
                sections[current].append(item)

    # Safety fallback
    if not sections["summary"]:
        sections["summary"] = raw.strip()

    return sections

def generate_summary(text: str, length: str):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY is not configured on the server."
        )

    # Keep requests bounded while still supporting reasonably long documents.
    text = text[:180000]

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
    model=MODEL,
    contents=make_prompt(text, length),
    config={
        "max_output_tokens": 1800,
    },
)
        raw = response.text or ""
        return parse_ai_response(raw)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"AI summarization failed: {exc}"
        ) from exc

@app.get("/")
def root():
    return {"message": "Document Summary Assistant API", "status": "ok"}

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.post("/api/analyze")
async def analyze(
    file: UploadFile = File(...),
    length: str = Form("medium"),
):
    if length not in {"short", "medium", "long"}:
        raise HTTPException(status_code=400, detail="Length must be short, medium, or long.")

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Only PDF, PNG, JPG/JPEG, and WEBP files are supported."
        )

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File size must be 10 MB or less.")

    text, pages, ocr_used = extract_document(data, file.content_type, file.filename or "document")

    if len(text.strip()) < 30:
        raise HTTPException(
            status_code=422,
            detail="Could not extract enough readable text. Try a clearer scan."
        )

    result = generate_summary(text, length)

    return {
        "filename": file.filename,
        "file_type": file.content_type,
        "pages": pages,
        "ocr_used": ocr_used,
        "characters_extracted": len(text),
        "word_count": len(text.split()),
        "extracted_text": text[:50000],
        **result,
    }
