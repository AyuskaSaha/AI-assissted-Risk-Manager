// ============================================================
//  RiskShield — Dashboard View
//  Tabbed layout: Overview (charts) | Risk Register | Copilot
// ============================================================

import { useState }      from "react";
import { T }             from "../styles/tokens.js";
import { GlowBadge }     from "../components/ui/Atoms.jsx";
import DashboardVisuals  from "../components/dashboard/DashboardVisuals.jsx";
import RiskTable         from "../components/dashboard/RiskTable.jsx";
import Copilot           from "../components/dashboard/Copilot.jsx";
import { APP, USE_AWS }  from "../config.js";

const TABS = [
  { id: "overview", label: "📊  Overview"      },
  { id: "risks",    label: "🔍  Risk Register"  },
  { id: "copilot",  label: "✦  Copilot"         },
];

export default function DashboardView({ risks, summary, ragIndex, apiKey, sessionId, reportUrl, onReset }) {
  const [tab, setTab] = useState("overview");

  const criticalCount = risks.filter((r) => r.severity === "Critical").length;
  const scoreColor    = (summary?.overall_score ?? 0) > 70 ? T.red : T.amber;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>

      {/* ── Top Navigation Bar ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 32px", background: T.surface,
        borderBottom: `1px solid ${T.border}`,
        position: "sticky", top: 0, zIndex: 10,
        flexWrap: "wrap", gap: 10,
      }}>
        {/* Brand + tabs */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <span style={{ fontSize: 20, fontWeight: 900, fontFamily: T.font }}>
            <span style={{ color: T.cyan }}>Risk</span>
            <span style={{ color: T.text }}>Shield</span>
          </span>

          <div style={{ display: "flex", gap: 2 }}>
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: "6px 16px", borderRadius: 4,
                  border: `1px solid ${tab === t.id ? T.cyan : T.border}`,
                  background: tab === t.id ? `${T.cyan}15` : "transparent",
                  color:  tab === t.id ? T.cyan : T.textMid,
                  fontSize: 12, cursor: "pointer",
                  fontFamily: T.font, fontWeight: tab === t.id ? 700 : 400,
                  transition: "all 0.15s",
                }}
              >
                {t.id === "risks" ? `🔍  Risk Register (${risks.length})` : t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right side: badges + AWS info + reset */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <GlowBadge label={`${criticalCount} Critical`}              color={T.red}       />
          <GlowBadge label={`Score: ${summary?.overall_score ?? "–"}`} color={scoreColor} />

          {/* ── AWS indicators (only when USE_AWS = true) ── */}
          {USE_AWS && sessionId && (
            <GlowBadge label={`☁ ${sessionId}`} color={T.amber} />
          )}
          {USE_AWS && reportUrl && (
            <a
              href={reportUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "4px 12px", borderRadius: 3, textDecoration: "none",
                fontSize: 11, fontWeight: 800, fontFamily: T.mono,
                color: T.green, background: `${T.green}15`,
                border: `1px solid ${T.green}44`,
                transition: "all 0.15s",
              }}
            >
              ↓ S3 Report
            </a>
          )}
          {USE_AWS && !reportUrl && (
            <GlowBadge label="☁ Local mode" color={T.textDim} />
          )}

          <button
            onClick={onReset}
            style={{
              padding: "6px 14px", background: "transparent",
              border: `1px solid ${T.border}`, borderRadius: 4,
              color: T.textMid, fontSize: 11, cursor: "pointer", fontFamily: T.mono,
            }}
          >
            ↩ New Analysis
          </button>
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div style={{
        flex: 1, padding: "28px 32px",
        maxWidth: 1400, margin: "0 auto",
        width: "100%", boxSizing: "border-box",
      }}>

        {tab === "overview" && (
          <DashboardVisuals risks={risks} summary={summary} />
        )}

        {tab === "risks" && (
          <RiskTable risks={risks} />
        )}

        {tab === "copilot" && (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{
              padding: "16px 20px", borderBottom: `1px solid ${T.border}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${T.violet}20`, border: `1px solid ${T.violet}50`, display: "flex", alignItems: "center", justifyContent: "center", color: T.violet, fontSize: 13 }}>✦</div>
                <div>
                  <div style={{ fontWeight: 800, color: T.text, fontSize: 14 }}>Risk Management Copilot</div>
                  <div style={{ fontSize: 11, color: T.textMid }}>
                    Gemini 2.5 Flash · RAG context
                    {USE_AWS && sessionId && ` · Chat history saved to DynamoDB (${sessionId})`}
                  </div>
                </div>
              </div>
            </div>
            <Copilot apiKey={apiKey} ragIndex={ragIndex} risks={risks} sessionId={sessionId} />
          </div>
        )}
      </div>
    </div>
  );
}
