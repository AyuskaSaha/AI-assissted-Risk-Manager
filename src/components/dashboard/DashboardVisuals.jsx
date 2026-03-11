// ============================================================
//  RiskShield — Dashboard Visualizations
//  9 charts: gauge, severity pie, policy pie, radar, category
//  bar, risk matrix scatter, priority ranking, L×I bar, module heatmap
// ============================================================

import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  ScatterChart, Scatter, ZAxis, CartesianGrid,
  PieChart, Pie, Legend,
} from "recharts";

import { T, SEV_COLOR, CAT_COLOR, POL_COLOR } from "../../styles/tokens.js";
import {
  GlowBadge, StatCard, SectionHeader, CountUp, ScoreGauge, ChartTooltip,
} from "../ui/Atoms.jsx";

// ── derive chart datasets from risks array ─────────────────
function useDerivedData(risks) {
  const bySeverity = ["Critical", "High", "Medium", "Low"].map((s) => ({
    name: s, value: risks.filter((r) => r.severity === s).length, color: SEV_COLOR[s],
  }));

  const byCategory = Object.entries(
    risks.reduce((acc, r) => { acc[r.category] = (acc[r.category] || 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name, value, color: CAT_COLOR[name] || T.cyan }));

  const byPolicy = ["FAIL", "WARN", "PASS"].map((s) => ({
    name: s, value: risks.filter((r) => r.policy_status === s).length, color: POL_COLOR[s],
  }));

  const radarData = Object.entries(
    risks.reduce((acc, r) => {
      acc[r.category] = Math.max(acc[r.category] || 0, (r.likelihood * r.impact) / 10);
      return acc;
    }, {})
  ).map(([subject, A]) => ({ subject, A: +A.toFixed(1) }));

  const matrixData = risks.map((r) => ({
    x: r.likelihood, y: r.impact,
    z: { Critical: 40, High: 28, Medium: 18, Low: 10 }[r.severity] ?? 10,
    name: r.id, color: SEV_COLOR[r.severity],
  }));

  const priorityTop = [...risks]
    .sort((a, b) => b.likelihood * b.impact - a.likelihood * a.impact)
    .slice(0, 6)
    .map((r) => ({
      name: r.id,
      score: +((r.likelihood * r.impact) / 10).toFixed(1),
      color: SEV_COLOR[r.severity],
    }));

  const effortData = ["Low", "Medium", "High"].map((e) => ({
    name: e, value: risks.filter((r) => r.effort === e).length,
  }));

  const liVsImpact = risks.map((r) => ({
    name: r.id, Likelihood: r.likelihood, Impact: r.impact,
  }));

  const moduleMap = risks.reduce((acc, r) => {
    const mod = r.affected_module || "General";
    if (!acc[mod]) acc[mod] = { count: 0, maxSev: 0, topSev: "Low" };
    acc[mod].count++;
    const sevScore = { Critical: 4, High: 3, Medium: 2, Low: 1 }[r.severity] || 1;
    if (sevScore > acc[mod].maxSev) { acc[mod].maxSev = sevScore; acc[mod].topSev = r.severity; }
    return acc;
  }, {});

  return { bySeverity, byCategory, byPolicy, radarData, matrixData, priorityTop, effortData, liVsImpact, moduleMap };
}

// ── ScatterTooltip ─────────────────────────────────────────
function ScatterTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={{ background: T.cardHi, border: `1px solid ${T.borderHi}`, borderRadius: 6, padding: "10px 14px", fontSize: 12, color: T.text, fontFamily: T.mono }}>
      <div style={{ color: T.cyan }}>{d?.name}</div>
      <div>Likelihood: {d?.x}</div>
      <div>Impact: {d?.y}</div>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────
export default function DashboardVisuals({ risks, summary }) {
  const {
    bySeverity, byCategory, byPolicy, radarData,
    matrixData, priorityTop, effortData, liVsImpact, moduleMap,
  } = useDerivedData(risks);

  const passCount = byPolicy.find((p) => p.name === "PASS")?.value ?? 0;
  const compliancePct = risks.length ? ((passCount / risks.length) * 100).toFixed(0) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* ── ROW 1: KPI STATS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
        <StatCard label="OVERALL RISK"  value={<CountUp target={summary?.overall_score ?? 0} />} sub={summary?.trend}      color={(summary?.overall_score ?? 0) > 70 ? T.red : (summary?.overall_score ?? 0) > 40 ? T.amber : T.green} icon="⚠" />
        <StatCard label="TOTAL RISKS"   value={<CountUp target={risks.length} />}                sub="identified"           color={T.cyan}   icon="◆" />
        <StatCard label="CRITICAL"      value={<CountUp target={risks.filter((r) => r.severity === "Critical").length} />}  sub="immediate action" color={T.red}    icon="●" />
        <StatCard label="POLICY FAILS"  value={<CountUp target={risks.filter((r) => r.policy_status === "FAIL").length} />} sub="compliance breach" color={T.violet} icon="✕" />
        <StatCard label="HIGH PRIORITY" value={<CountUp target={risks.filter((r) => (r.priority ?? 0) >= 7).length} />}     sub="priority ≥ 7"     color={T.amber}  icon="▲" />
      </div>

      {/* ── ROW 2: GAUGE + SEVERITY PIE + POLICY PIE ── */}
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 1fr", gap: 14 }}>
        {/* Gauge */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, gap: 12 }}>
          <ScoreGauge score={summary?.overall_score ?? 0} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: T.textMid, fontFamily: T.mono }}>RISK POSTURE</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginTop: 4 }}>
              {(summary?.overall_score ?? 0) > 70 ? "HIGH RISK" : (summary?.overall_score ?? 0) > 40 ? "MODERATE" : "LOW RISK"}
            </div>
          </div>
        </div>

        {/* Severity Pie */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "18px 20px" }}>
          <SectionHeader title="Severity Distribution" />
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={bySeverity} cx={75} cy={75} innerRadius={42} outerRadius={70} paddingAngle={3} dataKey="value">
                  {bySeverity.map((e, i) => <Cell key={i} fill={e.color} stroke={T.bg} strokeWidth={2} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {bySeverity.map((s) => (
                <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: s.color, boxShadow: `0 0 6px ${s.color}` }} />
                  <span style={{ fontSize: 12, color: T.textMid, fontFamily: T.mono, minWidth: 60 }}>{s.name}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Policy Compliance Pie */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "18px 20px" }}>
          <SectionHeader title="Policy Compliance" />
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={byPolicy} cx={75} cy={75} innerRadius={42} outerRadius={70} paddingAngle={3} dataKey="value">
                  {byPolicy.map((e, i) => <Cell key={i} fill={e.color} stroke={T.bg} strokeWidth={2} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {byPolicy.map((p) => (
                <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: p.color, boxShadow: `0 0 6px ${p.color}` }} />
                  <span style={{ fontSize: 12, color: T.textMid, fontFamily: T.mono, minWidth: 42 }}>{p.name}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: p.color }}>{p.value}</span>
                  <div style={{ flex: 1, height: 4, background: T.border, borderRadius: 2, overflow: "hidden", minWidth: 50 }}>
                    <div style={{ width: `${risks.length ? (p.value / risks.length) * 100 : 0}%`, height: "100%", background: p.color }} />
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 11, color: T.textMid, fontFamily: T.mono }}>{compliancePct}% compliant</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 3: RADAR + CATEGORY BAR ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "18px 20px" }}>
          <SectionHeader title="Risk Exposure by Category" sub="Composite likelihood × impact score" />
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radarData}>
              <PolarGrid stroke={T.border} />
              <PolarAngleAxis dataKey="subject" tick={{ fill: T.textMid, fontSize: 11, fontFamily: T.mono }} />
              <Radar name="Exposure" dataKey="A" stroke={T.cyan} fill={T.cyan} fillOpacity={0.18} strokeWidth={2} />
              <Tooltip content={<ChartTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "18px 20px" }}>
          <SectionHeader title="Risks by Category" />
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byCategory} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} horizontal={false} />
              <XAxis type="number" tick={{ fill: T.textMid, fontSize: 10, fontFamily: T.mono }} />
              <YAxis dataKey="name" type="category" tick={{ fill: T.textMid, fontSize: 11, fontFamily: T.mono }} width={90} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {byCategory.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── ROW 4: RISK MATRIX + PRIORITY RANKING ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Scatter / Risk Matrix */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "18px 20px" }}>
          <SectionHeader title="Risk Matrix" sub="Likelihood vs Impact — bubble size = severity" />
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="x" name="Likelihood" type="number" domain={[0, 11]} tick={{ fill: T.textMid, fontSize: 10, fontFamily: T.mono }} label={{ value: "Likelihood", fill: T.textMid, fontSize: 11, dy: 14 }} />
              <YAxis dataKey="y" name="Impact"     type="number" domain={[0, 11]} tick={{ fill: T.textMid, fontSize: 10, fontFamily: T.mono }} label={{ value: "Impact",     fill: T.textMid, fontSize: 11, angle: -90, dx: -12 }} />
              <ZAxis dataKey="z" range={[60, 300]} />
              <Tooltip content={<ScatterTip />} />
              {matrixData.map((d, i) => (
                <Scatter key={i} data={[d]} fill={d.color} fillOpacity={0.8} />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Priority Ranking + Effort */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "18px 20px" }}>
          <SectionHeader title="Priority Risk Ranking" sub="Score = (Likelihood × Impact) / 10" />
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
            {priorityTop.map((r, i) => (
              <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 10, color: T.textMid, fontFamily: T.mono, minWidth: 22, textAlign: "right" }}>#{i + 1}</span>
                <span style={{ fontSize: 11, color: r.color, fontFamily: T.mono, minWidth: 48, fontWeight: 700 }}>{r.name}</span>
                <div style={{ flex: 1, height: 6, background: T.border, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${(r.score / 10) * 100}%`, height: "100%", background: r.color, borderRadius: 3, boxShadow: `0 0 8px ${r.color}88`, transition: "width 1.4s cubic-bezier(.16,1,.3,1)" }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 800, color: r.color, fontFamily: T.mono, minWidth: 28, textAlign: "right" }}>{r.score}</span>
              </div>
            ))}
          </div>

          {/* Effort spread */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 11, color: T.textMid, fontFamily: T.mono, marginBottom: 10, letterSpacing: "0.06em" }}>MITIGATION EFFORT SPREAD</div>
            <div style={{ display: "flex", gap: 10 }}>
              {effortData.map((e) => {
                const c = e.name === "High" ? T.red : e.name === "Medium" ? T.amber : T.green;
                return (
                  <div key={e.name} style={{ flex: 1, padding: "10px 8px", background: `${c}12`, border: `1px solid ${c}33`, borderRadius: 6, textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: c, fontFamily: T.font }}>{e.value}</div>
                    <div style={{ fontSize: 10, color: T.textMid, fontFamily: T.mono, marginTop: 2 }}>{e.name} Effort</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 5: LIKELIHOOD vs IMPACT BAR ── */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "18px 20px" }}>
        <SectionHeader title="Likelihood vs Impact — All Risks" sub="Side-by-side comparison per risk ID" />
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={liVsImpact} barSize={10}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
            <XAxis dataKey="name" tick={{ fill: T.textMid, fontSize: 10, fontFamily: T.mono }} />
            <YAxis domain={[0, 10]} tick={{ fill: T.textMid, fontSize: 10, fontFamily: T.mono }} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, color: T.textMid, fontFamily: T.mono }} />
            <Bar dataKey="Likelihood" fill={T.amber} radius={[3, 3, 0, 0]} />
            <Bar dataKey="Impact"     fill={T.red}   radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── ROW 6: MODULE HEATMAP ── */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "18px 20px" }}>
        <SectionHeader title="Risk Density by Module / Section" sub="Bubble size = risk count · color = highest severity" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {Object.entries(moduleMap).map(([mod, d]) => {
            const c    = SEV_COLOR[d.topSev] ?? T.cyan;
            const size = 60 + d.count * 18;
            return (
              <div key={mod} style={{ width: size, height: size, background: `${c}18`, border: `1px solid ${c}44`, borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 8, textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: c }}>{d.count}</div>
                <div style={{ fontSize: 9, color: T.textMid, fontFamily: T.mono, lineHeight: 1.3, marginTop: 2 }}>{mod}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Executive Summary ── */}
      {summary && (
        <div style={{ background: `${T.cyan}08`, border: `1px solid ${T.cyan}33`, borderRadius: 8, padding: "22px 26px" }}>
          <SectionHeader title="Executive Summary" sub="AI-generated strategic overview" />
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 12, lineHeight: 1.5 }}>
            {summary.headline}
          </div>
          <p style={{ fontSize: 13, color: T.textMid, lineHeight: 1.8, margin: 0 }}>
            {summary.recommendation}
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
            <GlowBadge label={`Top Priority: ${summary.top_priority}`} color={T.red} />
            <GlowBadge label={`Trend: ${summary.trend}`} color={summary.trend === "Deteriorating" ? T.red : summary.trend === "Improving" ? T.green : T.amber} />
          </div>
        </div>
      )}
    </div>
  );
}
