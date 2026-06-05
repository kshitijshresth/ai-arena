import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { models as base } from "@/data/mockData";
import { useLeaderboard } from "@/hooks/useArenaData";
import { adaptLeaderboard } from "@/lib/adapters";

function fmtAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export function LeaderboardPanel() {
  const { data: liveData, refetch, lastUpdated } = useLeaderboard();
  const [updating, setUpdating] = useState(false);

  const liveLeaderboard =
    liveData?.leaderboard && liveData.leaderboard.length > 0
      ? adaptLeaderboard(liveData.leaderboard)
      : null;

  // Always show static mock data as the stable base.
  // If live data exists and has entries, overlay it on top.
  const sorted = useMemo(() => {
    const source = liveLeaderboard && liveLeaderboard.length > 0 ? liveLeaderboard : base;
    return [...source].sort((a, b) => b.score.composite - a.score.composite);
  }, [liveLeaderboard]);

  const handleUpdate = async () => {
    setUpdating(true);
    await refetch();
    setUpdating(false);
  };

  return (
    <div className="border border-[#2a2a2a] bg-[#111]">
      <div className="px-3 py-2 border-b border-[#2a2a2a] flex justify-between items-center">
        <span className="text-[#f5a623] uppercase-label text-[11px]">LEADERBOARD</span>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-[10px] text-[#444] tabular-nums">
              updated {fmtAgo(lastUpdated)}
            </span>
          )}
          <button
            onClick={handleUpdate}
            disabled={updating}
            className="px-2 py-0.5 border border-[#2a2a2a] text-[10px] uppercase-label text-[#888] hover:text-[#e8e8e8] hover:border-[#888] disabled:opacity-50 transition-colors"
          >
            {updating ? "..." : "UPDATE"}
          </button>
        </div>
      </div>
      <div className="px-3 py-1.5 grid grid-cols-[24px_1fr_70px_60px_44px] gap-2 text-[10px] uppercase-label text-[#444] border-b border-[#1e1e1e]">
        <span>#</span><span>MODEL</span><span className="text-right">BAL</span><span className="text-right">PNL</span><span className="text-right">SCR</span>
      </div>
      <div>
        {sorted.map((m, idx) => (
          <Link
            key={m.id}
            to="/model/$id"
            params={{ id: m.id }}
            className="px-3 py-1.5 grid grid-cols-[24px_1fr_70px_60px_44px] gap-2 items-center text-[11px] border-b border-[#1e1e1e] hover:bg-[#1a1a1a] transition-colors"
          >
            <span className="text-[#888]">{idx + 1}</span>
            <span className="truncate">
              <span className="text-[#e8e8e8]">{m.name}</span>
              {m.insolvent && (
                <span className="ml-1 inline-block border border-[#ff3b3b] text-[#ff3b3b] bg-[#1a0000] px-1 text-[9px] uppercase-label">⚠ INS</span>
              )}
            </span>
            <span className="text-right tabular-nums">${m.balance.toFixed(2)}</span>
            <span className={`text-right tabular-nums ${m.pnl >= 0 ? "text-[#00ff88]" : "text-[#ff3b3b]"}`}>
              {m.pnl >= 0 ? "+" : ""}{m.pnl.toFixed(2)}
            </span>
            <span className="text-right tabular-nums text-[#888]">{m.score.composite.toFixed(0)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
