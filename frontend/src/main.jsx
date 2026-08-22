import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const lengths = [
  { id: "short", label: "Short", detail: "80–120 words" },
  { id: "medium", label: "Medium", detail: "180–250 words" },
  { id: "long", label: "Long", detail: "350–500 words" },
];

function App() {
  const [file, setFile] = useState(null);
  const [length, setLength] = useState("medium");
  const [result, setResult] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const chooseFile = (selected) => {
    const f = selected?.[0];
    if (!f) return;
    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(f.type)) {
      setError("Please upload a PDF, PNG, JPG/JPEG, or WEBP file.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("File size must be 10 MB or less.");
      return;
    }
    setFile(f);
    setResult(null);
    setError("");
  };

  const analyze = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);

    const form = new FormData();
    form.append("file", file);
    form.append("length", length);

    try {
      const response = await fetch(`${API_URL}/api/analyze`, {
        method: "POST",
        body: form,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Something went wrong.");
      setResult(data);
    } catch (err) {
      setError(err.message || "Unable to analyze this document.");
    } finally {
      setLoading(false);
    }
  };

  const copySummary = async () => {
    if (!result?.summary) return;
    await navigator.clipboard.writeText(result.summary);
  };

  const downloadSummary = () => {
    if (!result) return;
    const content = [
      `DocuBrief — ${result.filename}`,
      "",
      "SUMMARY",
      result.summary,
      "",
      "KEY POINTS",
      ...result.key_points.map((x) => `• ${x}`),
      "",
      "MAIN IDEAS",
      ...result.main_ideas.map((x) => `• ${x}`),
      "",
      "IMPROVEMENT SUGGESTIONS",
      ...result.suggestions.map((x) => `• ${x}`),
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.filename.replace(/\.[^/.]+$/, "")}-summary.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    chooseFile(e.dataTransfer.files);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">D</div>
          <div>
            <div className="brand-name">DocuBrief</div>
            <div className="brand-sub">Document Summary Assistant</div>
          </div>
        </div>
        <div className="status-pill"><span /> AI summarization ready</div>
      </header>

      <main className="container">
        <section className="hero">
          <div>
            <div className="eyebrow">READ LESS. UNDERSTAND MORE.</div>
            <h1>Turn documents into<br /><span>clear decisions.</span></h1>
            <p>
              Upload a PDF or scanned image and get an AI-generated summary,
              key points, main ideas, and practical improvement suggestions.
            </p>
          </div>
        </section>

        <section className="workspace">
          <div className="card upload-card">
            <div className="section-title">
              <div>
                <h2>1. Upload document</h2>
                <p>PDF or image · Maximum 10 MB</p>
              </div>
              <span className="step">01</span>
            </div>

            <div
              className={`dropzone ${dragging ? "dragging" : ""} ${file ? "has-file" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <input
                id="fileInput"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => chooseFile(e.target.files)}
              />
              <label htmlFor="fileInput">
                <div className="upload-icon">{file ? "✓" : "↑"}</div>
                {file ? (
                  <>
                    <strong>{file.name}</strong>
                    <span>{(file.size / 1024 / 1024).toFixed(2)} MB · Ready to analyze</span>
                  </>
                ) : (
                  <>
                    <strong>Drop your document here</strong>
                    <span>or click to browse from your device</span>
                  </>
                )}
              </label>
            </div>

            <div className="length-section">
              <div className="section-title compact">
                <div>
                  <h2>2. Choose summary length</h2>
                  <p>Control the level of detail</p>
                </div>
              </div>
              <div className="length-grid">
                {lengths.map((item) => (
                  <button
                    key={item.id}
                    className={`length-btn ${length === item.id ? "selected" : ""}`}
                    onClick={() => setLength(item.id)}
                  >
                    <span>{item.label}</span>
                    <small>{item.detail}</small>
                  </button>
                ))}
              </div>
            </div>

            <button className="analyze-btn" disabled={!file || loading} onClick={analyze}>
              {loading ? <><span className="spinner" /> Analyzing document…</> : <>Generate smart summary <span>→</span></>}
            </button>

            {error && <div className="error-box">⚠ {error}</div>}
          </div>

          <div className="card results-card">
            <div className="section-title">
              <div>
                <h2>3. Your insights</h2>
                <p>{result ? "Analysis complete" : "Your results will appear here"}</p>
              </div>
              <span className="step">02</span>
            </div>

            {!result && !loading && (
              <div className="empty-state">
                <div className="empty-orb">✦</div>
                <h3>Ready when you are</h3>
                <p>Upload a document, choose a length, and let DocuBrief do the reading.</p>
              </div>
            )}

            {loading && (
              <div className="empty-state">
                <div className="loading-ring" />
                <h3>Reading your document…</h3>
                <p>Extracting text and generating a structured summary.</p>
              </div>
            )}

            {result && !loading && (
              <div className="results">
                <div className="file-meta">
                  <div className="file-type">{result.file_type === "application/pdf" ? "PDF" : "IMG"}</div>
                  <div>
                    <strong>{result.filename}</strong>
                    <span>
                      {result.pages} page{result.pages !== 1 ? "s" : ""} · {result.word_count.toLocaleString()} words
                      {result.ocr_used ? " · OCR used" : " · Text extracted"}
                    </span>
                  </div>
                  <button className="icon-btn" onClick={downloadSummary} title="Download summary">↓</button>
                </div>

                <div className="summary-panel">
                  <div className="panel-head">
                    <h3>Summary</h3>
                    <button onClick={copySummary}>Copy</button>
                  </div>
                  <p className="summary-text">{result.summary}</p>
                </div>

                <div className="insight-grid">
                  <Insight title="Key points" items={result.key_points} />
                  <Insight title="Main ideas" items={result.main_ideas} />
                </div>

                <div className="suggestion-panel">
                  <div className="panel-head"><h3>Improvement suggestions</h3></div>
                  <ul>
                    {result.suggestions.map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                </div>

                <details className="extracted">
                  <summary>View extracted text</summary>
                  <pre>{result.extracted_text}</pre>
                </details>
              </div>
            )}
          </div>
        </section>

        <section className="feature-strip">
          <div><b>PDF parsing</b><span>Layout-aware text extraction</span></div>
          <div><b>OCR</b><span>Scanned document support</span></div>
          <div><b>AI insights</b><span>Summary + key ideas</span></div>
          <div><b>Responsive</b><span>Works across screen sizes</span></div>
        </section>

        <footer>
          <span>DocuBrief · Technical Assessment Project</span>
          <span>Built with React + FastAPI + Gemini</span>
        </footer>
      </main>
    </div>
  );
}

function Insight({ title, items }) {
  return (
    <div className="insight-panel">
      <h3>{title}</h3>
      <ul>
        {items.map((item, i) => <li key={i}><span>•</span>{item}</li>)}
      </ul>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
