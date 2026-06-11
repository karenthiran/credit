import { NextResponse } from "next/server";

import { connectToDb } from "@/lib/dbConnect";
import { Loan } from "@/lib/model/loanModel";
import { Collection } from "@/lib/model/collectionModel";
import { Customer } from "@/lib/model/customerModel";
import { User } from "@/lib/model/userModel";
import { calculateRemainingBalance } from "@/lib/calculations";

export const runtime = "nodejs";

export async function GET() {
  try {
    await connectToDb();

    const [loans, collections, totalCustomers, officersCount] =
      await Promise.all([
        Loan.find({}).lean(),
        Collection.find({}).lean(),
        Customer.countDocuments(),
        User.countDocuments({ role: "officer" }),
      ]);

    const nowMs = Date.now();
    const startOfMonth = new Date(nowMs);
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const monthStartTs = startOfMonth.getTime();

    const startOfToday = new Date(nowMs);
    startOfToday.setHours(0, 0, 0, 0);
    const todayStartTs = startOfToday.getTime();

    const thirtyDaysAgo = nowMs - 30 * 24 * 60 * 60 * 1000;
    const sevenDaysAgo = nowMs - 7 * 24 * 60 * 60 * 1000;

    // --- Loan aggregates ---
    let totalLoanGiven = 0;
    let pendingLoan = 0;
    let activeCustomers = 0;
    let monthlyLoanGiven = 0;

    for (const loan of loans) {
      const loanAmount = Number(loan.loanAmount || 0);
      const remaining = calculateRemainingBalance(
        loan.totalWithInterest,
        loan.paidAmount,
      );

      totalLoanGiven += loanAmount;
      pendingLoan += remaining;
      if (remaining > 0) activeCustomers += 1;

      const loanStartTs = Number(
        new Date(loan.loanStartDate || loan.openedAt || 0).getTime(),
      );
      if (!Number.isNaN(loanStartTs) && loanStartTs >= monthStartTs) {
        monthlyLoanGiven += loanAmount;
      }
    }

    // --- Collection aggregates ---
    let totalCollected = 0;
    let profitFromLoanInterest = 0;
    let monthlyCollected = 0;
    let monthlyProfit = 0;
    let collectedLast30Days = 0;
    let collectedLast7Days = 0;
    let todaysCollected = 0;
    let todaysProfit = 0;

    // For recent transactions
    type NormalizedTx = {
      ts: number;
      amount: number;
      profit: number;
      dateIso: string;
      note?: string;
      customerId: string;
      customerName: string;
      loanStatus: string;
      remaining: number;
    };
    const normalizedTransactions: NormalizedTx[] = [];

    // Build a quick lookup: loanId → remaining & status
    const loanMap = new Map(
      loans.map((l) => [
        String(l.loanId),
        {
          remaining: calculateRemainingBalance(
            l.totalWithInterest,
            l.paidAmount,
          ),
          status: String(l.status ?? "ongoing"),
        },
      ]),
    );

    for (const col of collections) {
      const ts = Number(new Date(col.date as Date).getTime());
      if (Number.isNaN(ts)) continue;

      const amount = Number(col.amount || 0);
      const profit = Number(col.profit || 0);
      const loanInfo = loanMap.get(String(col.loanId)) ?? {
        remaining: 0,
        status: "completed",
      };

      totalCollected += amount;
      profitFromLoanInterest += profit;

      if (ts >= monthStartTs) {
        monthlyCollected += amount;
        monthlyProfit += profit;
      }
      if (ts >= thirtyDaysAgo) collectedLast30Days += amount;
      if (ts >= sevenDaysAgo) collectedLast7Days += amount;
      if (ts >= todayStartTs) {
        todaysCollected += amount;
        todaysProfit += profit;
      }

      normalizedTransactions.push({
        ts,
        amount,
        profit,
        dateIso: new Date(ts).toISOString(),
        note: col.note as string | undefined,
        customerId: String(col.customerId),
        customerName: String(col.customerName),
        loanStatus: loanInfo.status,
        remaining: loanInfo.remaining,
      });
    }

    // Recent transactions (top 5 most recent)
    normalizedTransactions.sort((a, b) => b.ts - a.ts);
    const recentTransactions = normalizedTransactions
      .slice(0, 5)
      .map((t, idx) => ({
        txId: `${t.customerId}-${t.ts}-${t.amount}-${idx}`,
        customerId: t.customerId,
        customerName: t.customerName,
        amount: t.amount,
        date: t.dateIso,
        note: t.note,
        loanStatus: t.loanStatus,
        remaining: t.remaining,
      }));

    const monthName = startOfMonth.toLocaleString(undefined, { month: "long" });

    return NextResponse.json({
      success: true,
      summary: {
        totalLoanGiven,
        totalCollected,
        pendingLoan,
        activeCustomers,
        collectedLast7Days,
        collectedLast30Days,
        profitFromLoanInterest,
        monthlyProfit,
        monthlyCollected,
        monthlyLoanGiven,
        todaysCollected,
        todaysProfit,
        totalCustomers,
        monthName,
        recentTransactions,
        officersCount,
      },
    });
  } catch (error) {
    console.error("Failed to load dashboard summary:", error);
    return NextResponse.json(
      { success: false, message: "Failed to load dashboard summary" },
      { status: 500 },
    );
  }
}
