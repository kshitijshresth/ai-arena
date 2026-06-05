import { useState, useEffect, useCallback, useRef } from "react";
import type {
  ArenaTraderModel,
  ArenaTrade,
  ArenaMarketSnapshot,
  ArenaLoan,
  ArenaCentralBankCommentary,
  ArenaLeaderboardEntry,
  ArenaModelScores,
} from "../types";

type FetchState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  lastUpdated: number | null;
};

function usePoll<T>(url: string, intervalMs: number): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const tickRef = useRef(0);

  const fetch_ = useCallback(async () => {
    const tick = ++tickRef.current;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (tick === tickRef.current) {
        setData(json);
        setLoading(false);
        setError(null);
        setLastUpdated(Date.now());
      }
    } catch (err) {
      if (tick === tickRef.current) {
        setLoading(false);
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    }
  }, [url]);

  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, intervalMs);
    return () => clearInterval(id);
  }, [fetch_, intervalMs]);

  return { data, loading, error, refetch: fetch_, lastUpdated };
}

export function useLeaderboard() {
  return usePoll<{ leaderboard: (ArenaLeaderboardEntry & ArenaTraderModel)[] }>(
    "/api/leaderboard",
    15_000
  );
}

export function useLiveTrades() {
  return usePoll<{ trades: ArenaTrade[] }>("/api/trades/live", 10_000);
}

export function useMarketSnapshot() {
  return usePoll<{ snapshot: ArenaMarketSnapshot }>("/api/market/snapshot", 30_000);
}

export function useModelDetail(id: string) {
  return usePoll<{
    model: ArenaTraderModel;
    trades: ArenaTrade[];
    scores: ArenaModelScores;
    loans: ArenaLoan[];
  }>(`/api/model/${id}`, 15_000);
}

export function useLoans() {
  return usePoll<{ loans: ArenaLoan[] }>("/api/loans", 30_000);
}

export function useCommentary() {
  return usePoll<{ commentary: ArenaCentralBankCommentary[] }>("/api/commentary", 30_000);
}
