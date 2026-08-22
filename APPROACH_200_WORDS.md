# Approach — 200 words max

DocuBrief is a document intelligence pipeline designed to convert PDFs and scanned images into concise, actionable insights. The frontend is implemented with React and Vite, while FastAPI provides a small REST API responsible for validation, extraction, OCR, and AI generation.

For native PDFs, PyMuPDF extracts text while preserving the document's natural reading order as much as possible. When a PDF page contains little or no extractable text, the backend renders that page and sends it through Tesseract OCR. Image uploads are processed directly with OCR. This dual-path extraction strategy allows the application to handle both digital and scanned documents.

The cleaned text is passed to Gemini through a controlled prompt. Users can select short, medium, or long summaries. The response is organized into a summary, key points, main ideas, and improvement suggestions. The UI also exposes extraction statistics and the extracted text for transparency.

The application includes file validation, size limits, loading states, actionable errors, responsive design, and a download option. The API key remains server-side. The backend is Dockerized so the Tesseract dependency is reproducible during deployment, while the React frontend can be hosted independently.
