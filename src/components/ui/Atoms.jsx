// ============================================================
//  RiskShield — UI Atoms
//  Tiny, stateless presentational components reused everywhere.
// ============================================================

import { useEffect, useState } from "react";
import { T, SEV_COLOR, POL_COLOR } from "../../styles/tokens.js";

// ── Glow Badge ──────────────────────────────────────────────
export function GlowBadge({ label, color = T.cyan, size = 10 }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 10px", borderRadius: 3,
      fontSize: size, fontWeight: 800, letterSpacing: "0.08em",
      fontFamily: T.mono, color,
      background: `${color}18`, border: `1px solid ${color}44`,
    }}>
      {label}
    </span>
  );
}

// ── Severity Tag ─────────────────────────────────────────────
export function SeverityTag({ level }) {
  const icon  = { Critical: "●", High: "▲", Medium: "◆", Low: "▼" }[level] ?? "○";
  const color = SEV_COLOR[level] ?? T.textMid;
  return (
    <span style={{ color, fontWeight: 800, fontSize: 11, fontFamily: T.mono }}>
      {icon} {level}
    </span>
  );
}

// ── Policy Tag ───────────────────────────────────────────────
export function PolicyTag({ status }) {
  const color = POL_COLOR[status] ?? T.textMid;
  return <GlowBadge label={status ?? "?"} color={color} />;
}

// ── Progress Bar (thin) ──────────────────────────────────────
export function ThinBar({ value, max = 10, color = T.cyan }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <div style={{ flex: 1, height: 3, background: T.border, borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          width: `${(value / max) * 100}%`, height: "100%",
          background: color, borderRadius: 2,
          transition: "width 1.2s cubic-bezier(.16,1,.3,1)",
        }} />
      </div>
      <span style={{ fontSize: 10, color: T.textMid, fontFamily: T.mono, minWidth: 14, textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}

// ── Animated count-up number ─────────────────────────────────
export function CountUp({ target, duration = 1200 }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const progress = Math.min(1, (Date.now() - start) / duration);
      setVal(Math.round(progress * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return <>{val}</>;
}

// ── Section Header ───────────────────────────────────────────
export function SectionHeader({ title, sub }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 3, height: 18, borderRadius: 2,
          background: `linear-gradient(${T.cyan}, ${T.violet})`,
        }} />
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.text, fontFamily: T.font, letterSpacing: "0.01em" }}>
          {title}
        </h2>
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: T.textMid, marginTop: 4, marginLeft: 13 }}>{sub}</div>
      )}
    </div>
  );
}

// ── Stat Card ────────────────────────────────────────────────
export function StatCard({ label, value, sub, color = T.cyan, icon }) {
  return (
    <div style={{
      padding: "20px 22px", background: T.card,
      border: `1px solid ${T.border}`, borderTop: `2px solid ${color}`,
      borderRadius: 8, position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", right: 16, top: 16, fontSize: 22, opacity: 0.15 }}>
        {icon}
      </div>
      <div style={{ fontSize: 11, color: T.textMid, fontFamily: T.mono, letterSpacing: "0.08em", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 32, fontWeight: 900, color, fontFamily: T.font, lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: T.textMid, marginTop: 6 }}>{sub}</div>
      )}
    </div>
  );
}

// ── Custom Recharts Tooltip ───────────────────────────────────
export function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: T.cardHi, border: `1px solid ${T.borderHi}`,
      borderRadius: 6, padding: "10px 14px",
      fontSize: 12, color: T.text, fontFamily: T.mono,
    }}>
      <div style={{ color: T.cyan, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || T.text }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
}

// ── Radial Score Gauge (SVG) ─────────────────────────────────
export function ScoreGauge({ score }) {
  const r = 54, cx = 70, cy = 70;
  const circ = 2 * Math.PI * r;
  const dash  = (score / 100) * circ;
  const color = score > 70 ? T.red : score > 40 ? T.amber : T.green;

  return (
    <svg width={140} height={140} style={{ overflow: "visible" }}>
      <defs>
        <filter id="gaugeGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.border} strokeWidth={10} />
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke={color} strokeWidth={10}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        filter="url(#gaugeGlow)"
        style={{ transition: "stroke-dasharray 1.5s cubic-bezier(.16,1,.3,1)" }}
      />
      <text x={cx} y={cy - 6}  textAnchor="middle" fill={color}    fontSize={26} fontWeight={900} fontFamily={T.font}>{score}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill={T.textMid} fontSize={10} fontFamily={T.mono}>RISK SCORE</text>
    </svg>
  );
}
