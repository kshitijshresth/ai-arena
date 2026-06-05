import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { models, loans as mockLoans } from "@/data/mockData";
import { TopBar } from "@/components/layout/TopBar";
import { PnlChart } from "@/components/charts/PnlChart";
import { MarketStatusBar } from "@/components/trading/MarketStatusBar";
import { useModelDetail } from "@/hooks/useArenaData";
import { adaptTraderModel, adaptLoan } from "@/lib/adapters";

export const Route = createFileRoute("/model/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.id.toUpperCase()} · TradeLLM` },
    ],
  }),
  loader: ({ params }) => {
    const m = models.find(x => x.id === params.id);
    if (!m) throw notFound();
    return { modelId: m.id };
  },
  notFoundComponent: () => (
    <div className="p-8 text-[#ff3b3b] uppercase-label">MODEL NOT FOUND · <Link to="/" className="underline">RETURN</Link></div>
  ),
  errorComponent: () => (
    <div className="p-8 text-[#ff3b3b]">ERROR</div>
  ),
  component: ModelDetail,
});

function StatCard({ label, value, color = "text-[#e8e8e8]" }: { label: string; value: string; color?: string }) {
  return (
    <div className="border border-[#2a2a2a] bg-[#111] p-3">
      <div className="text-[10px] uppercase-label text-[#888] mb-1">{label}</div>
      <div className={`text-[20px] tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const filled = Math.round((value / 100) * 20);
  const bar = "█".repeat(filled) + "░".repeat(20 - filled);
  return (
    <div className="flex items-center gap-3 text-[11px]">
      <span className="w-28 uppercase-label text-[#888] text-[10px]">{label}</span>
      <span className="text-[#00ff88] tracking-tight font-mono">{bar}</span>
      <span className="tabular-nums w-12 text-right text-[#e8e8e8]">{value}/100</span>
    </div>
  );
}

type Filter = "ALL" | "BUY" | "SELL" | "PROFITABLE" | "LOSING";

function ModelDetail() {
  const { modelId } = Route.useLoaderData() as { modelId: string };
  const { data: liveData } = useModelDetail(modelId);

  const liveModel = liveData?.model ? adaptTraderModel(liveData.model, liveData.trades, liveData.scores, liveData.loans) : null;
  const m = liveModel ?? models.find(x => x.id === modelId)!;

  const [filter, setFilter] = useState<Filter>("ALL");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return m.trades.filter(t => {
      if (filter === "BUY") return t.action === "BUY";
      if (filter === "SELL") return t.action === "SELL";
      if (filter === "PROFITABLE") return (t.realizedPnl ?? 0) > 0;
      if (filter === "LOSING") return (t.realizedPnl ?? 0) < 0;
      return true;
    }).slice(0, 200);
  }, [filter, m]);

  const rank = [...models].sort((a, b) => b.score.composite - a.score.composite).findIndex(x => x.id === m.id) + 1;

  const liveLoans = liveData?.loans?.map(adaptLoan).filter(l => l.modelId === modelId) ?? [];
  const modelLoans = liveLoans.length > 0 ? liveLoans : mockLoans.filter(l => l.modelId === m.id);

  return (
    <div className="min-h-screen flex flex-col scanlines">
      <TopBar />
      <div className="px-4 py-3 border-b border-[#2a2a2a] flex items-center gap-4">
        <Link to="/" className="text-[#888] hover:text-white text-[11px] uppercase-label">← BACK</Link>
        <span className="text-[20px] text-[#e8e8e8]">{m.name}</span>
        <span className={`border px-2 py-0.5 text-[10px] uppercase-label ${m.provider === "GROQ" ? "border-[#00ff88] text-[#00ff88]" : "border-[#4a9eff] text-[#4a9eff]"}`}>{m.provider}</span>
        <span className="text-[12px] text-[#888]">BAL <span className="text-[#e8e8e8] tabular-nums">${m.balance.toFixed(2)}</span></span>
        <span className="border border-[#f5a623] text-[#f5a623] px-2 py-0.5 text-[10px] uppercase-label">RANK #{rank}</span>
        {m.insolvent && <span className="border border-[#ff3b3b] text-[#ff3b3b] bg-[#1a0000] px-2 py-0.5 text-[10px] uppercase-label">⚠ INSOLVENT</span>}
      </div>

      <div className="p-3 space-y-3">
        <div className="grid grid-cols-5 gap-px bg-[#2a2a2a] border border-[#2a2a2a]">
          <StatCard label="BALANCE" value={`$${m.balance.toFixed(2)}`} />
          <StatCard label="TOTAL PNL" value={`${m.pnl >= 0 ? "+" : ""}$${m.pnl.toFixed(2)}`} color={m.pnl >= 0 ? "text-[#00ff88]" : "text-[#ff3b3b]"} />
          <StatCard label="WIN RATE" value={`${m.winRate}%`} />
          <StatCard label="OPEN POSITIONS" value={`${m.openPositions.length}`} />
          <StatCard label="LOANS OUTSTANDING" value={`$${m.loansOutstanding.toFixed(2)}`} color={m.loansOutstanding > 0 ? "text-[#f5a623]" : "text-[#e8e8e8]"} />
        </div>

        <div className="border border-[#2a2a2a] bg-[#111] p-4 grid grid-cols-[160px_1fr] gap-6">
          <div>
            <div className="text-[10px] uppercase-label text-[#888]">COMPOSITE SCORE</div>
            <div className="text-[48px] tabular-nums text-[#f5a623] leading-none mt-1">{m.score.composite.toFixed(1)}</div>
          </div>
          <div className="space-y-2">
            <ScoreBar label="DISCIPLINE" value={m.score.discipline} />
            <ScoreBar label="ADAPTABILITY" value={m.score.adaptability} />
            <ScoreBar label="RISK APPETITE" value={m.score.riskAppetite} />
            <div className="text-[10px] uppercase-label text-[#444] pt-2">30% OF SCORE FROM CENTRAL BANK EVALUATION</div>
          </div>
        </div>

        <PnlChart modelIds={[m.id]} />

        <div className="border border-[#2a2a2a] bg-[#111]">
          <div className="px-3 py-2 border-b border-[#2a2a2a] uppercase-label text-[11px] text-[#e8e8e8]">OPEN POSITIONS</div>
          <div className="px-3 py-1 grid grid-cols-[80px_60px_60px_80px_80px_80px_1fr] gap-2 text-[10px] uppercase-label text-[#444] border-b border-[#1e1e1e]">
            <span>ASSET</span><span>DIR</span><span className="text-right">SIZE</span><span className="text-right">ENTRY</span><span className="text-right">CURRENT</span><span className="text-right">U-PNL</span><span>OPENED</span>
          </div>
          {m.openPositions.map(p => (
            <div key={p.id} className="px-3 py-1.5 grid grid-cols-[80px_60px_60px_80px_80px_80px_1fr] gap-2 text-[11px] border-b border-[#1e1e1e]">
              <span>{p.asset}</span>
              <span className={p.direction === "LONG" ? "text-[#00ff88]" : "text-[#ff3b3b]"}>{p.direction}</span>
              <span className="text-right tabular-nums">{p.size.toFixed(2)}</span>
              <span className="text-right tabular-nums">{p.entryPrice.toFixed(2)}</span>
              <span className="text-right tabular-nums">{p.currentPrice.toFixed(2)}</span>
              <span className={`text-right tabular-nums ${p.unrealizedPnl >= 0 ? "text-[#00ff88]" : "text-[#ff3b3b]"}`}>
                {p.unrealizedPnl >= 0 ? "+" : ""}{p.unrealizedPnl.toFixed(2)}
              </span>
              <span className="text-[#888] text-[10px]">{new Date(p.openedAt).toISOString().slice(11, 16)}</span>
            </div>
          ))}
        </div>

        <div className="border border-[#2a2a2a] bg-[#111]">
          <div className="px-3 py-2 border-b border-[#2a2a2a] flex justify-between items-center">
            <span className="uppercase-label text-[11px] text-[#e8e8e8]">TRADE HISTORY</span>
            <div className="flex gap-1">
              {(["ALL", "BUY", "SELL", "PROFITABLE", "LOSING"] as Filter[]).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-2 py-0.5 text-[10px] uppercase-label border ${filter === f ? "border-[#00ff88] text-[#00ff88]" : "border-[#2a2a2a] text-[#888] hover:bg-[#1a1a1a]"}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            <div className="px-3 py-1 grid grid-cols-[70px_70px_50px_50px_70px_70px_70px_1fr] gap-2 text-[10px] uppercase-label text-[#444] border-b border-[#1e1e1e] sticky top-0 bg-[#111]">
              <span>TIME</span><span>ASSET</span><span>ACT</span><span className="text-right">SIZE</span><span className="text-right">ENTRY</span><span className="text-right">EXIT</span><span className="text-right">PNL</span><span>REASONING</span>
            </div>
            {filtered.map(t => (
              <div key={t.id}>
                <button onClick={() => setOpenId(openId === t.id ? null : t.id)}
                  className="w-full px-3 py-1.5 grid grid-cols-[70px_70px_50px_50px_70px_70px_70px_1fr] gap-2 text-[11px] border-b border-[#1e1e1e] items-center hover:bg-[#1a1a1a] text-left">
                  <span className="text-[#888] tabular-nums">{new Date(t.timestamp).toISOString().slice(11, 19)}</span>
                  <span>{t.asset}</span>
                  <span className={t.action === "BUY" ? "text-[#00ff88]" : t.action === "SELL" ? "text-[#ff3b3b]" : "text-[#888]"}>{t.action}</span>
                  <span className="text-right tabular-nums">{t.size.toFixed(2)}</span>
                  <span className="text-right tabular-nums">{t.entryPrice.toFixed(2)}</span>
                  <span className="text-right tabular-nums">{t.exitPrice?.toFixed(2) ?? "—"}</span>
                  <span className={`text-right tabular-nums ${(t.realizedPnl ?? 0) >= 0 ? "text-[#00ff88]" : "text-[#ff3b3b]"}`}>
                    {t.realizedPnl !== undefined ? `${t.realizedPnl >= 0 ? "+" : ""}${t.realizedPnl.toFixed(2)}` : "—"}
                  </span>
                  <span className="truncate text-[#888]">{t.reasoning}</span>
                </button>
                {openId === t.id && (
                  <div className="px-3 py-3 bg-[#0d0d0d] border-b border-[#1e1e1e] text-[11px] text-[#e8e8e8] leading-relaxed">
                    <div className="text-[10px] uppercase-label text-[#444] mb-1">FULL REASONING</div>
                    {t.reasoning} Additional context: position sized using volatility-adjusted Kelly, capped at 8% of equity. Hedge leg opened simultaneously in correlated instrument to reduce gross exposure ahead of macro print.
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="border border-[#2a2a2a] bg-[#111]">
          <div className="px-3 py-2 border-b border-[#2a2a2a] text-[#f5a623] uppercase-label text-[11px]">LOAN HISTORY</div>
          <div className="px-3 py-1 grid grid-cols-[120px_70px_60px_60px_70px_1fr] gap-2 text-[10px] uppercase-label text-[#444] border-b border-[#1e1e1e]">
            <span>TIME</span><span className="text-right">AMOUNT</span><span>APPROVED</span><span className="text-right">RATE</span><span>STATUS</span><span>CB RESPONSE</span>
          </div>
          {modelLoans.length === 0 && <div className="px-3 py-3 text-[#444] text-[11px] uppercase-label">NO LOAN HISTORY</div>}
          {modelLoans.map(l => (
            <div key={l.id} className="px-3 py-1.5 grid grid-cols-[120px_70px_60px_60px_70px_1fr] gap-2 text-[11px] border-b border-[#1e1e1e] items-center">
              <span className="text-[#888] tabular-nums">{new Date(l.issuedAt).toISOString().slice(0, 16).replace("T", " ")}</span>
              <span className="text-right tabular-nums">${l.amount.toFixed(2)}</span>
              <span className={l.approved ? "text-[#00ff88]" : "text-[#ff3b3b]"}>{l.approved ? "YES" : "NO"}</span>
              <span className="text-right tabular-nums">{l.rate.toFixed(2)}%</span>
              <span className="text-[10px] uppercase-label text-[#888]">{l.status}</span>
              <span className="truncate text-[#888]">{l.bankResponse}</span>
            </div>
          ))}
        </div>
      </div>
      <MarketStatusBar />
    </div>
  );
}
