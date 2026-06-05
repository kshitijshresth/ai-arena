import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { models } from "@/data/mockData";
import { useLeaderboard } from "@/hooks/useArenaData";
import { adaptLeaderboard } from "@/lib/adapters";

const RANGES = { "1H": 4, "6H": 24, "24H": 96, "ALL": 96 } as const;
type Range = keyof typeof RANGES;

export function PnlChart({ modelIds }: { modelIds?: string[] }) {
  const [range, setRange] = useState<Range>("24H");
  const { data: liveData } = useLeaderboard();
  const liveModels = liveData?.leaderboard?.length ? adaptLeaderboard(liveData.leaderboard) : null;
  const displayModels = liveModels ?? models;
  const filtered = modelIds ? displayModels.filter(m => modelIds.includes(m.id)) : displayModels;

  const data = useMemo(() => {
    if (!filtered.length || !filtered[0]?.pnlHistory?.length) return [];
    const n = RANGES[range];
    const len = filtered[0].pnlHistory.length;
    const start = Math.max(0, len - n);
    const points: Record<string, number | string>[] = [];
    for (let i = start; i < len; i++) {
      const row: Record<string, number | string> = { t: new Date(filtered[0].pnlHistory[i].t).toISOString().slice(11, 16) };
      filtered.forEach(m => { row[m.name] = m.pnlHistory[i]?.v ?? 0; });
      points.push(row);
    }
    return points;
  }, [range, filtered]);

  return (
    <div className="border border-[#2a2a2a] bg-[#111]">
      <div className="px-3 py-2 border-b border-[#2a2a2a] flex justify-between items-center">
        <span className="uppercase-label text-[11px] text-[#e8e8e8]">PORTFOLIO PNL OVER TIME</span>
        <div className="flex gap-1">
          {(Object.keys(RANGES) as Range[]).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-2 py-0.5 text-[10px] uppercase-label border ${range === r ? "border-[#00ff88] text-[#00ff88]" : "border-[#2a2a2a] text-[#888] hover:bg-[#1a1a1a]"}`}>
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="h-[280px] p-2 bg-[#0d0d0d]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#1a1a1a" strokeDasharray="0" />
            <XAxis dataKey="t" stroke="#444" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
            <YAxis stroke="#444" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} width={50} />
            <Tooltip
              contentStyle={{ background: "#0a0a0a", border: "1px solid #2a2a2a", fontFamily: "JetBrains Mono", fontSize: 11 }}
              labelStyle={{ color: "#888" }}
            />
            {filtered.length > 1 && <Legend wrapperStyle={{ fontFamily: "JetBrains Mono", fontSize: 10 }} />}
            {filtered.map(m => (
              <Line key={m.id} type="monotone" dataKey={m.name} stroke={m.color} strokeWidth={1.2} dot={false} animationDuration={1500} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
