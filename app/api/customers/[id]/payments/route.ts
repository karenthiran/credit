import { NextRequest, NextResponse } from "next/server";

import { connectToDb } from "@/lib/dbConnect";
import { calculatePaymentInterestProfit } from "@/lib/calculations";
import { Customer } from "@/lib/model/customerModel";
import { Counter } from "@/lib/model/counterModel";
import { Collection } from "@/lib/model/collectionModel";
import { Loan } from "@/lib/model/loanModel";

export const runtime = "nodejs";

type PaymentTransaction = {
  amount: number;
  date: Date;
  note?: string;
  profit?: number;
};

function parsePaymentDate(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") {
    return new Date();
  }

  const date = new Date(value as string | number);

  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function addMonthsUtc(date: Date, months: number) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const day = date.getUTCDate();
  const lastDayOfTargetMonth = new Date(
    Date.UTC(year, month + 1, 0, 12, 0, 0, 0),
  ).getUTCDate();

  return new Date(
    Date.UTC(year, month, Math.min(day, lastDayOfTargetMonth), 12, 0, 0, 0),
  );
}

function getTransactionIndex(
  body: unknown,
  transactions: PaymentTransaction[],
) {
  const index = Number(
    (body as { transactionIndex?: unknown })?.transactionIndex,
  );

  if (Number.isInteger(index) && index >= 0 && index < transactions.length) {
    return index;
  }

  return transactions.length - 1;
}

function normalizeCustomerId(value: string) {
  return value.trim().toUpperCase();
}

