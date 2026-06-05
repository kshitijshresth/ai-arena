import { callModel } from "./llmClient";
import { getLeaderboard, getLoanLedger, appendCommentary } from "./kv";
import { getCurrentMarketSnapshot } from "./marketCache";
import { CENTRAL_BANK_MODEL, getTraderById } from "./models";
import type { ArenaCentralBankCommentary } from "../types";

export async function generateCommentary(): Promise<void> {
  const leaderboard = await getLeaderboard();
  const loans = await getLoanLedger();
  const snapshot = await getCurrentMarketSnapshot();

  const activeLoans = loans.filter((l) => l.status === "approved");
  const recentLoans = loans.slice(-5);

  const leaderboardStr = leaderboard
    .map((e) => {
      const m = getTraderById(e.modelId);
      return `${e.rank}. ${m?.name ?? e.modelId}: score ${e.compositeScore}`;
    })
    .join("\n");

  const systemPrompt = `You are the Central Bank narrator of The Arena.
You provide color commentary on the state of the trading competition.
You are observant, dry, occasionally sardonic — like a Bloomberg anchor.
You do NOT give trading advice. You do NOT tell any model what to trade.
You comment on what has ALREADY happened: who is leading, who is struggling,
loan activity, market conditions, interesting patterns you observe.
Keep commentary under 120 words. Be specific. Name models. Be interesting.
Respond with plain text only — no JSON, no markdown.`;

  const userPrompt = `CURRENT LEADERBOARD:
${leaderboardStr}

ACTIVE LOANS: ${activeLoans.length} outstanding
RECENT LOAN ACTIVITY (last 5):
${recentLoans
  .map(
    (l) =>
      `${getTraderById(l.borrowerModelId)?.name ?? l.borrowerModelId}: ` +
      `requested $${l.amountRequested} — ${l.status}` +
      (l.interestRate ? ` at ${l.interestRate}%` : "")
  )
  .join("\n")}

MARKET (top movers):
${(snapshot?.assets ?? [])
  .sort((a, b) => Math.abs(b.changePercent24h) - Math.abs(a.changePercent24h))
  .slice(0, 5)
  .map((a) => `${a.symbol}: ${a.changePercent24h >= 0 ? "+" : ""}${a.changePercent24h.toFixed(2)}%`)
  .join(" | ")}

Provide a brief commentary on the current state of The Arena.`;

  const message = await callModel(CENTRAL_BANK_MODEL.id, systemPrompt, userPrompt);

  if (!message) return;

  const entry: ArenaCentralBankCommentary = {
    id: `cb-${Date.now()}`,
    message: message.trim(),
    createdAt: new Date().toISOString(),
  };

  await appendCommentary(entry);
}
