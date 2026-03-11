// ============================================================
//  RiskShield — Design Tokens
//  Single source of truth for all colors, fonts, and mappings.
// ============================================================

export const T = {
  // ── Backgrounds ──
  bg:       "#030810",
  surface:  "#070F1C",
  card:     "#0A1526",
  cardHi:   "#0E1C30",

  // ── Borders ──
  border:   "#112236",
  borderHi: "#1A3050",

  // ── Brand Colors ──
  cyan:      "#00E5FF",
  cyanDim:   "#00E5FF22",
  green:     "#00FF85",
  greenDim:  "#00FF8522",
  amber:     "#FFB800",
  amberDim:  "#FFB80022",
  red:       "#FF3355",
  redDim:    "#FF335522",
  violet:    "#BF5FFF",
  violetDim: "#BF5FFF22",

  // ── Text ──
  text:    "#C8DEFF",
  textMid: "#4A6A90",
  textDim: "#1E3050",

  // ── Typography ──
  font: "'Outfit', 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
};

// ── Severity → color ──
export const SEV_COLOR = {
  Critical: T.red,
  High:     T.amber,
  Medium:   "#FFDD44",
  Low:      T.green,
};

// ── Category → color ──
export const CAT_COLOR = {
  Security:    T.red,
  Compliance:  T.violet,
  Technical:   T.cyan,
  Operational: T.amber,
  Business:    "#FF8C42",
  Integration: T.green,
};

// ── Policy status → color ──
export const POL_COLOR = {
  PASS: T.green,
  WARN: T.amber,
  FAIL: T.red,
};