function isValidCustomerId(value: string) {
  return /^[A-Z0-9]+$/.test(value);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const customerId = normalizeCustomerId(id);

    if (!isValidCustomerId(customerId)) {
      return NextResponse.json(
        { success: false, message: "Invalid customer ID" },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => null);
    const amount = Number(body?.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, message: "Amount must be a positive number" },
        { status: 400 },
      );
    }

    await connectToDb();

    const customer = await Customer.findOne({ customerId });

    if (!customer) {
      return NextResponse.json(
        { success: false, message: "Customer not found" },
        { status: 404 },
      );
    }

    const paymentDate = parsePaymentDate(body?.date);
    const loanStartDate =
      customer.loanStartDate ?? customer.createdAt ?? paymentDate;
    const loanEndDate =
      customer.loanEndDate ??
      addMonthsUtc(loanStartDate, Number(customer.duration || 0));

    // Generate a global transaction sequence (C01, C02, ...)
    const counter = await Counter.findOneAndUpdate(
      { name: "transaction" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    );

    const txSeq = Number(counter?.seq || 0);
    const transactionId = `C${txSeq}`;

    const profit = calculatePaymentInterestProfit(
      amount,
      Number(customer.interestRate || 0),
      Number(customer.duration || 0),
    );

    const transaction = {
      transactionId,
      amount,
      date: paymentDate,
      note: String(body?.note ?? "Payment received"),
      profit,
    };

    // 1. Update Customer document (backward compat)
    const updatedCustomer = await Customer.findOneAndUpdate(
      { customerId },
      {
        $set: {
          loanStartDate,
          loanEndDate,
        },
        $inc: { paidAmount: amount },
        $push: { transactions: transaction },
      },
      { returnDocument: "after" },
    );

    if (!updatedCustomer) {
      return NextResponse.json(
        { success: false, message: "Customer not found" },
        { status: 404 },
      );
    }

    const loanId = String((customer as any).loanId ?? "");

    // 2. Insert Collection document
    if (loanId) {
      await Collection.create({
        transactionId,
        customerId,
        customerName: customer.name,
        loanId,
        amount,
        date: paymentDate,
        note: String(body?.note ?? "Payment received"),
        profit,
      });

      // 3. Update Loan paidAmount and status
      const newLoanPaid = Number(customer.paidAmount ?? 0) + amount;
      const loanRemaining = Math.max(
        Number(customer.totalWithInterest ?? 0) - newLoanPaid,
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
    }

    return NextResponse.json({
      success: true,
      message: "Payment recorded successfully",
      customer: {
        id: updatedCustomer.customerId,
        paidAmount: updatedCustomer.paidAmount,
        transactions: updatedCustomer.transactions,
      },
    });
  } catch (error) {
    console.error("Failed to record payment:", error);

    return NextResponse.json(
      { success: false, message: "Failed to record payment" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const customerId = normalizeCustomerId(id);

    if (!isValidCustomerId(customerId)) {
      return NextResponse.json(
        { success: false, message: "Invalid customer ID" },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => null);
    const amount = Number(body?.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, message: "Amount must be a positive number" },
        { status: 400 },
      );
    }

    await connectToDb();

    const customer = await Customer.findOne({ customerId });

    if (!customer) {
      return NextResponse.json(
        { success: false, message: "Customer not found" },
        { status: 404 },
      );
    }

    if (
      !Array.isArray(customer.transactions) ||
      customer.transactions.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "No payment records found for this customer",
        },
        { status: 400 },
      );
    }

    const transactionIndex = getTransactionIndex(body, customer.transactions);

    if (transactionIndex < 0) {
      return NextResponse.json(
        {
          success: false,
          message: "No payment records found for this customer",
        },
        { status: 400 },
      );
    }

    const existingTransaction = customer.transactions[
      transactionIndex
    ] as PaymentTransaction;
    const updatedTransaction: PaymentTransaction = {
      // preserve original transactionId when editing
      // @ts-ignore - existingTransaction may have extra fields
      transactionId: (existingTransaction as any)?.transactionId,
      amount,
      date: parsePaymentDate(body?.date ?? existingTransaction.date),
      note: String(
        body?.note ?? existingTransaction.note ?? "Payment received",
      ),
      // preserve original recorded profit
      // @ts-ignore - existingTransaction may have extra fields
      profit: (existingTransaction as any)?.profit ?? 0,
    };

    const loanStartDate =
      customer.loanStartDate ?? customer.createdAt ?? updatedTransaction.date;
    const loanEndDate =
      customer.loanEndDate ??
      addMonthsUtc(loanStartDate, Number(customer.duration || 0));

    const updatedTransactions = customer.transactions.map(
      (transaction: PaymentTransaction, index: number) =>
        index === transactionIndex ? updatedTransaction : transaction,
    );
    const updatedPaidAmount = updatedTransactions.reduce(
      (sum: number, transaction: PaymentTransaction) =>
        sum + Number(transaction.amount || 0),
      0,
    );

    // 1. Update Customer document (backward compat)
    const updatedCustomer = await Customer.findOneAndUpdate(
      { customerId },
      {
        $set: {
          loanStartDate,
          loanEndDate,
          [`transactions.${transactionIndex}`]: updatedTransaction,
          paidAmount: updatedPaidAmount,
        },
      },
      { returnDocument: "after" },
    );

    if (!updatedCustomer) {
      return NextResponse.json(
        { success: false, message: "Customer not found" },
        { status: 404 },
      );
    }

    // 2. Sync Collection document if transactionId exists
    const originalTxId = (existingTransaction as any)?.transactionId;
    if (originalTxId) {
      const oldAmount = Number(existingTransaction.amount ?? 0);
      const amountDiff = amount - oldAmount;

      await Collection.findOneAndUpdate(
        { transactionId: String(originalTxId) },
        {
          $set: {
            amount,
            date: updatedTransaction.date,
            note: updatedTransaction.note,
          },
        },
      );

      // 3. Sync Loan paidAmount
      if (amountDiff !== 0) {
        const loanId = String((customer as any).loanId ?? "");
        if (loanId) {
          const loan = await Loan.findOneAndUpdate(
            { loanId },
            { $inc: { paidAmount: amountDiff } },
            { new: true },
          );
          if (loan) {
            const loanRemaining = Math.max(
              Number(loan.totalWithInterest ?? 0) -
                Number(loan.paidAmount ?? 0),
              0,
            );
            await Loan.findOneAndUpdate(
              { loanId },
              {
                $set: { status: loanRemaining === 0 ? "completed" : "ongoing" },
              },
            );
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Payment updated successfully",
      customer: {
        id: updatedCustomer.customerId,
        paidAmount: updatedCustomer.paidAmount,
        transactions: updatedCustomer.transactions,
      },
      transaction: updatedTransaction,
    });
  } catch (error) {
    console.error("Failed to update payment:", error);

    return NextResponse.json(
      { success: false, message: "Failed to update payment" },
      { status: 500 },
    );
  }
}
