import { z } from "zod";
import { callModel } from "./llmClient";
import { getModelState, setModelState, appendTrade, getTradeHistory } from "./kv";
import { getCurrentMarketSnapshot } from "./marketCache";
import type { ArenaTrade, ArenaPosition } from "../types";

const TradeDecisionSchema = z.object({
  action: z.enum(["BUY", "SELL", "HOLD", "LOAN_REQUEST"]),
  asset: z.string().optional(),
  assetClass: z.enum(["stock", "forex", "commodity", "crypto"]).optional(),
  sizeUsd: z.number().positive().optional(),
  reasoning: z.string().min(1),
  loanRequest: z
    .object({
      amount: z.number().positive(),
      purpose: z.string(),
    })
    .optional(),
});

export async function runTraderCycle(modelId: string): Promise<void> {
  const model = await getModelState(modelId);
  if (!model || model.isCentralBank) return;

  const snapshot = await getCurrentMarketSnapshot();
  if (!snapshot) {
    console.warn(`[tradeEngine] Trading paused for ${modelId}: market snapshot unavailable (fetch in progress or stale)`);
    return;
  }

  const history = (await getTradeHistory(modelId)).slice(-20);
  const totalLoansOwed = model.loans
    .filter((l) => l.status === "approved")
    .reduce((sum, l) => sum + (l.amountApproved ?? 0), 0);

  const assetTable = snapshot.assets
    .map((a) => `${a.symbol} | $${a.price.toFixed(4)} | ${a.changePercent24h.toFixed(2)}%`)
    .join("\n");

  const macroList = snapshot.macroIndicators.map((m) => `${m.name}: ${m.value}`).join("\n");

  const positionTable =
    model.openPositions.length > 0
      ? model.openPositions
          .map(
            (p) =>
              `${p.asset} | ${p.direction.toUpperCase()} | $${p.sizeUsd} | ` +
              `entry $${p.entryPrice} | now $${p.currentPrice} | ` +
              `PnL $${p.unrealizedPnl.toFixed(2)}`
          )
          .join("\n")
      : "None";

  const tradeList =
    history.length > 0
      ? history
          .map(
            (t) =>
              `${t.action} ${t.asset} $${t.sizeUsd} @ ${t.entryPrice} | ` +
              `PnL ${t.realizedPnl !== undefined ? "$" + t.realizedPnl.toFixed(2) : "open"} | ` +
              `${t.executedAt}`
          )
          .join("\n")
      : "No trades yet";

  const systemPrompt = `You are ${model.name}, an autonomous AI trading agent competing in The Arena.
Your goal is to grow your portfolio from $100 to as much as possible.
You trade stocks, forex, commodities, and crypto using real market data.
You are competing against 9 other AI models.
You must respond with ONLY a valid JSON object. No markdown. No explanation outside the JSON.
Schema:
{
  "action": "BUY" | "SELL" | "HOLD" | "LOAN_REQUEST",
  "asset": "symbol (required for BUY/SELL)",
  "assetClass": "stock" | "forex" | "commodity" | "crypto",
  "sizeUsd": number (USD amount, required for BUY/SELL),
  "reasoning": "your reasoning, minimum 50 words",
  "loanRequest": { "amount": number, "purpose": "string" }
}
Hard rules:
- Never set sizeUsd above your available balance
- Maximum 5 open positions at once
- Minimum sizeUsd is $1
- If isInsolvent is true, maximum sizeUsd per trade is $10
- Only include loanRequest when action is LOAN_REQUEST
- Respond with valid JSON only — no prose, no markdown fences`;

  const userPrompt = `CURRENT TIME: ${new Date().toISOString()}

YOUR STATE:
Balance: $${model.balance.toFixed(2)}
Open positions: ${model.openPositions.length} / 5
Insolvent: ${model.isInsolvent ? "YES — max $10 per trade" : "No"}
Outstanding loans: $${totalLoansOwed.toFixed(2)}

OPEN POSITIONS:
${positionTable}

RECENT TRADES (last 20):
${tradeList}

MARKET PRICES:
${assetTable}

MACRO INDICATORS:
${macroList}

LATEST NEWS:
${snapshot.newsHeadlines.map((h, i) => `${i + 1}. ${h}`).join("\n")}

Make your trading decision now. Respond with valid JSON only.`;

  const raw = await callModel(modelId, systemPrompt, userPrompt);
  if (!raw) return;

  let decision;
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    decision = TradeDecisionSchema.parse(JSON.parse(cleaned));
  } catch (err) {
    console.error(`[tradeEngine] Failed to parse decision for ${modelId}:`, err);
    return;
  }

  if (decision.action === "LOAN_REQUEST" && decision.loanRequest) {
    const { runLoanCycle } = await import("./loanEngine");
    await runLoanCycle(modelId, decision.loanRequest);
    return;
  }

  const now = new Date().toISOString();
  const tradeId = `${modelId}-${Date.now()}`;
  const updatedModel = { ...model };

  if (decision.action === "BUY" && decision.asset && decision.sizeUsd) {
    const maxSize = model.isInsolvent ? 10 : model.balance;
    const size = Math.min(decision.sizeUsd, maxSize);
    if (size < 1 || model.balance < size) return;
    if (model.openPositions.length >= 5) return;

    const assetData = snapshot.assets.find((a) => a.symbol === decision.asset);
    const entryPrice = assetData?.price ?? 1;

    const position: ArenaPosition = {
      id: tradeId,
      modelId,
      asset: decision.asset,
      assetClass: decision.assetClass ?? "stock",
      direction: "long",
      sizeUsd: size,
      entryPrice,
      currentPrice: entryPrice,
      openedAt: now,
      unrealizedPnl: 0,
    };

    updatedModel.balance -= size;
    updatedModel.openPositions = [...model.openPositions, position];

    await appendTrade({
      id: tradeId,
      modelId,
      asset: decision.asset,
      assetClass: decision.assetClass ?? "stock",
      action: "BUY",
      sizeUsd: size,
      entryPrice,
      reasoning: decision.reasoning,
      executedAt: now,
    });
  } else if (decision.action === "SELL" && decision.asset) {
    const posIdx = model.openPositions.findIndex((p) => p.asset === decision.asset);
    if (posIdx === -1) {
      // No open position — short sell (record as SELL trade without position tracking)
      const assetData = snapshot.assets.find((a) => a.symbol === decision.asset);
      const entryPrice = assetData?.price ?? 1;
      const size = Math.min(decision.sizeUsd ?? 10, model.isInsolvent ? 10 : model.balance);
      if (size < 1) return;

      await appendTrade({
        id: tradeId,
        modelId,
        asset: decision.asset,
        assetClass: decision.assetClass ?? "stock",
        action: "SELL",
        sizeUsd: size,
        entryPrice,
        reasoning: decision.reasoning,
        executedAt: now,
      });
    } else {
      // Close existing long position
      const pos = model.openPositions[posIdx];
      const assetData = snapshot.assets.find((a) => a.symbol === decision.asset);
      const exitPrice = assetData?.price ?? pos.currentPrice;
      const realizedPnl = ((exitPrice - pos.entryPrice) / pos.entryPrice) * pos.sizeUsd;

      updatedModel.balance += pos.sizeUsd + realizedPnl;
      updatedModel.openPositions = model.openPositions.filter((_, i) => i !== posIdx);

      await appendTrade({
        id: tradeId,
        modelId,
        asset: decision.asset,
        assetClass: pos.assetClass,
        action: "SELL",
        sizeUsd: pos.sizeUsd,
        entryPrice: pos.entryPrice,
        exitPrice,
        realizedPnl,
        reasoning: decision.reasoning,
        executedAt: now,
        closedAt: now,
      });
    }
  } else if (decision.action === "HOLD") {
    await appendTrade({
      id: tradeId,
      modelId,
      asset: decision.asset ?? "HOLD",
      assetClass: decision.assetClass ?? "stock",
      action: "HOLD",
      sizeUsd: 0,
      entryPrice: 0,
      reasoning: decision.reasoning,
      executedAt: now,
    });
  }

  // Check insolvency
  if (updatedModel.balance <= 0 && updatedModel.openPositions.length === 0) {
    updatedModel.isInsolvent = true;
  }

  await setModelState(updatedModel);
  const { updateLeaderboard } = await import("./scoringEngine");
  await updateLeaderboard();
}
