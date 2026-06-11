import { NextRequest, NextResponse } from "next/server";

import { connectToDb } from "@/lib/dbConnect";
import { Loan } from "@/lib/model/loanModel";
import { Collection } from "@/lib/model/collectionModel";
import { calculateLoanSummary } from "@/lib/calculations";
import { Customer } from "@/lib/model/customerModel";
import { Counter } from "@/lib/model/counterModel";

export const runtime = "nodejs";

/**
 * GET /api/loans
 *
 * Returns all loans from the Loan collection.
 * Supports optional query params:
 *   ?customerId=C01  — filter by customer
 *   ?status=ongoing  — filter by status (ongoing | completed)
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDb();

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");
    const status = searchParams.get("status");

    const query: Record<string, string> = {};
    if (customerId) query.customerId = customerId.toUpperCase();
    if (status) query.status = status;

    const loans = await Loan.find(query).sort({ openedAt: -1 }).lean();

    return NextResponse.json({ success: true, loans });
  } catch (error) {
    console.error("Failed to fetch loans:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch loans" },
      { status: 500 },
    );
  }
}
