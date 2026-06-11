import { NextRequest, NextResponse } from "next/server";

import { connectToDb } from "@/lib/dbConnect";
import { Collection } from "@/lib/model/collectionModel";
import { Loan } from "@/lib/model/loanModel";
import { Customer } from "@/lib/model/customerModel";
import { Counter } from "@/lib/model/counterModel";
import { calculatePaymentInterestProfit } from "@/lib/calculations";

export const runtime = "nodejs";

function parsePaymentDate(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") {
    return new Date();
  }
  const date = new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

/**
 * GET /api/collections
 * Returns all collections sorted by transactionId descending (C10 > C9 > C8...).
 * Supports optional query params:
 *   ?customerId=C01  — filter by customer
 *   ?loanId=L01      — filter by loan
 *   ?search=name     — filter by customer name
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDb();

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");
    const loanId = searchParams.get("loanId");
    const search = searchParams.get("search");

    const query: Record<string, unknown> = {};
    if (customerId) query.customerId = customerId.toUpperCase();
    if (loanId) query.loanId = loanId.toUpperCase();
    if (search) {
      query.customerName = { $regex: search, $options: "i" };
    }

    const collections = await Collection.find(query).sort({ _id: -1 }).lean();

    // Sort by numeric part of transactionId descending (C10 > C9 > C8...)
    const sorted = collections.slice().sort((a, b) => {
      const numA = Number(String(a.transactionId).replace(/\D+/g, ""));
      const numB = Number(String(b.transactionId).replace(/\D+/g, ""));
      return numB - numA;
    });

    return NextResponse.json({ success: true, collections: sorted });
  } catch (error) {
    console.error("Failed to fetch collections:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch collections" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/collections
 * Records a new payment.
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDb();

    const body = await request.json().catch(() => null);
    const customerId = String(body?.customerId ?? "")
      .trim()
      .toUpperCase();
    const loanId = String(body?.loanId ?? "")
      .trim()
      .toUpperCase();
    const amount = Number(body?.amount);

    if (!customerId) {
      return NextResponse.json(
        { success: false, message: "customerId is required" },
        { status: 400 },
      );
    }

    if (!loanId) {
      return NextResponse.json(
        { success: false, message: "loanId is required" },
        { status: 400 },
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, message: "Amount must be a positive number" },
        { status: 400 },
      );
    }

    const [loan, customer] = await Promise.all([
      Loan.findOne({ loanId }),
      Customer.findOne({ customerId }),
    ]);

    if (!loan) {
      return NextResponse.json(
        { success: false, message: "Loan not found" },
        { status: 404 },
      );
    }

    if (!customer) {
      return NextResponse.json(
        { success: false, message: "Customer not found" },
        { status: 404 },
      );
    }

    const paymentDate = parsePaymentDate(body?.date);

    const counter = await Counter.findOneAndUpdate(
      { name: "transaction" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    );
    const txSeq = Number(counter?.seq ?? 0);
    const transactionId = `C${txSeq}`;

    const profit = calculatePaymentInterestProfit(
      amount,
      Number(loan.interestRate ?? 0),
      Number(loan.duration ?? 0),
    );

    // 1. Insert Collection document
    const collection = await Collection.create({
      transactionId,
      customerId,
      customerName: customer.name,
      loanId,
      amount,
      date: paymentDate,
      note: String(body?.note ?? "Payment received"),
      profit,
    });

    // 2. Update Loan paidAmount and status
    const newLoanPaid = Number(loan.paidAmount ?? 0) + amount;
    const loanRemaining = Math.max(
      Number(loan.totalWithInterest ?? 0) - newLoanPaid,
      0,
    );
    await Loan.findOneAndUpdate(
      { loanId },
      {
        $inc: { paidAmount: amount },
        $set: {
          status: loanRemaining === 0 ? "completed" : "ongoing",
          ...(loanRemaining === 0 ? { closedAt: paymentDate } : {}),
        },
      },
    );

    // 3. Keep Customer in sync (backward compat)
    const transaction = {
      transactionId,
      amount,
      date: paymentDate,
      note: String(body?.note ?? "Payment received"),
      profit,
    };
    await Customer.findOneAndUpdate(
      { customerId },
      {
        $inc: { paidAmount: amount },
        $push: { transactions: transaction },
      },
    );

    return NextResponse.json({
      success: true,
      message: "Payment recorded successfully",
      collection,
    });
  } catch (error) {
    console.error("Failed to record payment:", error);
    return NextResponse.json(
      { success: false, message: "Failed to record payment" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/collections
 * Edits an existing collection record.
 */
export async function PUT(request: NextRequest) {
  try {
    await connectToDb();

    const body = await request.json().catch(() => null);
    const transactionId = String(body?.transactionId ?? "")
      .trim()
      .toUpperCase();
    const amount = Number(body?.amount);

    if (!transactionId) {
      return NextResponse.json(
        { success: false, message: "transactionId is required" },
        { status: 400 },
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, message: "Amount must be a positive number" },
        { status: 400 },
      );
    }

    const existing = await Collection.findOne({ transactionId });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Collection record not found" },
        { status: 404 },
      );
    }

    const oldAmount = Number(existing.amount ?? 0);
    const amountDiff = amount - oldAmount;
    const paymentDate = body?.date
      ? parsePaymentDate(body.date)
      : existing.date;

    // Update Collection document
    const updated = await Collection.findOneAndUpdate(
      { transactionId },
      {
        $set: {
          amount,
          date: paymentDate,
          note: String(body?.note ?? existing.note ?? "Payment received"),
        },
      },
      { new: true },
    );

    // Sync Loan paidAmount
    if (amountDiff !== 0) {
      const loan = await Loan.findOneAndUpdate(
        { loanId: existing.loanId },
        { $inc: { paidAmount: amountDiff } },
        { new: true },
      );
      if (loan) {
        const loanRemaining = Math.max(
          Number(loan.totalWithInterest ?? 0) - Number(loan.paidAmount ?? 0),
          0,
        );
        await Loan.findOneAndUpdate(
          { loanId: existing.loanId },
          { $set: { status: loanRemaining === 0 ? "completed" : "ongoing" } },
        );
      }
    }

    // Sync Customer
    if (amountDiff !== 0) {
      const customer = await Customer.findOne({
        customerId: existing.customerId,
      });
      if (customer) {
        const txIndex = (customer.transactions ?? []).findIndex(
          (tx: any) => String(tx.transactionId) === transactionId,
        );
        if (txIndex >= 0) {
          const updatedTransactions = [...customer.transactions];
          updatedTransactions[txIndex] = {
            ...updatedTransactions[txIndex],
            amount,
            date: paymentDate,
            note: String(body?.note ?? existing.note ?? "Payment received"),
          };
          const newPaidAmount = updatedTransactions.reduce(
            (sum: number, tx: any) => sum + Number(tx.amount ?? 0),
            0,
          );
          await Customer.findOneAndUpdate(
            { customerId: existing.customerId },
            {
              $set: {
                [`transactions.${txIndex}`]: updatedTransactions[txIndex],
                paidAmount: newPaidAmount,
              },
            },
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Payment updated successfully",
      collection: updated,
    });
  } catch (error) {
    console.error("Failed to update payment:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update payment" },
      { status: 500 },
    );
  }
}
