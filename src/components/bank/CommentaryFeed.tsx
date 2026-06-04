import { useState } from "react";
import { commentary } from "@/data/mockData";
import type { Commentary } from "@/types";

function fmtTime(ts: number) {
  return new Date(ts).toISOString().slice(11, 16);
}

export function CommentaryFeed({ full = false }: { full?: boolean }) {
  const [open, setOpen] = useState<Commentary | null>(null);
  return (
    <>
      <div className="border border-[#2a2a2a] bg-[#111]">
        <div className="px-3 py-2 border-b border-[#2a2a2a] text-[#a855f7] uppercase-label text-[11px]">CB COMMENTARY</div>
        <div className={full ? "" : "max-h-[260px] overflow-y-auto"}>
          {commentary.map(c => (
            <button key={c.id} onClick={() => setOpen(c)}
              className="w-full text-left px-3 py-2 border-b border-[#1e1e1e] hover:bg-[#1a1a1a] block">
              <div className="text-[10px] uppercase-label text-[#444] mb-0.5">{fmtTime(c.timestamp)}</div>
              <div className={`text-[11px] text-[#888] leading-relaxed ${full ? "" : "line-clamp-2"}`}>{c.message}</div>
            </button>
          ))}
        </div>
      </div>
      {open && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-8" onClick={() => setOpen(null)}>
          <div className="bg-[#111] border border-[#a855f7] max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-[#2a2a2a] flex justify-between items-center">
              <span className="text-[#a855f7] uppercase-label text-[11px]">CB COMMENTARY · {fmtTime(open.timestamp)}</span>
              <button onClick={() => setOpen(null)} className="text-[#888] hover:text-white text-[12px]">[CLOSE]</button>
            </div>
            <div className="p-4 text-[12px] leading-relaxed text-[#e8e8e8]">{open.message}</div>
          </div>
        </div>
      )}
    </>
  );
}
