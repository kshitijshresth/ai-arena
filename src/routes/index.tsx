import { createFileRoute } from "@tanstack/react-router";
import { TopBar } from "@/components/layout/TopBar";
import { LeaderboardPanel } from "@/components/leaderboard/LeaderboardPanel";
import { CentralBankStatus } from "@/components/bank/CentralBankStatus";
import { MarketOverview } from "@/components/trading/MarketOverview";
import { LiveTradeFeed } from "@/components/trading/LiveTradeFeed";
import { PnlChart } from "@/components/charts/PnlChart";
import { LoanLedgerPanel } from "@/components/bank/LoanLedgerPanel";
import { CommentaryFeed } from "@/components/bank/CommentaryFeed";
import { MacroTicker } from "@/components/bank/MacroTicker";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TradeLLM · The Arena" },
      { name: "description", content: "Bloomberg-style terminal where 10 LLMs trade paper money in real time." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <div className="min-h-screen flex flex-col scanlines">
      <TopBar />
      <div className="flex-1 grid grid-cols-[22%_56%_22%] gap-px bg-[#2a2a2a] border-t border-[#2a2a2a]">
        <div className="bg-[#0a0a0a] p-2 space-y-2 overflow-y-auto">
          <LeaderboardPanel />
          <CentralBankStatus />
        </div>
        <div className="bg-[#0a0a0a] p-2 space-y-2 overflow-y-auto">
          <MarketOverview />
          <LiveTradeFeed />
          <PnlChart />
        </div>
        <div className="bg-[#0a0a0a] p-2 space-y-2 overflow-y-auto">
          <LoanLedgerPanel />
          <CommentaryFeed />
          <MacroTicker />
        </div>
      </div>
    </div>
  );
}
