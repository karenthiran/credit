import { NextRequest, NextResponse } from "next/server";

import { connectToDb } from "@/lib/dbConnect";
import { Loan } from "@/lib/model/loanModel";

export const runtime = "nodejs";

/**
 * GET /api/loans
 * Returns all loans sorted by loanId descending (e.g. L10, L9, L8...).
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

    const loans = await Loan.find(query).sort({ _id: -1 }).lean();

    // Sort by numeric part of loanId descending (L10 > L9 > L8...)
    const sorted = loans.slice().sort((a, b) => {
      const numA = Number(String(a.loanId).replace(/\D+/g, ""));
      const numB = Number(String(b.loanId).replace(/\D+/g, ""));
      return numB - numA;
    });

    return NextResponse.json({ success: true, loans: sorted });
  } catch (error) {
    console.error("Failed to fetch loans:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch loans" },
      { status: 500 },
    );
  }
}
