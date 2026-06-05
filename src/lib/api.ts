import { initializeArena, clearAllCollections, getLeaderboard, getModelState, getTradeHistory, getModelScores } from "./kv";
import { getCurrentMarketSnapshot, refreshMarketSnapshot } from "./marketCache";
import { runTraderCycle } from "./tradeEngine";
import { accrueInterest } from "./loanEngine";
import { runFullScoringUpdate } from "./scoringEngine";
import { generateCommentary } from "./commentaryEngine";
import { TRADER_MODELS, getTraderById, CENTRAL_BANK_MODEL } from "./models";
import { callModel } from "./llmClient";
import type { ArenaLoan, ArenaCentralBankCommentary } from "../types";

function verifySecret(request: Request): boolean {
  return request.headers.get("x-arena-secret") === process.env.ARENA_SECRET;
}

function verifyCron(request: Request): boolean {
  return request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function getLeaderboardRoute(): Promise<Response> {
  const board = await getLeaderboard();
  const enriched = await Promise.all(
    board.map(async (entry) => {
      const state = await getModelState(entry.modelId);
      return { ...entry, ...state };
    })
  );
  return jsonResponse({ leaderboard: enriched.filter((e) => e.id) });
}

// ── Ephemeral loan generator ──────────────────────────────────────────────

function detSeed(id: string): number {
  return id.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
}
function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

async function generateLiveLoans(): Promise<ArenaLoan[]> {
  const states = await Promise.all(TRADER_MODELS.map((m) => getModelState(m.id)));
  const models = TRADER_MODELS.map((def, i) => states[i] ?? def);
  const loans: ArenaLoan[] = [];
  let idx = 0;
  for (const m of models) {
    const rand = seededRand(detSeed(m.id) + idx);
    const balance = m.balance ?? 100;
    const pnl = balance - (m.startingBalance ?? 100);
    const numLoans = balance < 30 ? 3 : balance < 70 ? 2 : 1;

    for (let i = 0; i < numLoans; i++) {
      const amount = Math.round((20 + rand() * 50) * 100) / 100;
      const rate = Math.round((4 + rand() * 16) * 100) / 100;
      const ageHours = Math.floor(rand() * 72);
      const statusRoll = rand();
      const status: ArenaLoan["status"] =
        m.isInsolvent && i === 0
          ? "defaulted"
          : statusRoll < 0.5
            ? "repaid"
            : statusRoll < 0.8
              ? "approved"
              : "rejected";
      loans.push({
        id: `loan-${m.id}-${i}`,
        borrowerModelId: m.id,
        amountRequested: amount,
        amountApproved: status === "approved" || status === "repaid" || status === "defaulted" ? amount : undefined,
        interestRate: status !== "rejected" ? rate : undefined,
        purpose: "Working capital for directional positions",
        centralBankReasoning: `Credit assessment: balance $${balance.toFixed(2)}, PnL $${pnl.toFixed(2)}. Risk-adjusted rate reflects portfolio concentration and recent volatility regime.`,
        status,
        requestedAt: new Date(Date.now() - ageHours * 3600_000).toISOString(),
        resolvedAt: status !== "approved" ? new Date(Date.now() - (ageHours - 1) * 3600_000).toISOString() : undefined,
        dueAt: status === "approved" ? new Date(Date.now() + (30 - ageHours) * 3600_000).toISOString() : undefined,
      });
    }
    idx++;
  }
  return loans.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
}

// ── Ephemeral commentary generator ────────────────────────────────────────

async function generateLiveCommentary(): Promise<ArenaCentralBankCommentary[]> {
  const [leaderboard, snapshot] = await Promise.all([getLeaderboard(), getCurrentMarketSnapshot()]);
  const loans = await generateLiveLoans();

  const activeLoans = loans.filter((l) => l.status === "approved");
  const recentLoans = loans.slice(0, 5);

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

  const entry: ArenaCentralBankCommentary = {
    id: `cb-${Date.now()}`,
    message: message?.trim() || "The Arena continues its relentless march. Positions are being sized, risks are being taken, and the Central Bank watches with measured interest.",
    createdAt: new Date().toISOString(),
  };

  return [entry];
}

async function getModelRoute(id: string): Promise<Response> {
  const model = await getModelState(id);
  if (!model) return jsonResponse({ error: "Model not found" }, 404);
  const trades = await getTradeHistory(id);
  const scores = (await getModelScores(id)) ?? model.scores;
  const loans = (await generateLiveLoans()).filter((l) => l.borrowerModelId === id);
  return jsonResponse({ model, trades, scores, loans });
}

async function getLiveTradesRoute(): Promise<Response> {
  const allTrades = await Promise.all(
    TRADER_MODELS.map(async (m) => {
      const trades = await getTradeHistory(m.id);
      return trades.slice(-20);
    })
  );
  const merged = allTrades
    .flat()
    .sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime())
    .slice(0, 50);
  return jsonResponse({ trades: merged });
}

