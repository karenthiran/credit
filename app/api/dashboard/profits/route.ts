import { NextRequest, NextResponse } from "next/server";

import { calculateRemainingBalance, determineLoanStatus } from "@/lib/calculations";
import { connectToDb } from "@/lib/dbConnect";
import { Customer } from "@/lib/model/customerModel";

export const runtime = "nodejs";

type ProfitFilter = "today" | "last7days" | "custom" | "monthly" | "daily";

type ProfitRow = {
  customerId: string;
  customerName: string;
  paymentAmount: number;
  interestRate: number;
  profit: number;
  date: string;
  loanStatus?: "ongoing" | "completed";
};

function parseDateFromYmd(value: string) {
  const parsed = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function getDateRange(filter: ProfitFilter, searchParams: URLSearchParams) {
  const now = new Date();

  if (filter === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  if (filter === "last7days") {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);

    return { start, end };
  }

  if (filter === "custom") {
    const startDate = searchParams.get("startDate") ?? "";
    const endDate = searchParams.get("endDate") ?? "";

    const start = parseDateFromYmd(startDate);
    const end = parseDateFromYmd(endDate);

    if (!start || !end) {
      return null;
    }

    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  if (filter === "daily") {
    const dateValue = searchParams.get("date") ?? "";
    const date = parseDateFromYmd(dateValue);

    if (!date) {
      return null;
    }

    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  const monthValue = searchParams.get("month") ?? "";
  const [yearRaw, monthRaw] = monthValue.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return null;
  }

  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  return { start, end };
}

function getFilterType(value: string | null): ProfitFilter {
  if (
    value === "today" ||
    value === "last7days" ||
    value === "custom" ||
    value === "monthly" ||
    value === "daily"
  ) {
    return value;
  }

  return "today";
}

export async function GET(request: NextRequest) {
  try {
    const filter = getFilterType(request.nextUrl.searchParams.get("filter"));
    const dateRange = getDateRange(filter, request.nextUrl.searchParams);

    if (!dateRange) {
      return NextResponse.json(
        { success: false, message: "Invalid filter date range" },
        { status: 400 },
      );
    }

    await connectToDb();

    const customers = await Customer.find({}).lean();
    const rows: ProfitRow[] = [];
    let totalProfit = 0;
    let totalProfitOngoing = 0;
    let totalProfitCompleted = 0;
    let totalPaymentsOngoing = 0;
    let totalPaymentsCompleted = 0;

    for (const customer of customers) {
      const interestRate = Number(customer.interestRate || 0);

      // include current loan transactions
      const remainingCurrent = calculateRemainingBalance(
        customer.totalWithInterest,
        customer.paidAmount,
      );

      const currentStatus: "ongoing" | "completed" =
        determineLoanStatus(remainingCurrent);

      for (const transaction of customer.transactions ?? []) {
        const amount = Number(transaction.amount || 0);
        const date = new Date(transaction.date);

        if (
          !Number.isFinite(amount) ||
          amount <= 0 ||
          Number.isNaN(date.getTime())
        ) {
          continue;
        }

        if (date < dateRange.start || date > dateRange.end) {
          continue;
        }

        const profit = Number((transaction as any).profit || 0);

        rows.push({
          customerId: String(customer.customerId ?? ""),
          customerName: String(customer.name ?? "Unknown"),
          paymentAmount: amount,
          interestRate,
          profit,
          date: date.toISOString(),
          loanStatus: currentStatus,
        });

        totalProfit += profit;
        if (currentStatus === "ongoing") {
          totalProfitOngoing += profit;
          totalPaymentsOngoing += amount;
        } else {
          totalProfitCompleted += profit;
          totalPaymentsCompleted += amount;
        }
      }

      // include historical loans from loanHistory (completed or older loans)
      for (const loan of customer.loanHistory ?? []) {
        const loanStatus: "ongoing" | "completed" =
          (loan.status as any) === "ongoing" ? "ongoing" : "completed";

        for (const transaction of loan.transactions ?? []) {
          const amount = Number(transaction.amount || 0);
          const date = new Date(transaction.date);

          if (
            !Number.isFinite(amount) ||
            amount <= 0 ||
            Number.isNaN(date.getTime())
          ) {
            continue;
          }

          if (date < dateRange.start || date > dateRange.end) {
            continue;
          }

          const profit = Number((transaction as any).profit || 0);

          rows.push({
            customerId: String(customer.customerId ?? ""),
            customerName: String(customer.name ?? "Unknown"),
            paymentAmount: amount,
            interestRate,
            profit,
            date: date.toISOString(),
            loanStatus,
          });

          totalProfit += profit;
          if (loanStatus === "ongoing") {
            totalProfitOngoing += profit;
            totalPaymentsOngoing += amount;
          } else {
            totalProfitCompleted += profit;
            totalPaymentsCompleted += amount;
          }
        }
      }
    }

    rows.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    const totalPayments = rows.reduce((sum, row) => sum + row.paymentAmount, 0);

    return NextResponse.json({
      success: true,
      data: {
        filter,
        startDate: dateRange.start.toISOString(),
        endDate: dateRange.end.toISOString(),
        rows,
        totalProfit,
        totalProfitOngoing,
        totalProfitCompleted,
        totalPayments,
        totalPaymentsOngoing,
        totalPaymentsCompleted,
      },
    });
  } catch (error) {
    console.error("Failed to load profits:", error);

    return NextResponse.json(
      { success: false, message: "Failed to load profits" },
      { status: 500 },
    );
  }
}
