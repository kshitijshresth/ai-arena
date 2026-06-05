import type {
  ArenaTraderModel,
  ArenaTrade,
  ArenaPosition,
  ArenaLoan,
  ArenaMarketSnapshot,
  ArenaCentralBankCommentary,
  ArenaLeaderboardEntry,
  ArenaModelScores,
} from "../types";
import type { Model, Trade, Position, Loan, MarketAsset, MacroIndicator, Commentary, Score } from "../types";
import { getTraderById } from "./models";

const PROVIDER_COLORS: Record<string, string> = {
  groq: "#00ff88",
  nim: "#4a9eff",
};

export function adaptScores(scores: ArenaModelScores): Score {
  return {
    composite: scores.compositeScore,
    discipline: scores.disciplineScore,
    adaptability: scores.adaptabilityScore,
    riskAppetite: scores.riskAppetiteScore,
  };
}

export function adaptPosition(p: ArenaPosition): Position {
  return {
    id: p.id,
    asset: p.asset,
    direction: p.direction === "long" ? "LONG" : "SHORT",
    size: p.sizeUsd,
    entryPrice: p.entryPrice,
    currentPrice: p.currentPrice,
    unrealizedPnl: p.unrealizedPnl,
    openedAt: new Date(p.openedAt).getTime(),
  };
}

export function adaptTrade(t: ArenaTrade): Trade {
  const model = getTraderById(t.modelId);
  return {
    id: t.id,
    modelId: t.modelId,
    modelName: model?.name ?? t.modelId,
    timestamp: new Date(t.executedAt).getTime(),
    action: t.action,
    asset: t.asset,
    size: t.sizeUsd,
    entryPrice: t.entryPrice,
    exitPrice: t.exitPrice,
    realizedPnl: t.realizedPnl,
    pnlImpact: t.realizedPnl ?? 0,
    reasoning: t.reasoning,
  };
}

export function adaptLoan(l: ArenaLoan): Loan {
  const model = getTraderById(l.borrowerModelId);
  const statusMap: Record<string, Loan["status"]> = {
    approved: "ACTIVE",
    pending: "ACTIVE",
    rejected: "ACTIVE",
    repaid: "REPAID",
    defaulted: "DEFAULTED",
  };
  return {
    id: l.id,
    modelId: l.borrowerModelId,
    modelName: model?.name ?? l.borrowerModelId,
    amount: l.amountRequested,
    rate: l.interestRate ?? 0,
    status: statusMap[l.status] ?? "ACTIVE",
    issuedAt: new Date(l.requestedAt).getTime(),
    dueAt: l.dueAt ? new Date(l.dueAt).getTime() : Date.now() + 30 * 24 * 3600_000,
    bankResponse: l.centralBankReasoning,
    approved: l.status === "approved" || l.status === "repaid" || l.status === "defaulted",
  };
}

export function adaptMarketAsset(a: ArenaMarketSnapshot["assets"][number]): MarketAsset {
  return {
    symbol: a.symbol,
    name: a.name,
    price: a.price,
    changePct: a.changePercent24h,
    spark: [],
  };
}

export function adaptMacroIndicator(m: ArenaMarketSnapshot["macroIndicators"][number]): MacroIndicator {
  return {
    name: m.name,
    value: m.value,
    updated: new Date(m.lastUpdated).getTime(),
  };
}

export function adaptCommentary(c: ArenaCentralBankCommentary): Commentary {
  return {
    id: c.id,
    timestamp: new Date(c.createdAt).getTime(),
    message: c.message,
  };
}

export function adaptTraderModel(
  m: ArenaTraderModel,
  trades?: ArenaTrade[],
  scores?: ArenaModelScores,
  loans?: ArenaLoan[]
): Model {
  const adaptedTrades = trades?.map(adaptTrade) ?? m.openPositions.map(() => ({} as Trade));
  const winCount = adaptedTrades.filter((t) => (t.realizedPnl ?? 0) > 0).length;
  const closedCount = adaptedTrades.filter((t) => t.realizedPnl !== undefined).length || 1;
  const loansOutstanding = (loans ?? m.loans)
    .filter((l) => l.status === "approved")
    .reduce((s, l) => s + (l.amountApproved ?? 0), 0);

  // Generate a deterministic pnlHistory from current balance
  const pnlHistory: { t: number; v: number }[] = [];
  const now = Date.now();
  const points = 96;
  const pnl = m.balance - m.startingBalance;
  let seed = m.id.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const detRand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 0; i < points; i++) {
    const progress = i / (points - 1);
    const trend = m.startingBalance + pnl * progress;
    const noise = (detRand() - 0.5) * 4;
    pnlHistory.push({ t: now - (points - 1 - i) * (3600_000 / 4), v: +(trend + noise).toFixed(2) });
  }
  pnlHistory[pnlHistory.length - 1].v = m.balance;

  return {
    id: m.id,
    name: m.name,
    provider: m.provider.toUpperCase() as "GROQ" | "NIM",
    color: PROVIDER_COLORS[m.provider] ?? "#888888",
    balance: m.balance,
    pnl: +(m.balance - m.startingBalance).toFixed(2),
    startingBalance: m.startingBalance,
    winRate: +((winCount / closedCount) * 100).toFixed(1),
    openPositions: m.openPositions.map(adaptPosition),
    loansOutstanding,
    insolvent: m.isInsolvent,
    restricted: m.isInsolvent,
    score: scores ? adaptScores(scores) : adaptScores(m.scores),
    pnlHistory,
    trades: adaptedTrades,
  };
}

export function adaptLeaderboard(
  entries: (ArenaLeaderboardEntry & ArenaTraderModel)[]
): Model[] {
  return entries.map((e) => adaptTraderModel(e, undefined, e.scores));
}

export function adaptMarketSnapshot(snapshot: ArenaMarketSnapshot): {
  assets: MarketAsset[];
  macroIndicators: MacroIndicator[];
} {
  return {
    assets: snapshot.assets.map(adaptMarketAsset),
    macroIndicators: snapshot.macroIndicators.map(adaptMacroIndicator),
  };
}
