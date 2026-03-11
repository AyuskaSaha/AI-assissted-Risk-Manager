// ============================================================
//  RiskShield — Risk Table / Register
//  Filterable, expandable table of all identified risks.
// ============================================================

import { useState }                           from "react";
import { T, SEV_COLOR, CAT_COLOR, POL_COLOR } from "../../styles/tokens.js";
import { GlowBadge, SeverityTag, PolicyTag, ThinBar } from "../ui/Atoms.jsx";

function RiskRow({ risk, index }) {
  const [open, setOpen] = useState(false);
  const bc = SEV_COLOR[risk.severity] ?? T.cyan;

  return (
    <div style={{ border: `1px solid ${open ? bc : T.border}`, borderLeft: `3px solid ${bc}`, borderRadius: 6, background: open ? T.cardHi : T.card, overflow: "hidden", transition: "all 0.2s" }}>
      {/* Summary row */}
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "grid",
          gridTemplateColumns: "64px 1fr 100px 90px 120px 60px 60px 28px",
          alignItems: "center", gap: 12,
          padding: "12px 16px", cursor: "pointer",
        }}
      >
        <span style={{ fontSize: 10, color: T.cyan, fontWeight: 800, fontFamily: T.mono }}>{risk.id}</span>
        <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{risk.title}</span>
        <GlowBadge label={risk.category} color={CAT_COLOR[risk.category] ?? T.cyan} />
        <SeverityTag level={risk.severity} />
        <div>
          <div style={{ fontSize: 9, color: T.textDim, fontFamily: T.mono, marginBottom: 3 }}>
            L:{risk.likelihood} I:{risk.impact}
          </div>
          <ThinBar value={+((risk.likelihood * risk.impact / 100) * 10).toFixed(0)} color={bc} />
        </div>
        <PolicyTag status={risk.policy_status} />
        <span style={{ fontSize: 10, color: T.textMid, fontFamily: T.mono }}>P:{risk.priority ?? "–"}</span>
        <span style={{ color: T.textMid, fontSize: 12 }}>{open ? "▲" : "▼"}</span>
      </div>

      {/* Expanded detail */}
      {open && (
        <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 13, color: T.textMid, lineHeight: 1.7, margin: 0 }}>
            {risk.description}
          </p>

          {risk.evidence && (
            <div style={{ padding: "8px 12px", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 4, fontSize: 11, color: T.textMid, fontFamily: T.mono }}>
              <span style={{ color: T.cyan }}>evidence › </span>{risk.evidence}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {risk.mitigation && (
              <div style={{ padding: "12px 14px", background: `${T.green}08`, border: `1px solid ${T.green}30`, borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: T.green, fontFamily: T.mono, marginBottom: 6, letterSpacing: "0.06em" }}>◈ MITIGATION</div>
                <p style={{ fontSize: 12, color: T.text, lineHeight: 1.7, margin: 0 }}>{risk.mitigation}</p>
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  {risk.owner    && <GlowBadge label={risk.owner}              color={T.green} />}
                  {risk.timeline && <GlowBadge label={risk.timeline}           color={T.cyan}  />}
                  {risk.effort   && <GlowBadge label={`Effort: ${risk.effort}`} color={risk.effort === "High" ? T.red : risk.effort === "Medium" ? T.amber : T.green} />}
                </div>
              </div>
            )}

            {risk.policy_note && (
              <div style={{ padding: "12px 14px", background: `${T.violet}08`, border: `1px solid ${T.violet}30`, borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: T.violet, fontFamily: T.mono, marginBottom: 6, letterSpacing: "0.06em" }}>⚖ POLICY / COMPLIANCE</div>
                <p style={{ fontSize: 12, color: T.text, lineHeight: 1.7, margin: 0 }}>{risk.policy_note}</p>
                {risk.regulation && (
                  <div style={{ marginTop: 8 }}>
                    <GlowBadge label={risk.regulation} color={T.violet} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RiskTable({ risks }) {
  const [filter, setFilter] = useState("All");
  const levels = ["All", "Critical", "High", "Medium", "Low"];

  const visible = filter === "All"
    ? risks
    : risks.filter((r) => r.severity === filter);

  return (
    <div>
      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {levels.map((l) => {
          const c = SEV_COLOR[l] ?? T.cyan;
          return (
            <button
              key={l}
              onClick={() => setFilter(l)}
              style={{
                padding: "4px 14px", borderRadius: 3,
                border: `1px solid ${filter === l ? c : T.border}`,
                background: filter === l ? `${c}18` : "transparent",
                color: filter === l ? c : T.textMid,
                fontSize: 11, fontFamily: T.mono,
                cursor: "pointer", fontWeight: filter === l ? 800 : 400,
              }}
            >
              {l}
            </button>
          );
        })}
        <span style={{ marginLeft: "auto", fontSize: 11, color: T.textMid, fontFamily: T.mono }}>
          {visible.length} risk{visible.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Column headers */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "64px 1fr 100px 90px 120px 60px 60px 28px",
        gap: 12, padding: "6px 16px", marginBottom: 6,
      }}>
        {["ID", "Title", "Category", "Severity", "Score", "Policy", "Priority", ""].map((h) => (
          <span key={h} style={{ fontSize: 9, color: T.textDim, fontFamily: T.mono, fontWeight: 800, letterSpacing: "0.08em" }}>
            {h}
          </span>
        ))}
      </div>

      {/* Risk rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {visible.map((r, i) => <RiskRow key={r.id} risk={r} index={i} />)}
        {visible.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: T.textDim, fontFamily: T.mono, fontSize: 13 }}>
            No risks match the selected filter.
          </div>
        )}
      </div>
    </div>
  );
}