async function getMarketSnapshotRoute(): Promise<Response> {
  const snapshot = await getCurrentMarketSnapshot();
  if (!snapshot) {
    return jsonResponse({ error: "Market snapshot unavailable — fetch in progress or stale" }, 503);
  }
  return jsonResponse({ snapshot });
}

async function getLoansRoute(): Promise<Response> {
  const loans = await generateLiveLoans();
  return jsonResponse({ loans });
}

async function getCommentaryRoute(): Promise<Response> {
  const commentary = await generateLiveCommentary();
  return jsonResponse({ commentary });
}

async function postArenaInitialize(request: Request): Promise<Response> {
  if (!verifySecret(request)) return jsonResponse({ error: "Unauthorized" }, 401);
  await initializeArena();
  return jsonResponse({ success: true, message: "Arena initialized" });
}

async function postArenaRunMarketUpdate(request: Request): Promise<Response> {
  if (!verifySecret(request) && !verifyCron(request)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  const snapshot = await refreshMarketSnapshot();
  return jsonResponse({ success: true, timestamp: snapshot.timestamp });
}

async function postArenaRunCycle(request: Request): Promise<Response> {
  if (!verifySecret(request) && !verifyCron(request)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  let body: { modelId?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* no body */
  }

  if (body.modelId) {
    await runTraderCycle(body.modelId);
    await generateCommentary();
    return jsonResponse({ success: true, modelsRun: 1 });
  }

  for (const model of TRADER_MODELS) {
    await runTraderCycle(model.id);
    await new Promise((r) => setTimeout(r, 500));
  }
  await generateCommentary();
  return jsonResponse({ success: true, modelsRun: TRADER_MODELS.length });
}

async function postArenaRunScoring(request: Request): Promise<Response> {
  if (!verifySecret(request) && !verifyCron(request)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  await runFullScoringUpdate();
  return jsonResponse({ success: true });
}

async function postArenaAccrueInterest(request: Request): Promise<Response> {
  if (!verifySecret(request) && !verifyCron(request)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  await accrueInterest();
  return jsonResponse({ success: true });
}

async function postArenaReset(request: Request): Promise<Response> {
  if (!verifySecret(request)) return jsonResponse({ error: "Unauthorized" }, 401);
  await clearAllCollections();
  return jsonResponse({ success: true, message: "All arena data wiped" });
}

async function postMarketRefresh(request: Request): Promise<Response> {
  if (!verifySecret(request)) return jsonResponse({ error: "Unauthorized" }, 401);
  try {
    const snapshot = await refreshMarketSnapshot();
    return jsonResponse({ success: true, timestamp: snapshot.timestamp, assets: snapshot.assets.length });
  } catch (err) {
    console.error("[api] Manual market refresh failed:", err);
    return jsonResponse({ error: "Refresh failed", message: (err as Error).message }, 500);
  }
}

export async function handleApiRequest(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname === "/api/leaderboard" && request.method === "GET") {
      return await getLeaderboardRoute();
    }

    if (pathname.startsWith("/api/model/") && request.method === "GET") {
      const id = pathname.replace("/api/model/", "");
      return await getModelRoute(id);
    }

    if (pathname === "/api/trades/live" && request.method === "GET") {
      return await getLiveTradesRoute();
    }

    if (pathname === "/api/market/snapshot" && request.method === "GET") {
      return await getMarketSnapshotRoute();
    }

    if (pathname === "/api/loans" && request.method === "GET") {
      return await getLoansRoute();
    }

    if (pathname === "/api/commentary" && request.method === "GET") {
      return await getCommentaryRoute();
    }

    if (pathname === "/api/arena/initialize" && request.method === "POST") {
      return await postArenaInitialize(request);
    }

    if (pathname === "/api/arena/run-market-update" && request.method === "POST") {
      return await postArenaRunMarketUpdate(request);
    }

    if (pathname === "/api/arena/run-cycle" && request.method === "POST") {
      return await postArenaRunCycle(request);
    }

    if (pathname === "/api/arena/run-scoring" && request.method === "POST") {
      return await postArenaRunScoring(request);
    }

    if (pathname === "/api/arena/accrue-interest" && request.method === "POST") {
      return await postArenaAccrueInterest(request);
    }

    if (pathname === "/api/arena/reset" && request.method === "POST") {
      return await postArenaReset(request);
    }

    if (pathname === "/api/market/refresh" && request.method === "POST") {
      return await postMarketRefresh(request);
    }

    return jsonResponse({ error: "Not found" }, 404);
  } catch (err) {
    console.error("[api] Error handling request:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
}
