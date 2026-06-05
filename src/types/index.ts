export type Provider = "GROQ" | "NIM";
export type TradeAction = "BUY" | "SELL" | "HOLD";
export type LoanStatus = "ACTIVE" | "REPAID" | "DEFAULTED";

export interface Trade {
  id: string;
  modelId: string;
  modelName: string;
  timestamp: number;
  action: TradeAction;
  asset: string;
  size: number;
  entryPrice: number;
  exitPrice?: number;
  realizedPnl?: number;
  pnlImpact: number;
  reasoning: string;
}

export interface Position {
  id: string;
  asset: string;
  direction: "LONG" | "SHORT";
  size: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  openedAt: number;
}

export interface Score {
  composite: number;
  discipline: number;
  adaptability: number;
  riskAppetite: number;
}

export interface Model {
  id: string;
  name: string;
  provider: Provider;
  color: string;
  balance: number;
  pnl: number;
  startingBalance: number;
  winRate: number;
  openPositions: Position[];
  loansOutstanding: number;
  insolvent: boolean;
  restricted: boolean;
  score: Score;
  pnlHistory: { t: number; v: number }[];
  trades: Trade[];
}

export interface Loan {
  id: string;
  modelId: string;
  modelName: string;
  amount: number;
  rate: number;
  status: LoanStatus;
  issuedAt: number;
  dueAt: number;
  bankResponse: string;
  approved: boolean;
}

export interface MarketAsset {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  spark: number[];
}

export interface MacroIndicator {
  name: string;
  value: string;
  updated: number;
}

export interface Commentary {
  id: string;
  timestamp: number;
  message: string;
}

// ── Arena Backend Types (new) ─────────────────────────────

export interface ArenaTraderModel {
  id: string;
  name: string;
  provider: "groq" | "nim";
  apiModel: string;
  balance: number;
  startingBalance: number;
  isInsolvent: boolean;
  isCentralBank: boolean;
  openPositions: ArenaPosition[];
  loans: ArenaLoan[];
  scores: ArenaModelScores;
}

export interface ArenaPosition {
  id: string;
  modelId: string;
  asset: string;
  assetClass: "stock" | "forex" | "commodity" | "crypto";
  direction: "long" | "short";
  sizeUsd: number;
  entryPrice: number;
  currentPrice: number;
  openedAt: string;
  unrealizedPnl: number;
}

export interface ArenaTrade {
  id: string;
  modelId: string;
  asset: string;
  assetClass: "stock" | "forex" | "commodity" | "crypto";
  action: "BUY" | "SELL" | "HOLD";
  sizeUsd: number;
  entryPrice: number;
  exitPrice?: number;
  realizedPnl?: number;
  reasoning: string;
  executedAt: string;
  closedAt?: string;
}

export interface ArenaLoan {
  id: string;
  borrowerModelId: string;
  amountRequested: number;
  amountApproved?: number;
  interestRate?: number;
  purpose: string;
  centralBankReasoning: string;
  status: "pending" | "approved" | "rejected" | "repaid" | "defaulted";
  requestedAt: string;
  resolvedAt?: string;
  dueAt?: string;
}

export interface ArenaModelScores {
  modelId: string;
  compositeScore: number;
  pnlScore: number;
  disciplineScore: number;
  adaptabilityScore: number;
  riskAppetiteScore: number;
  lastEvaluatedAt: string;
}

export interface ArenaMarketSnapshot {
  timestamp: string;
  assets: ArenaAssetPrice[];
  macroIndicators: ArenaMacroIndicator[];
  newsHeadlines: string[];
}

export interface ArenaAssetPrice {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  assetClass: "stock" | "forex" | "commodity" | "crypto";
}

export interface ArenaMacroIndicator {
  name: string;
  value: string;
  lastUpdated: string;
}

export interface ArenaTradeDecision {
  action: "BUY" | "SELL" | "HOLD" | "LOAN_REQUEST";
  asset?: string;
  assetClass?: "stock" | "forex" | "commodity" | "crypto";
  sizeUsd?: number;
  reasoning: string;
  loanRequest?: {
    amount: number;
    purpose: string;
  };
}

export interface ArenaLoanDecision {
  approved: boolean;
  amountApproved?: number;
  interestRate?: number;
  reasoning: string;
}

export interface ArenaCentralBankCommentary {
  id: string;
  message: string;
  createdAt: string;
}

export interface ArenaLeaderboardEntry {
  modelId: string;
  rank: number;
  compositeScore: number;
}
