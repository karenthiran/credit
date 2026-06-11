import { NextRequest, NextResponse } from "next/server";

import { calculateLoanSummary } from "@/lib/calculations";
import { connectToDb } from "@/lib/dbConnect";
import { Customer } from "@/lib/model/customerModel";
import { Counter } from "@/lib/model/counterModel";

export const runtime = "nodejs";

function toNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

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

  if (duplicateError?.code !== 11000) {
    return null;
  }

  if (
    duplicateError.keyPattern?.contact ||
    duplicateError.message?.includes("contact")
  ) {
    return "contact";
  }

  return "unknown";
}

function serializeCustomer(customer: {
  customerId?: string;
  _id: { toString(): string };
  name: string;
  contact: string;
  address: string;
  loanAmount: number;
  interestRate: number;
  duration: number;
  totalWithInterest: number;
  monthlyPayment: number;
  dailyPayment: number;
  loanStartDate: Date;
  loanEndDate: Date;
  paidAmount: number;
  transactions: Array<{ amount: number; date: Date; note?: string }>;
  loanHistory?: Array<{
    loanAmount: number;
    interestRate: number;
    duration: number;
    totalWithInterest: number;
    monthlyPayment: number;
    dailyPayment: number;
    loanStartDate: Date;
    loanEndDate: Date;
    paidAmount: number;
    transactions: Array<{ amount: number; date: Date; note?: string }>;
    status?: "ongoing" | "completed";
    openedAt?: Date;
    closedAt?: Date;
  }>;
  createdAt?: Date;
  updatedAt?: Date;
}) {
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
    loanId: (customer as any).loanId,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

function buildLoanSnapshot(customer: {
  loanAmount: number;
  interestRate: number;
  duration: number;
  totalWithInterest: number;
  monthlyPayment: number;
  dailyPayment: number;
  loanStartDate?: Date;
  loanEndDate?: Date;
  paidAmount: number;
  transactions: Array<{ amount: number; date: Date; note?: string }>;
  createdAt?: Date;
  updatedAt?: Date;
  loanHistory?: Array<any>;
}) {
  const remaining = Math.max(
    Number(customer.totalWithInterest || 0) - Number(customer.paidAmount || 0),
    0,
  );

  return {
    loanAmount: customer.loanAmount,
    interestRate: customer.interestRate,
    duration: customer.duration,
    totalWithInterest: customer.totalWithInterest,
    monthlyPayment: customer.monthlyPayment,
    dailyPayment: customer.dailyPayment,
    loanStartDate: customer.loanStartDate ?? customer.createdAt,
    loanEndDate:
      customer.loanEndDate ??
      ((customer.loanStartDate ?? customer.createdAt)
        ? addMonthsUtc(
            customer.loanStartDate ?? customer.createdAt!,
            customer.duration,
          )
        : undefined),
    paidAmount: customer.paidAmount,
    transactions: customer.transactions,
    status: remaining > 0 ? ("ongoing" as const) : ("completed" as const),
    openedAt: customer.loanStartDate ?? customer.createdAt,
    closedAt:
      remaining > 0 ? undefined : (customer.loanEndDate ?? customer.updatedAt),
  };
}

export async function GET(
  _request: NextRequest,
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

    await connectToDb();

    const customer = await Customer.findOne({ customerId });

    if (!customer) {
      return NextResponse.json(
        { success: false, message: "Customer not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      customer: serializeCustomer(customer),
    });
  } catch (error) {
    console.error("Failed to fetch customer:", error);

    return NextResponse.json(
      { success: false, message: "Failed to fetch customer" },
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
    const hasContactField =
      body !== null &&
      typeof body === "object" &&
      Object.prototype.hasOwnProperty.call(body, "contact");
    const hasLoanStartDateField =
      body !== null &&
      typeof body === "object" &&
      Object.prototype.hasOwnProperty.call(body, "loanStartDate");
    const normalizedContact = hasContactField
      ? normalizePhoneNumber(String(body?.contact ?? ""))
      : undefined;
    const loanStartDate = hasLoanStartDateField
      ? parseLoanDate(body?.loanStartDate)
      : null;

    if (hasContactField && !isValidPhoneNumber(normalizedContact as string)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Phone number must start with 0 and contain exactly 10 digits",
        },
        { status: 400 },
      );
    }

    if (hasLoanStartDateField && !loanStartDate) {
      return NextResponse.json(
        { success: false, message: "Loan start date is required" },
        { status: 400 },
      );
    }

    await connectToDb();

    const existingCustomer = await Customer.findOne({ customerId });

    if (!existingCustomer) {
      return NextResponse.json(
        { success: false, message: "Customer not found" },
        { status: 404 },
      );
    }

    if (body?.newLoan) {
      const remainingBalance =
        Number(existingCustomer.totalWithInterest || 0) -
        Number(existingCustomer.paidAmount || 0);

      if (remainingBalance > 0) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Previous loan must be fully paid before adding a new loan",
          },
          { status: 400 },
        );
      }

      const loanAmount = Number.isFinite(Number(body?.loanAmount))
        ? Number(body.loanAmount)
        : NaN;
      const interestRate = Number.isFinite(Number(body?.interestRate))
        ? Number(body.interestRate)
        : NaN;
      const duration = Number.isFinite(Number(body?.duration))
        ? Number(body.duration)
        : NaN;

      if (
        [loanAmount, interestRate, duration].some((value) =>
          Number.isNaN(value),
        )
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
      const resolvedLoanStartDate =
        loanStartDate ??
        existingCustomer.loanStartDate ??
        existingCustomer.createdAt;
      const resolvedLoanEndDate = addMonthsUtc(resolvedLoanStartDate, duration);

      // preserve the existing loanId when moving to history
      const completedLoanBase = buildLoanSnapshot(existingCustomer);
      const completedLoan = {
        ...completedLoanBase,
        loanId: (existingCustomer as any).loanId,
      };

      const loanHistory = [
        ...(existingCustomer.loanHistory ?? []),
        completedLoan,
      ];

      // assign a new loanId for the fresh loan
      const newCounter = await Counter.findOneAndUpdate(
        { name: "loan" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true },
      );

      const newSeq = Number(newCounter?.seq || 0);
      const newLoanId = `L${newSeq}`;

      const customer = await Customer.findOneAndUpdate(
        { customerId },
        {
          name: body?.name ?? existingCustomer.name,
          contact: normalizedContact ?? existingCustomer.contact,
          address: body?.address ?? existingCustomer.address,
          loanAmount,
          interestRate,
          duration,
          totalWithInterest,
          monthlyPayment,
          dailyPayment,
          loanStartDate: resolvedLoanStartDate,
          loanEndDate: resolvedLoanEndDate,
          paidAmount: 0,
          transactions: [],
          loanHistory,
          loanId: newLoanId,
        },
        { new: true },
      );

      return NextResponse.json({
        success: true,
        message: "New loan added successfully",
        customer: serializeCustomer(customer),
      });
    }

    const update = {
      name: body?.name,
      contact: normalizedContact,
      address: body?.address,
      loanAmount: Number.isFinite(Number(body?.loanAmount))
        ? Number(body.loanAmount)
        : undefined,
      interestRate: Number.isFinite(Number(body?.interestRate))
        ? Number(body.interestRate)
        : undefined,
      duration: Number.isFinite(Number(body?.duration))
        ? Number(body.duration)
        : undefined,
      totalWithInterest: Number.isFinite(Number(body?.totalWithInterest))
        ? Number(body.totalWithInterest)
        : undefined,
      monthlyPayment: Number.isFinite(Number(body?.monthlyPayment))
        ? Number(body.monthlyPayment)
        : undefined,
      dailyPayment: Number.isFinite(Number(body?.dailyPayment))
        ? Number(body.dailyPayment)
        : undefined,
      loanStartDate: loanStartDate ?? undefined,
      loanEndDate:
        loanStartDate && Number.isFinite(Number(body?.duration))
          ? addMonthsUtc(loanStartDate, Number(body.duration))
          : undefined,
      paidAmount: Number.isFinite(Number(body?.paidAmount))
        ? Number(body.paidAmount)
        : undefined,
    };

    Object.keys(update).forEach((key) => {
      if (update[key as keyof typeof update] === undefined) {
        delete update[key as keyof typeof update];
      }
    });

    const customer = await Customer.findOneAndUpdate({ customerId }, update, {
      new: true,
    });

    return NextResponse.json({
      success: true,
      customer: serializeCustomer(customer),
    });
  } catch (error) {
    const duplicateField = getDuplicateField(error);

    if (duplicateField === "contact") {
      return NextResponse.json(
        { success: false, message: "Customer phone number already exists" },
        { status: 409 },
      );
    }

    console.error("Failed to update customer:", error);

    return NextResponse.json(
      { success: false, message: "Failed to update customer" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
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

    await connectToDb();

    const customer = await Customer.findOneAndDelete({ customerId });

    if (!customer) {
      return NextResponse.json(
        { success: false, message: "Customer not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Customer deleted successfully",
    });
  } catch (error) {
    console.error("Failed to delete customer:", error);

    return NextResponse.json(
      { success: false, message: "Failed to delete customer" },
      { status: 500 },
    );
  }
}
