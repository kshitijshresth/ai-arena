import { LineChart, Line, ResponsiveContainer } from "recharts";
import { marketAssets } from "@/data/mockData";
import { useMarketSnapshot } from "@/hooks/useArenaData";
import { adaptMarketAsset } from "@/lib/adapters";

export function MarketOverview() {
  const { data: liveData } = useMarketSnapshot();
  const liveAssets = liveData?.snapshot?.assets?.map(adaptMarketAsset) ?? [];
  const displayAssets = liveAssets.length > 0 ? liveAssets.slice(0, 6) : marketAssets.slice(0, 6);

  return (
    <div className="grid grid-cols-3 gap-px bg-[#2a2a2a] border border-[#2a2a2a]">
      {displayAssets.map(a => {
        const up = a.changePct >= 0;
        return (
          <div key={a.symbol} className="bg-[#111] p-3">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-[10px] uppercase-label text-[#888]">{a.name}</div>
                <div className="text-[16px] tabular-nums text-[#e8e8e8] mt-0.5">{a.price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 4})}</div>
              </div>
              <div className={`text-[11px] tabular-nums ${up ? "text-[#00ff88]" : "text-[#ff3b3b]"}`}>
                {up ? "▲" : "▼"} {Math.abs(a.changePct).toFixed(2)}%
              </div>
            </div>
            <div className="h-8">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={a.spark.map((v, i) => ({ i, v }))}>
                  <Line type="monotone" dataKey="v" stroke={up ? "#00ff88" : "#ff3b3b"} strokeWidth={1} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
}
