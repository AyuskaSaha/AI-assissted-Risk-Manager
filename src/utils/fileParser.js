// ============================================================
//  RiskShield — File Parser Utility
//  Reads .txt, .md, .pdf, .docx files into plain text.
//  PDF: best-effort binary extraction (no backend needed).
// ============================================================

/**
 * Convert an uploaded File object to a plain-text string.
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function fileToText(file) {
  const ext = file.name.split(".").pop().toLowerCase();

  if (ext === "pdf") return extractPDF(file);
  return readAsText(file);
}

/** Read a text-based file (txt, md, docx raw xml, etc.) */
function readAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = (e) => resolve(e.target.result ?? "");
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

/**
 * Best-effort PDF text extraction without a backend.
 * Reads the raw binary and picks out printable ASCII characters.
 * Works for most text-based PDFs; fails on fully image-based PDFs.
 */
function extractPDF(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload  = (e) => {
      try {
        const bytes = new Uint8Array(e.target.result);
        let raw = "";

        for (let i = 0; i < bytes.length; i++) {
          const c = bytes[i];
          // Keep printable ASCII + newlines
          if ((c >= 32 && c < 127) || c === 10 || c === 13) {
            raw += String.fromCharCode(c);
          }
        }

        // Clean up noise
        const cleaned = raw
          .replace(/[^\x20-\x7E\n]/g, " ")
          .replace(/\s{3,}/g, " ")
          .trim();

        if (cleaned.length < 200) {
          resolve(`[PDF extraction limited — only ${cleaned.length} chars recovered]\n${cleaned}`);
        } else {
          resolve(cleaned);
        }
      } catch (err) {
        reject(new Error(`PDF parse error: ${err.message}`));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}
