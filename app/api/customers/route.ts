import { NextRequest, NextResponse } from "next/server";

import { calculateLoanSummary } from "@/lib/calculations";
import { connectToDb } from "@/lib/dbConnect";
import { Customer } from "@/lib/model/customerModel";
import { Counter } from "@/lib/model/counterModel";
import { Loan } from "@/lib/model/loanModel";

export const runtime = "nodejs";

function normalizePhoneNumber(value: string) {
  return value.trim().replace(/\D/g, "");
}

function normalizeCustomerId(value: string) {
  return value.trim().toUpperCase();
}

function parseLoanDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
    ? null
    : date;
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

function isValidCustomerId(value: string) {
  return /^[A-Z0-9]+$/.test(value);
}

function isValidPhoneNumber(value: string) {
  return /^0\d{9}$/.test(value);
}

function getDuplicateField(error: unknown) {
  const duplicateError = error as {
    code?: number;
    keyPattern?: Record<string, number>;
    message?: string;
  };
  if (duplicateError?.code !== 11000) return null;
  if (
    duplicateError.keyPattern?.contact ||
    duplicateError.message?.includes("contact")
  ) {
    return "contact";
  }
  if (
    duplicateError.keyPattern?.customerId ||
    duplicateError.message?.includes("customerId")
  ) {
    return "customerId";
  }
  return "unknown";
}

function serializeCustomer(customer: any) {
  const remaining = Math.max(
    Number(customer.totalWithInterest || 0) - Number(customer.paidAmount || 0),
    0,
  );
  return {
    id: customer.customerId,
    mongoId: customer._id.toString(),
    name: customer.name,
    contact: customer.contact,
    address: customer.address,
    loanAmount: customer.loanAmount,
    interestRate: customer.interestRate,
    duration: customer.duration,
    totalWithInterest: customer.totalWithInterest,
    monthlyPayment: customer.monthlyPayment,
    dailyPayment: customer.dailyPayment,
    loanStartDate: customer.loanStartDate,
    loanEndDate: customer.loanEndDate,
    openedAt: customer.loanStartDate,
    closedAt:
      remaining > 0 ? undefined : (customer.loanEndDate ?? customer.updatedAt),
    paidAmount: customer.paidAmount,
    transactions: customer.transactions,
    loanHistory: customer.loanHistory ?? [],
    loanId: customer.loanId,
    status: remaining > 0 ? "ongoing" : "completed",
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

/**
 * GET /api/customers
 * List all customers, optionally filtered by ?search= or ?identifier=
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDb();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const identifier = searchParams.get("identifier");

    let query: Record<string, unknown> = {};

    if (identifier) {
      // Search by customerId or contact (phone)
      const normalized = identifier.trim().toUpperCase();
      const normalizedPhone = identifier.trim().replace(/\D/g, "");
      query = {
        $or: [{ customerId: normalized }, { contact: normalizedPhone }],
      };
    } else if (search) {
      const normalized = search.trim().toUpperCase();
      const normalizedPhone = search.trim().replace(/\D/g, "");
      query = {
        $or: [
          { customerId: { $regex: normalized, $options: "i" } },
          { name: { $regex: search.trim(), $options: "i" } },
          { contact: { $regex: normalizedPhone } },
        ],
      };
    }

    const customers = await Customer.find(query).sort({ createdAt: -1 }).lean();

    return NextResponse.json({
      success: true,
      customers: customers.map(serializeCustomer),
    });
  } catch (error) {
    console.error("Failed to fetch customers:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch customers" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/customers
 * Create a new customer with their first loan
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    const customerId = normalizeCustomerId(String(body?.customerId ?? ""));
    const contact = normalizePhoneNumber(String(body?.contact ?? ""));
    const loanStartDate = parseLoanDate(body?.loanStartDate);

    if (!customerId || !isValidCustomerId(customerId)) {
      return NextResponse.json(
        { success: false, message: "Valid customer ID is required" },
        { status: 400 },
      );
    }

    if (!contact || !isValidPhoneNumber(contact)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Phone number must start with 0 and contain exactly 10 digits",
        },
        { status: 400 },
      );
    }

    if (!loanStartDate) {
      return NextResponse.json(
        { success: false, message: "Loan start date is required" },
        { status: 400 },
      );
    }

    const loanAmount = Number(body?.loanAmount);
    const interestRate = Number(body?.interestRate);
    const duration = Number(body?.duration);

    if (
      !Number.isFinite(loanAmount) ||
      !Number.isFinite(interestRate) ||
      !Number.isFinite(duration)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Loan amount, interest rate, and duration are required",
        },
        { status: 400 },
      );
    }

    const defaultLoanSummary = calculateLoanSummary(
      loanAmount,
      interestRate,
      duration,
    );
    const totalWithInterest =
      Number(body?.totalWithInterest) || defaultLoanSummary.totalWithInterest;
    const monthlyPayment =
      Number(body?.monthlyPayment) || defaultLoanSummary.monthlyPayment;
    const dailyPayment =
      Number(body?.dailyPayment) || defaultLoanSummary.dailyPayment;
    const loanEndDate = addMonthsUtc(loanStartDate, duration);

    await connectToDb();

    // Generate a loan ID
    const loanCounter = await Counter.findOneAndUpdate(
      { name: "loan" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    );
    const loanId = `L${Number(loanCounter?.seq || 0)}`;

    const customer = await Customer.create({
      customerId,
      name: String(body?.name ?? "").trim(),
      contact,
      address: String(body?.address ?? "").trim(),
      loanAmount,
      interestRate,
      duration,
      totalWithInterest,
      monthlyPayment,
      dailyPayment,
      loanStartDate,
      loanEndDate,
      paidAmount: 0,
      transactions: [],
      loanHistory: [],
      loanId,
    });

    // Also create the Loan document in the new Loan collection
    await Loan.create({
      loanId,
      customerId,
      customerName: customer.name,
      loanAmount,
      interestRate,
      duration,
      totalWithInterest,
      monthlyPayment,
      dailyPayment,
      loanStartDate,
      loanEndDate,
      paidAmount: 0,
      status: "ongoing",
      openedAt: loanStartDate,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Customer created successfully",
        customer: serializeCustomer(customer),
      },
      { status: 201 },
    );
  } catch (error) {
    const duplicateField = getDuplicateField(error);
    if (duplicateField === "contact") {
      return NextResponse.json(
        { success: false, message: "Customer phone number already exists" },
        { status: 409 },
      );
    }
    if (duplicateField === "customerId") {
      return NextResponse.json(
        { success: false, message: "Customer ID already exists" },
        { status: 409 },
      );
    }
    console.error("Failed to create customer:", error);
    return NextResponse.json(
      { success: false, message: "Failed to create customer" },
      { status: 500 },
    );
  }
}
