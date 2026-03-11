// ============================================================
//  RiskShield — Upload View
//  Landing screen: API key entry + document upload + run button
// ============================================================

import { useState } from "react";
import { T }        from "../styles/tokens.js";
import { APP }      from "../config.js";

function FileZone({ label, hint, file, setFile, color }) {
  return (
    <label
      style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", padding: "32px 20px", gap: 12,
        border: `2px dashed ${file ? color : T.border}`, borderRadius: 10,
        background: file ? `${color}08` : T.surface,
        cursor: "pointer", transition: "all 0.2s",
      }}
      onMouseEnter={(e) => { if (!file) e.currentTarget.style.borderColor = color; }}
      onMouseLeave={(e) => { if (!file) e.currentTarget.style.borderColor = T.border; }}
    >
      <div style={{ fontSize: 32, opacity: 0.6 }}>{file ? "✓" : "⬆"}</div>
      <div style={{ fontWeight: 800, fontSize: 14, color: file ? color : T.textMid, fontFamily: T.font }}>
        {file ? file.name : label}
      </div>
      <div style={{ fontSize: 11, color: T.textDim, fontFamily: T.mono }}>
        {file ? "click to replace" : hint}
      </div>
      <input
        type="file"
        accept=".pdf,.txt,.docx,.md"
        onChange={(e) => setFile(e.target.files[0])}
        style={{ display: "none" }}
      />
    </label>
  );
}

export default function UploadView({ onStart, defaultApiKey = "" }) {
  const [apiKey,     setApiKey]     = useState(defaultApiKey);
  const [srsFile,    setSrsFile]    = useState(null);
  const [brdFile,    setBrdFile]    = useState(null);
  const [policyFile, setPolicyFile] = useState(null);

  const canRun = apiKey.trim().length > 10 && (srsFile || brdFile);

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "60px 24px" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "5px 16px",
          background: `${T.cyan}10`, border: `1px solid ${T.cyan}33`,
          borderRadius: 20, fontSize: 11, color: T.cyan,
          fontFamily: T.mono, letterSpacing: "0.08em", marginBottom: 20,
        }}>
          ◈ GEMINI 2.5 FLASH · FREE · MULTI-AGENT RAG
        </div>

        <h1 style={{
          fontSize: 46, fontWeight: 900, color: T.text,
          margin: 0, fontFamily: T.font,
          letterSpacing: "-0.02em", lineHeight: 1.1,
        }}>
          Risk<span style={{ color: T.cyan }}>Shield</span>
        </h1>

        <p style={{ color: T.textMid, marginTop: 12, fontSize: 15, lineHeight: 1.6 }}>
          AI-powered risk analysis for SRS &amp; BRD documents.<br />
          8 parallel agents · Full visualization dashboard · Copilot included.
        </p>
      </div>

      {/* API Key */}
      <div style={{ marginBottom: 24 }}>
        <label style={{
          fontSize: 11, color: T.textMid, fontFamily: T.mono,
          letterSpacing: "0.06em", display: "block", marginBottom: 8,
        }}>
          GEMINI API KEY{" "}
          <a
            href="https://aistudio.google.com"
            target="_blank"
            rel="noreferrer"
            style={{ color: T.cyan, textDecoration: "none" }}
          >
            (free at aistudio.google.com)
          </a>
        </label>
        <input
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          type="password"
          placeholder="AIza…"
          style={{
            width: "100%", padding: "12px 14px",
            background: T.surface,
            border: `1px solid ${apiKey ? T.cyan : T.border}`,
            borderRadius: 6, color: T.text, fontSize: 14,
            outline: "none", fontFamily: T.mono, boxSizing: "border-box",
          }}
        />
      </div>

      {/* File upload zones */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 28 }}>
        <FileZone label="SRS Document"    hint=".pdf / .txt / .md" file={srsFile}    setFile={setSrsFile}    color={T.cyan}   />
        <FileZone label="BRD Document"    hint=".pdf / .txt / .md" file={brdFile}    setFile={setBrdFile}    color={T.green}  />
        <FileZone label="Company Policy"  hint="optional · .txt"   file={policyFile} setFile={setPolicyFile} color={T.violet} />
      </div>

      {/* Run button */}
      <button
        onClick={() => canRun && onStart(apiKey, srsFile, brdFile, policyFile)}
        style={{
          width: "100%", padding: "16px 0",
          fontSize: 16, fontWeight: 900,
          background: canRun
            ? `linear-gradient(135deg, #007ACC, ${T.cyan})`
            : T.border,
          color:  canRun ? "#000" : T.textDim,
          border: "none", borderRadius: 8,
          cursor: canRun ? "pointer" : "not-allowed",
          fontFamily: T.font, letterSpacing: "0.04em",
          transition: "all 0.2s",
          boxShadow: canRun ? `0 0 30px ${T.cyan}44` : "none",
        }}
      >
        ▶ Run Risk Analysis
      </button>

      {!canRun && (
        <div style={{ textAlign: "center", fontSize: 12, color: T.textDim, marginTop: 10, fontFamily: T.mono }}>
          Enter API key + upload at least one document to begin
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: 32, fontSize: 11, color: T.textDim, fontFamily: T.mono }}>
        {APP.name} v{APP.version} · 100% free · no backend · no data leaves your browser
      </div>
    </div>
  );
}
