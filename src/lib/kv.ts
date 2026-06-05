import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";
import type {
  ArenaTraderModel,
  ArenaTrade,
  ArenaLoan,
  ArenaModelScores,
  ArenaMarketSnapshot,
  ArenaCentralBankCommentary,
  ArenaLeaderboardEntry,
} from "../types";
import { TRADER_MODELS } from "./models";

const COLLECTIONS = {
  arenaSeasons: "arena_seasons",
  modelStates: "model_states",
  trades: "trades",
  loans: "loans",
  marketSnapshots: "market_snapshots",
  commentary: "commentary",
  leaderboard: "leaderboard",
} as const;

// ── Model State ───────────────────────────────────────────────────────────

export async function getModelState(modelId: string): Promise<ArenaTraderModel | null> {
  try {
    const db = await getDb();
    const doc = await db.collection<ArenaTraderModel>(COLLECTIONS.modelStates).findOne({ id: modelId });
    return doc ?? null;
  } catch (err) {
    console.error("[mongo] getModelState error:", err);
    return null;
  }
}

export async function setModelState(model: ArenaTraderModel): Promise<void> {
  try {
    const db = await getDb();
    await db.collection(COLLECTIONS.modelStates).replaceOne({ id: model.id }, model, { upsert: true });
  } catch (err) {
    console.error("[mongo] setModelState error:", err);
  }
}

// ── Text truncation helpers ───────────────────────────────────────────────

function truncateReasoning(text: string, maxLen = 200): string {
  if (!text || text.length <= maxLen) return text ?? "";
  return text.slice(0, maxLen) + "…";
}
function truncateMessage(text: string, maxLen = 300): string {
  if (!text || text.length <= maxLen) return text ?? "";
  return text.slice(0, maxLen) + "…";
}

// ── Trades ────────────────────────────────────────────────────────────────

const MAX_TRADES_PER_MODEL = 50;

export async function appendTrade(trade: ArenaTrade): Promise<void> {
  try {
    const db = await getDb();
    const lean: ArenaTrade = {
      ...trade,
      reasoning: truncateReasoning(trade.reasoning),
    };
    await db.collection(COLLECTIONS.trades).insertOne(lean as unknown as Document);

    // Trim to last N trades for this model
    const excess = await db
      .collection<ArenaTrade>(COLLECTIONS.trades)
      .find({ modelId: trade.modelId })
      .sort({ executedAt: -1 })
      .skip(MAX_TRADES_PER_MODEL)
      .toArray();
    if (excess.length > 0) {
      const ids = excess.map((d) => (d as unknown as { _id: ObjectId })._id);
      await db.collection(COLLECTIONS.trades).deleteMany({ _id: { $in: ids } });
      console.log(`[mongo] Trimmed ${excess.length} old trades for model ${trade.modelId}`);
    }
  } catch (err) {
    console.error("[mongo] appendTrade error:", err);
  }
}

export async function getTradeHistory(modelId: string): Promise<ArenaTrade[]> {
  try {
    const db = await getDb();
    const docs = await db
      .collection<ArenaTrade>(COLLECTIONS.trades)
      .find({ modelId })
      .sort({ executedAt: -1 })
      .limit(MAX_TRADES_PER_MODEL)
      .toArray();
    return docs;
  } catch (err) {
    console.error("[mongo] getTradeHistory error:", err);
    return [];
  }
}

// ── Scores ────────────────────────────────────────────────────────────────

export async function getModelScores(modelId: string): Promise<ArenaModelScores | null> {
  try {
    const db = await getDb();
    const doc = await db
      .collection<ArenaTraderModel>(COLLECTIONS.modelStates)
      .findOne({ id: modelId }, { projection: { scores: 1, _id: 0 } });
    return doc?.scores ?? null;
  } catch (err) {
    console.error("[mongo] getModelScores error:", err);
    return null;
  }
}

export async function setModelScores(scores: ArenaModelScores): Promise<void> {
  try {
    const db = await getDb();
    await db
      .collection(COLLECTIONS.modelStates)
      .updateOne({ id: scores.modelId }, { $set: { scores } });
  } catch (err) {
    console.error("[mongo] setModelScores error:", err);
  }
}

// ── Loans ─────────────────────────────────────────────────────────────────

export async function getLoanLedger(): Promise<ArenaLoan[]> {
  try {
    const db = await getDb();
    const docs = await db
      .collection<ArenaLoan>(COLLECTIONS.loans)
      .find()
      .sort({ requestedAt: -1 })
      .toArray();
    return docs;
  } catch (err) {
    console.error("[mongo] getLoanLedger error:", err);
    return [];
  }
}

export async function appendLoan(loan: ArenaLoan): Promise<void> {
  try {
    const db = await getDb();
    const lean: ArenaLoan = {
      ...loan,
      centralBankReasoning: truncateReasoning(loan.centralBankReasoning),
    };
    await db.collection(COLLECTIONS.loans).insertOne(lean as unknown as Document);

    // Prune old resolved loans: keep all active/pending, plus last 20 resolved
    const resolved = await db
      .collection<ArenaLoan>(COLLECTIONS.loans)
      .find({ status: { $in: ["repaid", "rejected", "defaulted"] } })
      .sort({ requestedAt: -1 })
      .skip(20)
      .toArray();
    if (resolved.length > 0) {
      const ids = resolved.map((d) => (d as unknown as { _id: ObjectId })._id);
      await db.collection(COLLECTIONS.loans).deleteMany({ _id: { $in: ids } });
      console.log(`[mongo] Pruned ${resolved.length} old resolved loans`);
    }
  } catch (err) {
    console.error("[mongo] appendLoan error:", err);
  }
}

