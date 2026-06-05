import { useState, useEffect } from "react";
import { useMarketSnapshot } from "@/hooks/useArenaData";

function useCountdown(minutes: number) {
  const [secondsLeft, setSecondsLeft] = useState(minutes * 60);

  useEffect(() => {
    const now = Date.now();
    const intervalMs = minutes * 60 * 1000;
    const elapsed = now % intervalMs;
    const remaining = Math.ceil((intervalMs - elapsed) / 1000);
    setSecondsLeft(remaining);

    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) return minutes * 60;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [minutes]);

  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

const ARENA_SECRET = typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_ARENA_SECRET
  ? (import.meta as any).env.VITE_ARENA_SECRET
  : "testsecret";

export function MarketStatusBar() {
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchMessage, setFetchMessage] = useState<string | null>(null);
  const { data, refetch } = useMarketSnapshot();
  const snapshot = data?.snapshot;
  const countdown = useCountdown(30);

  const ageMin = snapshot
    ? Math.floor((Date.now() - new Date(snapshot.timestamp).getTime()) / 60_000)
    : null;
  const isFresh = ageMin !== null && ageMin < 40;

  async function handleFetchNow() {
    if (fetching) return;
    setFetching(true);
    setFetchMessage(null);
    try {
      const res = await fetch("/api/market/refresh", {
        method: "POST",
        headers: { "x-arena-secret": ARENA_SECRET },
      });
      const json = await res.json();
      if (res.ok) {
        setFetchMessage(`Refreshed ${json.assets} assets · ${new Date(json.timestamp).toLocaleTimeString()}`);
        refetch();
      } else {
        setFetchMessage(`Error: ${json.error ?? "Unknown"}`);
      }
    } catch (err) {
      setFetchMessage(`Network error: ${(err as Error).message}`);
    } finally {
      setFetching(false);
      setTimeout(() => setFetchMessage(null), 5000);
    }
  }

  return (
    <>
      <div className="h-8 border-t border-[#2a2a2a] bg-[#0a0a0a] flex items-center justify-between px-3 text-[11px] select-none">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 hover:text-white transition-colors cursor-pointer"
        >
          <span className={`w-2 h-2 rounded-full inline-block ${isFresh ? "bg-[#00ff88]" : "bg-[#f5a623]"} ${fetching ? "animate-pulse" : ""}`} />
          <span className={isFresh ? "text-[#00ff88]" : "text-[#f5a623]"}>
            {fetching ? "FETCHING..." : isFresh ? "PRICES LIVE" : "PRICES STALE"}
          </span>
          <span className="text-[#888]">
            {snapshot ? `${snapshot.assets.length} assets` : "no data"}
          </span>
          <span className="text-[#444] ml-1">|</span>
          <span className="text-[#4a9eff]">click for full listing</span>
        </button>

        <div className="flex items-center gap-3 text-[#888]">
          {fetchMessage && (
            <span className={`text-[10px] ${fetchMessage.startsWith("Error") || fetchMessage.startsWith("Network") ? "text-[#ff3b3b]" : "text-[#00ff88]"}`}>
              {fetchMessage}
            </span>
          )}
          <button
            onClick={handleFetchNow}
            disabled={fetching}
            className={`px-2 py-0.5 text-[10px] uppercase-label border cursor-pointer ${
              fetching
                ? "border-[#444] text-[#444] cursor-not-allowed"
                : "border-[#4a9eff] text-[#4a9eff] hover:bg-[#4a9eff]/10"
            }`}
          >
            {fetching ? "..." : "FETCH NOW"}
          </button>
          <span className="uppercase-label text-[10px]">new prices in</span>
          <span className="text-[#e8e8e8] tabular-nums font-mono">{countdown}</span>
        </div>
      </div>

      {open && <PriceDrawer snapshot={snapshot} onClose={() => setOpen(false)} />}
    </>
  );
}

function PriceDrawer({
  snapshot,
  onClose,
}: {
  snapshot: { assets: { symbol: string; name: string; price: number; changePercent24h: number; assetClass: string }[]; timestamp: string } | null | undefined;
  onClose: () => void;
}) {
  const assets = snapshot?.assets ?? [];

  const grouped: Record<string, typeof assets> = {};
  for (const a of assets) {
    const cls = a.assetClass;
    if (!grouped[cls]) grouped[cls] = [];
    grouped[cls].push(a);
  }

  const order = ["stock", "forex", "crypto", "commodity"];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-[#111] border border-[#2a2a2a] w-full sm:w-[600px] sm:max-h-[80vh] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[#2a2a2a] flex justify-between items-center sticky top-0 bg-[#111]">
          <div>
            <span className="text-[#4a9eff] uppercase-label text-[11px]">MARKET SNAPSHOT</span>
            <span className="text-[#888] text-[10px] ml-3">
              {snapshot ? new Date(snapshot.timestamp).toLocaleString() : "—"}
            </span>
          </div>
          <button onClick={onClose} className="text-[#888] hover:text-white text-[16px]">
            ×
          </button>
        </div>

        <div className="p-4 space-y-4">
          {order.map((cls) => {
            const list = grouped[cls];
            if (!list?.length) return null;
            return (
              <div key={cls}>
                <div className="text-[10px] uppercase-label text-[#888] mb-2 border-b border-[#1e1e1e] pb-1">
                  {cls}
                </div>
                <div className="space-y-1">
                  {list.map((a) => {
                    const color = a.changePercent24h >= 0 ? "text-[#00ff88]" : "text-[#ff3b3b]";
                    return (
                      <div
                        key={a.symbol}
                        className="flex justify-between items-center text-[12px] py-1 px-2 hover:bg-[#1a1a1a] rounded"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-[#e8e8e8] font-bold w-[70px]">{a.symbol}</span>
                          <span className="text-[#888] text-[11px]">{a.name}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-[#e8e8e8] tabular-nums w-[90px] text-right">
                            ${a.price.toFixed(a.price < 1 ? 4 : a.price < 100 ? 2 : 0)}
                          </span>
                          <span className={`tabular-nums w-[60px] text-right ${color}`}>
                            {a.changePercent24h >= 0 ? "+" : ""}
                            {a.changePercent24h.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {assets.length === 0 && (
            <div className="text-[#888] text-center py-8 text-[12px]">
              No market data available. Prices are fetched every 30 minutes.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
