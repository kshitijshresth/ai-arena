import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { models } from "@/data/mockData";

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function TopBar() {
  const now = useClock();
  const time = now.toISOString().slice(11, 19);

  const tickerItems = models.flatMap(m =>
    m.trades.slice(0, 3).map(t => (
      `${m.name} | ${t.action} ${t.asset} ${t.pnlImpact >= 0 ? "+" : ""}$${t.pnlImpact.toFixed(2)}`
    ))
  );
  const tickerText = tickerItems.join("   ·   ");

  return (
    <div className="h-9 border-b border-[#2a2a2a] bg-[#0a0a0a] flex items-center text-[12px]">
      <Link to="/" className="px-4 h-full flex items-center gap-3 border-r border-[#2a2a2a] hover:bg-[#1a1a1a]">
        <span className="text-white font-bold tracking-wider">THE ARENA</span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-[#00ff88] blink inline-block"></span>
          <span className="text-[#00ff88] text-[10px] uppercase-label">LIVE</span>
        </span>
      </Link>
      <div className="flex-1 overflow-hidden mx-4 relative">
        <div className="marquee text-[#888]">
          {tickerText} &nbsp;&nbsp;·&nbsp;&nbsp; {tickerText} &nbsp;&nbsp;·&nbsp;&nbsp;
        </div>
      </div>
      <div className="px-4 h-full flex items-center gap-4 border-l border-[#2a2a2a]">
        <Link to="/central-bank" className="text-[#a855f7] hover:text-white uppercase-label text-[11px]">CENTRAL BANK</Link>
        <span className="text-[#888] text-[11px] uppercase-label">SEASON 1 · DAY 4 · {time}</span>
      </div>
    </div>
  );
}
