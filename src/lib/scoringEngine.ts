import { z } from "zod";
import { callModel } from "./llmClient";
import { getTradeHistory, getModelState, setModelScores, setLeaderboard } from "./kv";
import { TRADER_MODELS, CENTRAL_BANK_MODEL } from "./models";
import type { ArenaModelScores, ArenaTrade } from "../types";

const CBEvalSchema = z.object({
  disciplineScore: z.number().min(0).max(100),
  adaptabilityScore: z.number().min(0).max(100),
  riskAppetiteScore: z.number().min(0).max(100),
  reasoning: z.string().min(1),
});

export function calculateMathScore(
  trades: ArenaTrade[],
  model: NonNullable<Awaited<ReturnType<typeof getModelState>>>
): number {
  if (trades.length === 0) return 50;

  const closed = trades.filter((t) => t.realizedPnl !== undefined);
  const totalPnl = closed.reduce((s, t) => s + (t.realizedPnl ?? 0), 0);
  const pnlVsStart = model.startingBalance > 0 ? (totalPnl / model.startingBalance) * 100 : 0;
  const pnlScore = Math.min(100, Math.max(0, 50 + pnlVsStart));

  const wins = closed.filter((t) => (t.realizedPnl ?? 0) > 0).length;
  const winRate = closed.length > 0 ? (wins / closed.length) * 100 : 50;
  const winScore = Math.min(100, winRate);

  // Drawdown: largest consecutive loss streak as % of starting balance
  let maxDrawdown = 0;
  let runningLoss = 0;
  for (const t of closed) {
    if ((t.realizedPnl ?? 0) < 0) {
      runningLoss += Math.abs(t.realizedPnl ?? 0);
      maxDrawdown = Math.max(maxDrawdown, runningLoss);
    } else {
      runningLoss = 0;
    }
  }
  const drawdownPct = model.startingBalance > 0 ? (maxDrawdown / model.startingBalance) * 100 : 0;
  const drawdownScore = Math.max(0, 100 - drawdownPct);

  // Activity bonus
  const activityScore = Math.min(100, trades.length * 2);

  return pnlScore * 0.4 + winScore * 0.3 + drawdownScore * 0.2 + activityScore * 0.1;
}

export async function runCentralBankEvaluation(
  modelId: string
): Promise<{
  disciplineScore: number;
  adaptabilityScore: number;
  riskAppetiteScore: number;
  reasoning: string;
}> {
  const trades = (await getTradeHistory(modelId)).slice(-50);
  const model = await getModelState(modelId);
  if (!model)
    return {
      disciplineScore: 50,
      adaptabilityScore: 50,
      riskAppetiteScore: 50,
      reasoning: "No data",
    };

  const tradeSummary = trades
    .map(
      (t) =>
        `${t.action} ${t.asset} $${t.sizeUsd} | ` +
        `PnL: ${t.realizedPnl !== undefined ? "$" + t.realizedPnl.toFixed(2) : "open"} | ` +
        `${t.executedAt}`
    )
    .join("\n");

  const assetClasses = [...new Set(trades.map((t) => t.assetClass))].join(", ");

  const systemPrompt = `You are the Central Bank evaluator of The Arena.
You assess trader AI models on three dimensions based solely on their trading history.
You cannot give trading advice. You are scoring past behavior only.
Score each dimension 0–100.
Discipline: Did the model respect position limits, avoid reckless sizing,
stay rational under pressure?
Adaptability: Did it shift strategies as conditions changed?
Did it trade across multiple asset classes?
Risk Appetite: Did it take calculated aggressive positions when opportunity arose?
Or was it too passive?
Respond with ONLY valid JSON. No markdown.
{
  "disciplineScore": 0-100,
  "adaptabilityScore": 0-100,
  "riskAppetiteScore": 0-100,
  "reasoning": "assessment covering all three dimensions, minimum 60 words"
}`;

  const userPrompt = `TRADER: ${model.name}
Current balance: $${model.balance.toFixed(2)}
Starting balance: $${model.startingBalance}
Insolvent: ${model.isInsolvent ? "YES" : "No"}
Asset classes traded: ${assetClasses || "none"}
Total trades evaluated: ${trades.length}

TRADE HISTORY (last 50):
${tradeSummary || "No trades recorded"}

Score this trader's behavior across all three dimensions.`;

  const raw = await callModel(CENTRAL_BANK_MODEL.id, systemPrompt, userPrompt);

  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    return CBEvalSchema.parse(JSON.parse(cleaned));
  } catch {
    console.error(`[scoringEngine] Failed to parse CB eval for ${modelId}`);
    return {
      disciplineScore: 50,
      adaptabilityScore: 50,
      riskAppetiteScore: 50,
      reasoning: "Evaluation failed",
    };
  }
}

export function calculateCompositeScore(
  mathScore: number,
  cbScores: {
    disciplineScore: number;
    adaptabilityScore: number;
    riskAppetiteScore: number;
  }
): number {
  const cbAvg = (cbScores.disciplineScore + cbScores.adaptabilityScore + cbScores.riskAppetiteScore) / 3;
  return Math.round(mathScore * 0.7 + cbAvg * 0.3);
}

export async function updateLeaderboard(): Promise<void> {
  const entries = await Promise.all(
    TRADER_MODELS.map(async (m) => {
      const scores = await import("./kv").then((kv) => kv.getModelScores(m.id));
      return {
        modelId: m.id,
        compositeScore: scores?.compositeScore ?? 0,
      };
    })
  );

  const ranked = entries
    .sort((a, b) => b.compositeScore - a.compositeScore)
    .map((e, i) => ({ ...e, rank: i + 1 }));

  await setLeaderboard(ranked);
}

export async function runFullScoringUpdate(): Promise<void> {
  for (const model of TRADER_MODELS) {
    const trades = await getTradeHistory(model.id);
    const state = await getModelState(model.id);
    if (!state) continue;

    const mathScore = calculateMathScore(trades, state);
    const cbEval = await runCentralBankEvaluation(model.id);
    const compositeScore = calculateCompositeScore(mathScore, cbEval);

    const scores: ArenaModelScores = {
      modelId: model.id,
      compositeScore,
      pnlScore: mathScore,
      disciplineScore: cbEval.disciplineScore,
      adaptabilityScore: cbEval.adaptabilityScore,
      riskAppetiteScore: cbEval.riskAppetiteScore,
      lastEvaluatedAt: new Date().toISOString(),
    };

    await setModelScores(scores);
  }

  await updateLeaderboard();
}
