import { Link } from "@tanstack/react-router";
import { loans, commentary } from "@/data/mockData";

export function CentralBankStatus() {
  const outstanding = loans.filter(l => l.status === "ACTIVE").reduce((s, l) => s + l.amount, 0);
  const today = loans.filter(l => Date.now() - l.issuedAt < 24 * 3600_000);
  const approved = today.filter(l => l.approved).length;
  const rejected = today.length - approved;
  const last = commentary[0];
  return (
    <div className="border border-[#2a2a2a] bg-[#111]">
      <div className="px-3 py-2 border-b border-[#2a2a2a] text-[#a855f7] uppercase-label text-[11px] flex justify-between items-center">
        <span>CENTRAL BANK</span>
        <span className="border border-[#a855f7] text-[#a855f7] px-1.5 py-0 text-[9px]">ACTIVE</span>
      </div>
      <div className="p-3 space-y-2 text-[11px]">
        <div className="flex justify-between"><span className="text-[#888] uppercase-label text-[10px]">MODEL</span><span>GEMMA2-9B</span></div>
        <div className="flex justify-between"><span className="text-[#888] uppercase-label text-[10px]">OUTSTANDING</span><span className="text-[#f5a623] tabular-nums">${outstanding.toFixed(2)}</span></div>
        <div className="flex justify-between"><span className="text-[#888] uppercase-label text-[10px]">APPROVED TODAY</span><span className="text-[#00ff88] tabular-nums">{approved}</span></div>
        <div className="flex justify-between"><span className="text-[#888] uppercase-label text-[10px]">REJECTED TODAY</span><span className="text-[#ff3b3b] tabular-nums">{rejected}</span></div>
        <div className="pt-2 mt-2 border-t border-[#1e1e1e]">
          <div className="text-[#444] uppercase-label text-[10px] mb-1">LAST COMMENTARY</div>
          <Link to="/central-bank" className="text-[#888] hover:text-[#e8e8e8] line-clamp-3 leading-relaxed block">
            {last.message}
          </Link>
        </div>
      </div>
    </div>
  );
}