export async function updateLoan(loanId: string, updates: Partial<ArenaLoan>): Promise<void> {
  try {
    const db = await getDb();
    await db.collection(COLLECTIONS.loans).updateOne({ id: loanId }, { $set: updates });
  } catch (err) {
    console.error("[mongo] updateLoan error:", err);
  }
}

// ── Market Snapshot ───────────────────────────────────────────────────────

export async function getMarketSnapshot(): Promise<ArenaMarketSnapshot | null> {
  try {
    const db = await getDb();
    const doc = await db.collection<{ key: string; snapshot: ArenaMarketSnapshot }>(COLLECTIONS.marketSnapshots).findOne({ key: "latest" });
    return doc?.snapshot ?? null;
  } catch (err) {
    console.error("[mongo] getMarketSnapshot error:", err);
    return null;
  }
}

export async function setMarketSnapshot(snapshot: ArenaMarketSnapshot): Promise<void> {
  try {
    const db = await getDb();
    await db
      .collection(COLLECTIONS.marketSnapshots)
      .replaceOne({ key: "latest" }, { key: "latest", snapshot }, { upsert: true });
  } catch (err) {
    console.error("[mongo] setMarketSnapshot error:", err);
  }
}

// ── Commentary ──────────────────────────────────────────────────────────

const MAX_COMMENTARY = 50;

export async function appendCommentary(entry: ArenaCentralBankCommentary): Promise<void> {
  try {
    const db = await getDb();
    const lean: ArenaCentralBankCommentary = {
      ...entry,
      message: truncateMessage(entry.message),
    };
    await db.collection(COLLECTIONS.commentary).insertOne(lean as unknown as Document);
    // Trim to last N entries
    const excess = await db
      .collection<ArenaCentralBankCommentary>(COLLECTIONS.commentary)
      .find()
      .sort({ createdAt: -1 })
      .skip(MAX_COMMENTARY)
      .toArray();
    if (excess.length > 0) {
      const ids = excess.map((d) => (d as unknown as { _id: ObjectId })._id);
      await db.collection(COLLECTIONS.commentary).deleteMany({ _id: { $in: ids } });
      console.log(`[mongo] Trimmed ${excess.length} old commentary entries`);
    }
  } catch (err) {
    console.error("[mongo] appendCommentary error:", err);
  }
}

export async function getCommentary(): Promise<ArenaCentralBankCommentary[]> {
  try {
    const db = await getDb();
    const docs = await db
      .collection<ArenaCentralBankCommentary>(COLLECTIONS.commentary)
      .find()
      .sort({ createdAt: -1 })
      .limit(MAX_COMMENTARY)
      .toArray();
    return docs.reverse();
  } catch (err) {
    console.error("[mongo] getCommentary error:", err);
    return [];
  }
}

// ── Leaderboard ───────────────────────────────────────────────────────────

export async function getLeaderboard(): Promise<ArenaLeaderboardEntry[]> {
  try {
    const db = await getDb();
    const docs = await db
      .collection<ArenaLeaderboardEntry>(COLLECTIONS.leaderboard)
      .find()
      .sort({ rank: 1 })
      .toArray();
    return docs;
  } catch (err) {
    console.error("[mongo] getLeaderboard error:", err);
    return [];
  }
}

export async function setLeaderboard(board: ArenaLeaderboardEntry[]): Promise<void> {
  try {
    const db = await getDb();
    await db.collection(COLLECTIONS.leaderboard).deleteMany({});
    if (board.length > 0) {
      await db.collection(COLLECTIONS.leaderboard).insertMany(board as unknown as Document[]);
    }
  } catch (err) {
    console.error("[mongo] setLeaderboard error:", err);
  }
}

// ── Arena Initialization ────────────────────────────────────────────────

export async function initializeArena(): Promise<void> {
  try {
    const db = await getDb();
    const season = await db
      .collection<{ key: string; seasonId: string; startedAt: string; day: number }>(COLLECTIONS.arenaSeasons)
      .findOne({ key: "current" });
    if (!season) {
      await db.collection(COLLECTIONS.arenaSeasons).replaceOne(
        { key: "current" },
        { key: "current", seasonId: "season-1", startedAt: new Date().toISOString(), day: 1 },
        { upsert: true }
      );
    }

    for (const model of TRADER_MODELS) {
      const existing = await getModelState(model.id);
      if (!existing) {
        await setModelState(model);
      }
    }
  } catch (err) {
    console.error("[mongo] initializeArena error:", err);
  }
}

// ── Storage Audit ─────────────────────────────────────────────────────────

export async function clearAllCollections(): Promise<void> {
  try {
    const db = await getDb();
    for (const coll of Object.values(COLLECTIONS)) {
      await db.collection(coll).deleteMany({});
    }
    console.log("[mongo] All collections cleared");
  } catch (err) {
    console.error("[mongo] clearAllCollections error:", err);
  }
}

export async function storageAudit(): Promise<void> {
  try {
    const db = await getDb();
    const counts: Record<string, number> = {};
    for (const [name, coll] of Object.entries(COLLECTIONS)) {
      counts[name] = await db.collection(coll).estimatedDocumentCount();
    }
    console.log("[mongo] Storage audit:", counts);
  } catch (err) {
    console.error("[mongo] storageAudit error:", err);
  }
}
