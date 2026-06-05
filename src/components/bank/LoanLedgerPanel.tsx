import { loans as mockLoans } from "@/data/mockData";
import { useLoans } from "@/hooks/useArenaData";
import { adaptLoan } from "@/lib/adapters";

const STATUS_COLOR = { ACTIVE: "text-[#4a9eff] border-[#4a9eff]", REPAID: "text-[#00ff88] border-[#00ff88]", DEFAULTED: "text-[#ff3b3b] border-[#ff3b3b]" };

export function LoanLedgerPanel({ full = false }: { full?: boolean }) {
  const { data: liveData } = useLoans();
  const liveLoans = liveData?.loans?.map(adaptLoan) ?? [];
  const loans = liveLoans.length > 0 ? liveLoans : mockLoans;
  const outstanding = loans.filter(l => l.status === "ACTIVE").reduce((s, l) => s + l.amount, 0);
  return (
    <div className="border border-[#2a2a2a] bg-[#111]">
      <div className="px-3 py-2 border-b border-[#2a2a2a] text-[#f5a623] uppercase-label text-[11px]">LOAN LEDGER</div>
      <div className="px-3 py-1 grid grid-cols-[1fr_50px_40px_60px] gap-2 text-[10px] uppercase-label text-[#444] border-b border-[#1e1e1e]">
        <span>MODEL</span><span className="text-right">AMT</span><span className="text-right">RATE</span><span>STATUS</span>
      </div>
      <div className={full ? "" : "max-h-[280px] overflow-y-auto"}>
        {loans.map(l => (
          <div key={l.id} className="px-3 py-1.5 grid grid-cols-[1fr_50px_40px_60px] gap-2 text-[11px] border-b border-[#1e1e1e] items-center">
            <span className="truncate">{l.modelName}</span>
            <span className="text-right tabular-nums">${l.amount.toFixed(0)}</span>
            <span className="text-right tabular-nums text-[#888]">{l.rate.toFixed(1)}%</span>
            <span className={`border px-1 text-[9px] uppercase-label text-center ${STATUS_COLOR[l.status]}`}>{l.status}</span>
          </div>
        ))}
      </div>
      <div className="px-3 py-2 border-t border-[#2a2a2a] flex justify-between text-[11px]">
        <span className="text-[#888] uppercase-label text-[10px]">OUTSTANDING</span>
        <span className="text-[#f5a623] tabular-nums">${outstanding.toFixed(2)}</span>
      </div>
    </div>
  );
}
