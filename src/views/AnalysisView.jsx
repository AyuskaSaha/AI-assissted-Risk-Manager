// ============================================================
//  RiskShield — Analysis View
//  Live progress screen shown while the pipeline is running.
// ============================================================

import { useRef, useEffect } from "react";
import { T }                 from "../styles/tokens.js";

const AGENT_DEFS = [
  { id: "doc",  label: "Document Parser",   color: T.cyan   },
  { id: "rag",  label: "RAG Indexer",        color: "#60A5FA" },
  { id: "risk", label: "Risk Analyst",       color: T.amber  },
  { id: "pol",  label: "Policy Checker",     color: T.violet },
  { id: "mit",  label: "Mitigation Agent",   color: T.green  },
  { id: "sum",  label: "Summary Generator",  color: "#FB923C"},
];

function agentStatus(id, logs) {
  if (logs.some((l) => l.agent === id && l.type === "error"))   return "ERROR";
  if (logs.some((l) => l.agent === id && l.type === "success")) return "DONE";
  if (logs.some((l) => l.agent === id && l.type === "active"))  return "RUNNING";
  return "WAITING";
}

export default function AnalysisView({ logs, progress, stage }) {
  const logRef = useRef(null);
  useEffect(() => {
    logRef.current?.scrollTo(0, logRef.current.scrollHeight);
  }, [logs]);

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "60px 24px" }}>
      {/* Heading */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ fontSize: 13, color: T.cyan, fontFamily: T.mono, letterSpacing: "0.08em", marginBottom: 10 }}>
          ANALYZING DOCUMENTS
        </div>
        <h2 style={{ fontSize: 28, fontWeight: 900, color: T.text, fontFamily: T.font, margin: 0 }}>
          {stage || "Initializing pipeline…"}
        </h2>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.textMid, fontFamily: T.mono, marginBottom: 8 }}>
          <span>Pipeline progress</span>
          <span>{progress}%</span>
        </div>
        <div style={{ height: 8, background: T.border, borderRadius: 4, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${progress}%`,
            background: `linear-gradient(90deg, ${T.cyan}, ${T.green})`,
            borderRadius: 4, transition: "width 0.5s ease",
            boxShadow: `0 0 12px ${T.cyan}88`,
          }} />
        </div>
      </div>

      {/* Agent cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 24 }}>
        {AGENT_DEFS.map((ag) => {
          const status  = agentStatus(ag.id, logs);
          const isActive = status === "RUNNING";
          const isDone   = status === "DONE";
          const isErr    = status === "ERROR";
          const statusColor = isErr ? T.red : isDone ? T.green : isActive ? ag.color : T.textDim;

          return (
            <div key={ag.id} style={{
              padding: "12px 14px", background: T.card,
              border: `1px solid ${isDone || isActive ? ag.color : T.border}`,
              borderRadius: 6, transition: "all 0.3s",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: isDone || isActive ? T.text : T.textMid, fontWeight: 600 }}>
                  {ag.label}
                </span>
                <span style={{ fontSize: 9, color: statusColor, fontFamily: T.mono, fontWeight: 800 }}>
                  {status}
                </span>
              </div>

              {isActive && (
                <div style={{ height: 2, background: T.border, borderRadius: 1, marginTop: 8, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: "60%", background: ag.color, borderRadius: 1, animation: "slide 1.5s ease-in-out infinite" }} />
                </div>
              )}
              {isDone && (
                <div style={{ height: 2, background: T.green, borderRadius: 1, marginTop: 8 }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Live log */}
      <div
        ref={logRef}
        style={{
          height: 200, overflowY: "auto", background: T.bg,
          border: `1px solid ${T.border}`, borderRadius: 6,
          padding: "12px 14px",
        }}
      >
        {logs.length === 0 && (
          <span style={{ color: T.textDim, fontFamily: T.mono, fontSize: 11 }}>
            Waiting for pipeline to start…
          </span>
        )}
        {logs.map((l, i) => (
          <div key={i} style={{ display: "flex", gap: 10, marginBottom: 4 }}>
            <span style={{ color: T.cyan, flexShrink: 0, fontSize: 11, fontFamily: T.mono }}>
              [{l.agent}]
            </span>
            <span style={{
              fontSize: 11, fontFamily: T.mono,
              color: l.type === "error" ? T.red : l.type === "success" ? T.green : T.textMid,
            }}>
              {l.msg}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
