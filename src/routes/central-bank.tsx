import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { LoanLedgerPanel } from "@/components/bank/LoanLedgerPanel";
import { CommentaryFeed } from "@/components/bank/CommentaryFeed";
import { MarketStatusBar } from "@/components/trading/MarketStatusBar";
import { loans, models } from "@/data/mockData";
import { CENTRAL_BANK_MODEL } from "@/lib/models";

export const Route = createFileRoute("/central-bank")({
  head: () => ({
    meta: [{ title: "CENTRAL BANK · TradeLLM" }],
  }),
  component: CentralBank,
});

function Stat({ label, value, color = "text-[#e8e8e8]" }: { label: string; value: string; color?: string }) {
  return (
    <div className="border border-[#2a2a2a] bg-[#111] p-3">
      <div className="text-[10px] uppercase-label text-[#888] mb-1">{label}</div>
      <div className={`text-[20px] tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function CentralBank() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const outstanding = loans.filter(l => l.status === "ACTIVE").reduce((s, l) => s + l.amount, 0);
  const avg = loans.length ? (loans.reduce((s, l) => s + l.rate, 0) / loans.length).toFixed(2) : "0";
  const approved = loans.filter(l => l.approved).length;
  const rejected = loans.length - approved;
  const defaults = loans.filter(l => l.status === "DEFAULTED").length;
  const interest = loans.filter(l => l.status === "REPAID").reduce((s, l) => s + l.amount * (l.rate / 100), 0);

  // mock daily evaluations: each model gets one
  const evaluations = models.map((m, i) => ({
    date: new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10),
    model: m.name,
    discipline: m.score.discipline,
    adaptability: m.score.adaptability,
    risk: m.score.riskAppetite,
    reasoning: `${m.name} exhibited ${m.score.discipline > 60 ? "consistent" : "erratic"} position sizing this session. Adaptability scored ${m.score.adaptability}/100 reflecting response to regime shifts in the bond market. Risk appetite at ${m.score.riskAppetite}/100 — ${m.score.riskAppetite > 70 ? "aggressive" : "measured"} given current volatility regime. Recommendation: ${m.insolvent ? "credit access frozen pending recapitalization" : "maintain standard credit line"}.`,
  }));

  return (
    <div className="min-h-screen flex flex-col scanlines">
      <TopBar />
      <div className="px-4 py-3 border-b border-[#2a2a2a] flex items-center gap-4">
        <Link to="/" className="text-[#888] hover:text-white text-[11px] uppercase-label">← BACK</Link>
        <span className="text-[20px] text-[#a855f7] uppercase-label">CENTRAL BANK</span>
        <span className="text-[#888]">{CENTRAL_BANK_MODEL.name}</span>
        <span className="border border-[#00ff88] text-[#00ff88] px-2 py-0.5 text-[10px] uppercase-label">{CENTRAL_BANK_MODEL.provider.toUpperCase()}</span>
      </div>

      <div className="p-3 space-y-3">
        <div className="grid grid-cols-6 gap-px bg-[#2a2a2a] border border-[#2a2a2a]">
          <Stat label="OUTSTANDING" value={`$${outstanding.toFixed(2)}`} color="text-[#f5a623]" />
          <Stat label="AVG RATE" value={`${avg}%`} />
          <Stat label="APPROVED" value={`${approved}`} color="text-[#00ff88]" />
          <Stat label="REJECTED" value={`${rejected}`} color="text-[#ff3b3b]" />
          <Stat label="DEFAULTS" value={`${defaults}`} color="text-[#ff3b3b]" />
          <Stat label="INTEREST EARNED" value={`$${interest.toFixed(2)}`} color="text-[#00ff88]" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <LoanLedgerPanel full />
          <CommentaryFeed full />
        </div>

        <div className="border border-[#2a2a2a] bg-[#111]">
          <div className="px-3 py-2 border-b border-[#2a2a2a] text-[#a855f7] uppercase-label text-[11px]">EVALUATION LOG</div>
          <div className="px-3 py-1 grid grid-cols-[100px_1fr_60px_60px_60px] gap-2 text-[10px] uppercase-label text-[#444] border-b border-[#1e1e1e]">
            <span>DATE</span><span>MODEL</span><span className="text-right">DISC</span><span className="text-right">ADPT</span><span className="text-right">RISK</span>
          </div>
          {evaluations.map((e, i) => (
            <div key={i}>
              <button onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="w-full px-3 py-1.5 grid grid-cols-[100px_1fr_60px_60px_60px] gap-2 text-[11px] border-b border-[#1e1e1e] hover:bg-[#1a1a1a] text-left items-center">
                <span className="text-[#888] tabular-nums">{e.date}</span>
                <span>{e.model}</span>
                <span className="text-right tabular-nums">{e.discipline}</span>
                <span className="text-right tabular-nums">{e.adaptability}</span>
                <span className="text-right tabular-nums">{e.risk}</span>
              </button>
              {openIdx === i && (
                <div className="px-3 py-3 bg-[#0d0d0d] border-b border-[#1e1e1e] text-[11px] text-[#e8e8e8] leading-relaxed">
                  <div className="text-[10px] uppercase-label text-[#a855f7] mb-1">EVALUATION REASONING</div>
                  {e.reasoning}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <MarketStatusBar />
    </div>
  );
}
