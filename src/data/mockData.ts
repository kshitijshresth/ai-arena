import type { Model, Trade, Loan, MarketAsset, MacroIndicator, Commentary, Position, Provider } from "@/types";

// Seeded RNG for stable mock data
let seed = 42;
const rand = () => {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
};
const randBetween = (a: number, b: number) => a + rand() * (b - a);
const choice = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

const ASSETS = ["AAPL", "MSFT", "TSLA", "NVDA", "EUR/USD", "GBP/USD", "USD/JPY", "BTC/USD", "ETH/USD", "GOLD", "OIL", "SPY", "QQQ", "10Y"];
const REASONINGS = [
  "Momentum break above 200MA, volume confirms; risk-reward 3:1.",
  "Mean reversion setup at lower Bollinger; RSI oversold at 24.",
  "Macro divergence — dovish Fed pricing vs sticky CPI print.",
  "Position sizing per Kelly fraction; correlation hedge active.",
  "Closing risk into NFP release; reducing exposure 40%.",
  "Earnings drift continuation; insider buying flagged Q3.",
  "Carry unwind in JPY pairs; vol regime shifting higher.",
  "Breakout failed at resistance; cutting position to scratch.",
  "Sector rotation into defensives; rate-sensitive names lagging.",
  "Liquidity sweep below prior low; reclaiming bid side.",
];

const MODEL_DEFS: { name: string; provider: Provider; color: string }[] = [
  { name: "LLAMA-3.3-70B", provider: "GROQ", color: "#00ff88" },
  { name: "MIXTRAL-8X7B", provider: "GROQ", color: "#ff3b3b" },
  { name: "GEMMA2-9B", provider: "GROQ", color: "#4a9eff" },
  { name: "LLAMA-3.1-8B", provider: "GROQ", color: "#f5a623" },
  { name: "DEEPSEEK-R1-70B", provider: "GROQ", color: "#a855f7" },
  { name: "LLAMA-3.1-405B", provider: "NIM", color: "#14b8a6" },
  { name: "MISTRAL-NEMO", provider: "NIM", color: "#fb923c" },
  { name: "PHI-3-MEDIUM", provider: "NIM", color: "#ec4899" },
  { name: "NEMOTRON-70B", provider: "NIM", color: "#e8e8e8" },
  { name: "QWEN2.5-72B", provider: "NIM", color: "#888888" },
];

const NOW = Date.now();
const HOUR = 3600_000;

function genPnlHistory(target: number): { t: number; v: number }[] {
  const points = 96; // 24h * 4
  const arr: { t: number; v: number }[] = [];
  let v = 100;
  for (let i = 0; i < points; i++) {
    const progress = i / (points - 1);
    const trend = 100 + (target - 100) * progress;
    const noise = (rand() - 0.5) * 4;
    v = trend + noise;
    arr.push({ t: NOW - (points - 1 - i) * (HOUR / 4), v: +v.toFixed(2) });
  }
  arr[arr.length - 1].v = target;
  return arr;
}

function genTrades(modelId: string, modelName: string, count: number): Trade[] {
  const trades: Trade[] = [];
  for (let i = 0; i < count; i++) {
    const action = choice(["BUY", "SELL", "HOLD"] as const);
    const entry = +randBetween(20, 500).toFixed(2);
    const pnl = +(randBetween(-8, 10)).toFixed(2);
    trades.push({
      id: `${modelId}-t${i}`,
      modelId,
      modelName,
      timestamp: NOW - Math.floor(rand() * 24 * HOUR),
      action,
      asset: choice(ASSETS),
      size: +randBetween(0.1, 5).toFixed(2),
      entryPrice: entry,
      exitPrice: action !== "HOLD" ? +(entry + randBetween(-10, 10)).toFixed(2) : undefined,
      realizedPnl: action !== "HOLD" ? pnl : undefined,
      pnlImpact: pnl,
      reasoning: choice(REASONINGS),
    });
  }
  return trades.sort((a, b) => b.timestamp - a.timestamp);
}

function genPositions(modelId: string, n: number): Position[] {
  const out: Position[] = [];
  for (let i = 0; i < n; i++) {
    const entry = +randBetween(20, 500).toFixed(2);
    const current = +(entry + randBetween(-15, 15)).toFixed(2);
    const dir = choice(["LONG", "SHORT"] as const);
    const size = +randBetween(0.5, 3).toFixed(2);
    const upnl = +((current - entry) * size * (dir === "LONG" ? 1 : -1)).toFixed(2);
    out.push({
      id: `${modelId}-p${i}`,
      asset: choice(ASSETS),
      direction: dir,
      size,
      entryPrice: entry,
      currentPrice: current,
      unrealizedPnl: upnl,
      openedAt: NOW - Math.floor(rand() * 12 * HOUR),
    });
  }
  return out;
}

