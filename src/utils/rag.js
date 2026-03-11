// ============================================================
//  RiskShield — In-Memory TF-IDF RAG Engine
//  Zero cost, zero backend. Runs entirely in the browser.
// ============================================================

import { RAG } from "../config.js";

/** Tokenize text into lowercase words (min 3 chars) */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/**
 * Split a long text into overlapping word chunks.
 * @param {string} text
 * @param {number} size    - words per chunk
 * @param {number} overlap - word overlap between chunks
 */
export function chunkText(text, size = RAG.chunkSize, overlap = RAG.chunkOverlap) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += size - overlap) {
    const chunk = words.slice(i, i + size).join(" ");
    if (chunk.length > 40) chunks.push(chunk);
  }
  return chunks;
}

/**
 * Build a TF-IDF index from an array of text chunks.
 * @param {string[]} chunks
 * @returns {{ chunks, df, N }}
 */
export function buildIndex(chunks) {
  const df = {};
  chunks.forEach((chunk) => {
    const uniqueTerms = [...new Set(tokenize(chunk))];
    uniqueTerms.forEach((term) => {
      df[term] = (df[term] || 0) + 1;
    });
  });
  return { chunks, df, N: chunks.length };
}

/**
 * Retrieve the top-K most relevant chunks for a query.
 * @param {{ chunks, df, N }} index
 * @param {string} query
 * @param {number} k
 * @returns {string} - joined relevant chunks
 */
export function retrieve(index, query, k = RAG.topK) {
  if (!index || !index.chunks?.length) return "";

  const queryTerms = tokenize(query);

  const scored = index.chunks.map((chunk) => {
    const termFreq = {};
    const tokens   = tokenize(chunk);
    tokens.forEach((t) => { termFreq[t] = (termFreq[t] || 0) + 1; });

    let score = 0;
    queryTerms.forEach((qt) => {
      if (termFreq[qt]) {
        const tf    = termFreq[qt] / tokens.length;
        const idf   = Math.log((index.N + 1) / ((index.df[qt] || 0) + 1));
        score += tf * idf;
      }
    });

    return { chunk, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((s) => s.chunk)
    .join("\n\n---\n\n");
}
