# DocuBrief — Document Summary Assistant

A production-minded technical assessment project that accepts PDFs and scanned images, extracts readable text with PDF parsing/OCR, and generates structured AI summaries.

## Features

- PDF and image upload
- Drag-and-drop + file picker
- PDF text extraction with PyMuPDF
- OCR for images and scanned PDF pages with Tesseract
- Short / Medium / Long summary modes
- Summary, key points, main ideas, improvement suggestions
- Loading states and basic error handling
- Extracted text preview
- Download summary as `.txt`
- Responsive UI
- FastAPI backend + React/Vite frontend
- Gemini API integration
- Dockerized backend for reliable OCR deployment

## Architecture

React/Vite → FastAPI `/api/analyze` → document extraction → OCR fallback → Gemini → structured JSON response → React results UI

## Run locally

### 1. Backend

Install Tesseract OCR on Windows and make sure `tesseract.exe` is on PATH.

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Create `.env` from `.env.example` and set your Gemini API key.

Run:

```bash
uvicorn main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal.

## Deployment

Deploy the backend as a Docker Web Service on Render. Set:

- `GEMINI_API_KEY`
- `GEMINI_MODEL=gemini-3.5-flash-lite`
- `FRONTEND_URL=https://YOUR-FRONTEND.vercel.app`

Build command is not needed for Docker. The Dockerfile installs Tesseract.

Deploy the frontend as a Vercel project with:

- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_API_URL=https://YOUR-BACKEND.onrender.com`

## Assessment approach

The implementation deliberately separates extraction from generation. This makes the pipeline explainable and testable:

1. Validate file type and size.
2. Extract native PDF text where possible.
3. Fall back to OCR for scanned pages.
4. OCR image uploads directly.
5. Send cleaned source text to Gemini with a controlled summary prompt.
6. Render the summary and supporting insights in the UI.

No API key is exposed in the browser.

## Limitations / future improvements

- Add authentication and persistent document history.
- Add page-level citations linking insights back to source pages.
- Add streaming responses for very large documents.
- Add more OCR languages.
- Add automated unit/integration tests and CI.
