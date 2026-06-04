import { macroIndicators } from "@/data/mockData";

function fmtAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

export function MacroTicker() {
  return (
    <div className="border border-[#2a2a2a] bg-[#111]">
      <div className="px-3 py-2 border-b border-[#2a2a2a] text-[#4a9eff] uppercase-label text-[11px]">MACRO</div>
      <div>
        {macroIndicators.map(m => (
          <div key={m.name} className="px-3 py-1.5 grid grid-cols-[1fr_70px_40px] gap-2 text-[11px] border-b border-[#1e1e1e] items-center">
            <span className="text-[#888] uppercase-label text-[10px]">{m.name}</span>
            <span className="text-right tabular-nums text-[#e8e8e8]">{m.value}</span>
            <span className="text-right tabular-nums text-[#444] text-[10px]">{fmtAgo(m.updated)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