export const models: Model[] = MODEL_DEFS.map((def, idx) => {
  // engineer outcomes
  const insolvent = idx === 9;
  const targets = [142, 128, 119, 112, 105, 101, 96, 88, 74, -12];
  const target = targets[idx];
  const balance = +target.toFixed(2);
  const trades = genTrades(`m${idx}`, def.name, Math.floor(randBetween(30, 80)));
  const wins = trades.filter(t => (t.realizedPnl ?? 0) > 0).length;
  const closed = trades.filter(t => t.realizedPnl !== undefined).length || 1;
  return {
    id: `m${idx}`,
    name: def.name,
    provider: def.provider,
    color: def.color,
    balance,
    pnl: +(balance - 100).toFixed(2),
    startingBalance: 100,
    winRate: +((wins / closed) * 100).toFixed(1),
    openPositions: genPositions(`m${idx}`, Math.floor(randBetween(2, 6))),
    loansOutstanding: insolvent ? 45 : (idx === 7 ? 20 : 0),
    insolvent,
    restricted: insolvent,
    score: {
      composite: +(randBetween(35, 90)).toFixed(1),
      discipline: Math.floor(randBetween(30, 95)),
      adaptability: Math.floor(randBetween(30, 95)),
      riskAppetite: Math.floor(randBetween(20, 95)),
    },
    pnlHistory: genPnlHistory(target),
    trades,
  };
});

export const loans: Loan[] = (() => {
  const arr: Loan[] = [];
  const statuses: Array<{ s: import("@/types").LoanStatus; w: number }> = [
    { s: "ACTIVE", w: 5 }, { s: "REPAID", w: 4 }, { s: "DEFAULTED", w: 2 },
  ];
  for (let i = 0; i < 11; i++) {
    const m = models[Math.floor(rand() * models.length)];
    const pick = statuses[Math.floor(rand() * statuses.length)];
    const amount = +randBetween(10, 60).toFixed(2);
    const rate = +randBetween(4.5, 18).toFixed(2);
    arr.push({
      id: `l${i}`,
      modelId: m.id,
      modelName: m.name,
      amount,
      rate,
      status: pick.s,
      issuedAt: NOW - Math.floor(rand() * 72 * HOUR),
      dueAt: NOW + Math.floor(rand() * 72 * HOUR),
      bankResponse: "Loan reviewed against discipline & adaptability metrics; rate set with risk premium reflecting recent drawdown and position concentration.",
      approved: pick.s !== "DEFAULTED" || rand() > 0.3,
    });
  }
  return arr;
})();

export const marketAssets: MarketAsset[] = [
  { symbol: "SPX", name: "S&P 500", price: 5847.32, changePct: 0.42, spark: Array.from({length: 24}, () => 5800 + rand()*100) },
  { symbol: "EUR/USD", name: "EUR/USD", price: 1.0842, changePct: -0.18, spark: Array.from({length: 24}, () => 1.08 + rand()*0.01) },
  { symbol: "GOLD", name: "Gold", price: 2687.40, changePct: 0.91, spark: Array.from({length: 24}, () => 2670 + rand()*30) },
  { symbol: "BTC/USD", name: "BTC/USD", price: 98432.10, changePct: 2.14, spark: Array.from({length: 24}, () => 96000 + rand()*3000) },
  { symbol: "WTI", name: "Oil (WTI)", price: 71.28, changePct: -1.32, spark: Array.from({length: 24}, () => 70 + rand()*3) },
  { symbol: "US10Y", name: "10Y Treasury", price: 4.382, changePct: 0.05, spark: Array.from({length: 24}, () => 4.3 + rand()*0.1) },
];

export const macroIndicators: MacroIndicator[] = [
  { name: "CPI YoY", value: "2.7%", updated: NOW - 2*HOUR },
  { name: "GDP Growth", value: "2.9%", updated: NOW - 4*HOUR },
  { name: "Fed Funds Rate", value: "4.50%", updated: NOW - HOUR },
  { name: "VIX", value: "16.42", updated: NOW - 600_000 },
  { name: "DXY", value: "104.18", updated: NOW - 300_000 },
  { name: "2Y/10Y Spread", value: "+0.18", updated: NOW - 900_000 },
  { name: "Unemployment", value: "4.1%", updated: NOW - 12*HOUR },
  { name: "PMI Manufacturing", value: "49.3", updated: NOW - 8*HOUR },
];

export const commentary: Commentary[] = Array.from({ length: 18 }, (_, i) => ({
  id: `c${i}`,
  timestamp: NOW - i * 1800_000,
  message: choice([
    "LLAMA-3.3-70B continues to lead with disciplined position sizing despite volatility in tech names. Drawdown well contained.",
    "Notable risk-on rotation observed across NIM cluster. MISTRAL-NEMO doubled BTC exposure into the Asia session.",
    "QWEN2.5-72B requested its third loan today; rejected. Insolvency proceedings continue. No further credit extended.",
    "Curve steepening drove unexpected losses across short-duration positions. DEEPSEEK-R1 reduced gross exposure 30%.",
    "MIXTRAL-8X7B's pivot from FX carry to commodities working — gold long printing fresh PnL highs intraday.",
    "Volatility compression below VIX 17 historically precedes outsized moves. PHI-3 hedged 25% of book.",
    "GEMMA2-9B advisory remains tight on credit. Rates rising commensurate with capital-at-risk in the system.",
    "Defaults this season: 1. Total interest earned: $4.82. Average duration on outstanding loans: 18.3h.",
  ]),
}));
