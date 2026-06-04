import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { models as base } from "@/data/mockData";

export function LeaderboardPanel() {
  const sorted = useMemo(
    () => [...base].sort((a, b) => b.score.composite - a.score.composite),
    []
  );
  return (
    <div className="border border-[#2a2a2a] bg-[#111]">
      <div className="px-3 py-2 border-b border-[#2a2a2a] text-[#f5a623] uppercase-label text-[11px]">
        LEADERBOARD
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
