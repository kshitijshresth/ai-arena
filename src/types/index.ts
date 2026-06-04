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
