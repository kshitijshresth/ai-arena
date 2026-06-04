import { useEffect, useMemo, useState } from "react";
import { models } from "@/data/mockData";
import type { Trade } from "@/types";

function fmtTime(ts: number) {
  return new Date(ts).toISOString().slice(11, 19);
}

export function LiveTradeFeed() {
  const initial = useMemo(() => {
    return models.flatMap(m => m.trades).sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
  }, []);
  const [feed, setFeed] = useState<Trade[]>(initial);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      // synthesize a new trade
      const m = models[Math.floor(Math.random() * models.length)];
      const newTrade = { ...m.trades[Math.floor(Math.random() * m.trades.length)], id: `nt-${Date.now()}`, timestamp: Date.now() };
      setFeed(prev => [newTrade, ...prev].slice(0, 50));
    }, 3500);
    return () => clearInterval(id);
  }, [paused]);

  return (
    <div className="border border-[#2a2a2a] bg-[#111]"
         onMouseEnter={() => setPaused(true)}
         onMouseLeave={() => setPaused(false)}>
      <div className="px-3 py-2 border-b border-[#2a2a2a] flex justify-between items-center">
        <span className="text-[#4a9eff] uppercase-label text-[11px]">LIVE TRADES</span>
        <span className={`text-[10px] uppercase-label ${paused ? "text-[#f5a623]" : "text-[#00ff88]"}`}>
          {paused ? "⏸ PAUSED" : "● STREAMING"}
        </span>
      </div>
      <div className="max-h-[280px] overflow-y-auto">
        <div className="px-3 py-1 grid grid-cols-[70px_140px_50px_70px_60px_70px_1fr_70px] gap-2 text-[10px] uppercase-label text-[#444] border-b border-[#1e1e1e] sticky top-0 bg-[#111]">
          <span>TIME</span><span>MODEL</span><span>ACT</span><span>ASSET</span><span className="text-right">SIZE</span><span className="text-right">ENTRY</span><span>REASONING</span><span className="text-right">PNL</span>
        </div>
        {feed.map(t => {
          const color = t.action === "BUY" ? "text-[#00ff88]" : t.action === "SELL" ? "text-[#ff3b3b]" : "text-[#888]";
          return (
            <div key={t.id} className="px-3 py-1 grid grid-cols-[70px_140px_50px_70px_60px_70px_1fr_70px] gap-2 text-[11px] border-b border-[#1e1e1e] items-center hover:bg-[#1a1a1a]">
              <span className="text-[#888] tabular-nums">{fmtTime(t.timestamp)}</span>
              <span className="truncate">{t.modelName}</span>
              <span className={`${color} font-bold`}>{t.action}</span>
              <span>{t.asset}</span>
              <span className="text-right tabular-nums text-[#888]">{t.size.toFixed(2)}</span>
              <span className="text-right tabular-nums">{t.entryPrice.toFixed(2)}</span>
              <span className="truncate text-[#888]">{t.reasoning}</span>
              <span className={`text-right tabular-nums ${t.pnlImpact >= 0 ? "text-[#00ff88]" : "text-[#ff3b3b]"}`}>
                {t.pnlImpact >= 0 ? "+" : ""}{t.pnlImpact.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
