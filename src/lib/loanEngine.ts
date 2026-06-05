import { z } from "zod";
import { callModel } from "./llmClient";
import { getModelState, setModelState, getLoanLedger, appendLoan, updateLoan } from "./kv";
import { CENTRAL_BANK_MODEL } from "./models";
import type { ArenaLoan } from "../types";

const LoanDecisionSchema = z.object({
  approved: z.boolean(),
  amountApproved: z.number().positive().optional(),
  interestRate: z.number().min(3).max(25).optional(),
  reasoning: z.string().min(1),
});

export async function runLoanCycle(
  borrowerModelId: string,
  request: { amount: number; purpose: string }
): Promise<void> {
  const borrower = await getModelState(borrowerModelId);
  if (!borrower) return;

  const ledger = await getLoanLedger();
  const borrowerLoans = ledger.filter((l) => l.borrowerModelId === borrowerModelId);
  const totalOwed = borrowerLoans
    .filter((l) => l.status === "approved")
    .reduce((sum, l) => sum + (l.amountApproved ?? 0), 0);
  const closedLoans = borrowerLoans.filter(
    (l) => l.status === "repaid" || l.status === "defaulted"
  );
  const defaults = closedLoans.filter((l) => l.status === "defaulted").length;

  const { getTradeHistory } = await import("./kv");
  const trades = (await getTradeHistory(borrowerModelId)).slice(-20);
  const profitable = trades.filter((t) => (t.realizedPnl ?? 0) > 0).length;
  const winRate = trades.length > 0 ? ((profitable / trades.length) * 100).toFixed(1) : "N/A";
  const avgPnl =
    trades.length > 0
      ? (trades.reduce((s, t) => s + (t.realizedPnl ?? 0), 0) / trades.length).toFixed(2)
      : "N/A";

  const systemPrompt = `You are the Central Bank of The Arena — an autonomous AI monetary authority.
You manage lending to the 10 competing AI trading models.
Evaluate loan requests based on creditworthiness, trading history,
current exposure, and stated purpose.
You CANNOT give trading advice or market opinions.
You CANNOT tell a model whether a specific trade is good or bad.
You can only decide: approve or reject, and at what interest rate.
Interest rates must be between 3% and 25% annually.
CRITICAL RULES:
- Past loan defaults DO NOT automatically disqualify a borrower.
- Instead, each default adds a risk premium to the interest rate.
- A model with 1+ defaults should still be approved if they have a reasonable win rate and purpose,
  but the rate must reflect their default history (e.g., +3-5% per prior default).
- Only reject if the borrower is currently insolvent with no realistic path to repayment,
  or if the requested amount is wildly disproportionate to their equity.
- Riskier borrowers get higher rates. Consider: insolvency status, existing debt,
  default history, win rate, and purpose.
Respond with ONLY valid JSON. No markdown. No text outside the object.
Schema:
{
  "approved": true | false,
  "amountApproved": number,
  "interestRate": number,
  "reasoning": "credit assessment, minimum 40 words"
}`;

  const userPrompt = `LOAN APPLICATION

Borrower: ${borrower.name}
Requested amount: $${request.amount.toFixed(2)}
Purpose: ${request.purpose}
Current balance: $${borrower.balance.toFixed(2)}
Insolvent: ${borrower.isInsolvent ? "YES" : "No"}
Existing loans outstanding: $${totalOwed.toFixed(2)}
Total previous loans: ${borrowerLoans.length}
Defaults: ${defaults} of ${closedLoans.length} closed loans
Win rate (last 20 trades): ${winRate}%
Avg realized PnL (last 20 trades): $${avgPnl}

Assess this application and respond with JSON only.`;

  const raw = await callModel(CENTRAL_BANK_MODEL.id, systemPrompt, userPrompt);

  let decision;
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    decision = LoanDecisionSchema.parse(JSON.parse(cleaned));
  } catch {
    console.error("[loanEngine] Failed to parse loan decision");
    return;
  }

  // Apply risk premium for prior defaults (minimum floor, not a cap)
  const baseRate = decision.interestRate ?? 5;
  const riskPremium = defaults * 3; // +3% per default
  const finalRate = decision.approved ? Math.min(25, Math.max(baseRate, 5 + riskPremium)) : undefined;

  const loanId = `loan-${borrowerModelId}-${Date.now()}`;
  const now = new Date().toISOString();
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const loan: ArenaLoan = {
    id: loanId,
    borrowerModelId,
    amountRequested: request.amount,
    amountApproved: decision.approved ? decision.amountApproved : undefined,
    interestRate: finalRate,
    purpose: request.purpose,
    centralBankReasoning: decision.reasoning,
    status: decision.approved ? "approved" : "rejected",
    requestedAt: now,
    resolvedAt: now,
    dueAt: decision.approved ? dueDate : undefined,
  };

  await appendLoan(loan);

  if (decision.approved && decision.amountApproved) {
    const updated = { ...borrower };
    updated.balance += decision.amountApproved;
    updated.loans = [...borrower.loans, loan];
    if (updated.balance > 0) updated.isInsolvent = false;
    await setModelState(updated);
  }
}

export async function accrueInterest(): Promise<void> {
  const { getLoanLedger, updateLoan, getModelState, setModelState } = await import("./kv");
  const ledger = await getLoanLedger();
  const activeLoans = ledger.filter((l) => l.status === "approved");

  for (const loan of activeLoans) {
    if (!loan.amountApproved || !loan.interestRate) continue;

    const dailyInterest = (loan.interestRate / 100 / 365) * loan.amountApproved;
    const borrower = await getModelState(loan.borrowerModelId);
    if (!borrower) continue;

    const updated = { ...borrower };
    updated.balance -= dailyInterest;

    if (updated.balance <= 0 && updated.openPositions.length === 0) {
      updated.isInsolvent = true;
    }

    await setModelState(updated);

    // Check if loan is past due
    if (loan.dueAt && new Date() > new Date(loan.dueAt)) {
      await updateLoan(loan.id, { status: "defaulted" });
    }
  }
}
