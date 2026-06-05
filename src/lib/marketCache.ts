import { getDb } from "./mongodb";
import { getMarketSnapshot, setMarketSnapshot } from "./kv";
import type { ArenaMarketSnapshot } from "../types";

const META_KEY = "market_status";
const MAX_AGE_MS = 40 * 60 * 1000; // 40 min — snapshot considered fresh (30 min cycle + buffer)

interface MarketMeta {
  key: string;
  status: "fetching" | "ready";
  snapshot: ArenaMarketSnapshot | null;
  updatedAt: string;
}

// ── Internal helpers ─────────────────────────────────────────────────────

async function getMeta(): Promise<MarketMeta | null> {
  try {
    const db = await getDb();
    const doc = await db.collection<MarketMeta>("market_meta").findOne({ key: META_KEY });
    return doc ?? null;
  } catch (err) {
    console.error("[marketCache] getMeta error:", err);
    return null;
  }
}

async function setMeta(status: "fetching" | "ready", snapshot?: ArenaMarketSnapshot): Promise<void> {
  try {
    const db = await getDb();
    await db
      .collection<MarketMeta>("market_meta")
      .replaceOne(
        { key: META_KEY },
        { key: META_KEY, status, snapshot: snapshot ?? null, updatedAt: new Date().toISOString() },
        { upsert: true }
      );
  } catch (err) {
    console.error("[marketCache] setMeta error:", err);
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Returns the current market snapshot ONLY if it is fresh and not being updated.
 * Returns `null` if a fetch is in progress or the data is stale (>20 min).
 * This is the single source of truth for all pricing data in The Arena.
 */
export async function getCurrentMarketSnapshot(): Promise<ArenaMarketSnapshot | null> {
  const meta = await getMeta();

  // If a batch fetch is currently running, block consumers
  if (meta?.status === "fetching") {
    console.warn("[marketCache] Market snapshot update in progress — consumers should wait.");
    return null;
  }

  // Prefer the meta snapshot (written atomically with status=ready)
  if (meta?.snapshot) {
    const ageMs = Date.now() - new Date(meta.snapshot.timestamp).getTime();
    if (ageMs <= MAX_AGE_MS) {
      return meta.snapshot;
    }
    console.warn(`[marketCache] Meta snapshot stale (${Math.round(ageMs / 60_000)}m old)`);
  }

  // Fallback to legacy market_snapshots collection
  const legacy = await getMarketSnapshot();
  if (legacy) {
    const ageMs = Date.now() - new Date(legacy.timestamp).getTime();
    if (ageMs <= MAX_AGE_MS) {
      return legacy;
    }
    console.warn(`[marketCache] Legacy snapshot stale (${Math.round(ageMs / 60_000)}m old)`);
  }

  return null;
}

/**
 * Force-read the latest snapshot regardless of freshness. Used for admin/debug.
 */
export async function getAnyMarketSnapshot(): Promise<ArenaMarketSnapshot | null> {
  const meta = await getMeta();
  if (meta?.snapshot) return meta.snapshot;
  return getMarketSnapshot();
}

/**
 * Batch-fetch fresh market data from Finnhub, write it atomically as the
 * new source-of-truth, and mark it ready. Trading is paused while this runs.
 */
export async function refreshMarketSnapshot(): Promise<ArenaMarketSnapshot> {
  const meta = await getMeta();
  if (meta?.status === "fetching") {
    console.warn("[marketCache] Refresh already in progress — skipping duplicate.");
    throw new Error("Market snapshot refresh already in progress");
  }

  console.log("[marketCache] Locking market data for batch fetch...");
  await setMeta("fetching");

  try {
    const { default: fetchMarketSnapshot } = await import("./marketData");
    const snapshot = await fetchMarketSnapshot();
    await setMarketSnapshot(snapshot);
    await setMeta("ready", snapshot);
    console.log(`[marketCache] Snapshot refreshed: ${snapshot.assets.length} assets ready.`);
    return snapshot;
  } catch (err) {
    // Unlock on failure so the system doesn't stay frozen
    await setMeta("ready");
    console.error("[marketCache] Refresh failed, unlocked market data:", err);
    throw err;
  }
}
