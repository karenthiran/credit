import { NextResponse } from "next/server";

import { connectToDb } from "@/lib/dbConnect";
import { Customer } from "@/lib/model/customerModel";
import { Loan } from "@/lib/model/loanModel";
import { Collection } from "@/lib/model/collectionModel";

export const runtime = "nodejs";

/**
 * POST /api/migrate
 *
 * One-time migration that reads all existing Customer documents and
 * seeds the new `Loan` and `Collection` collections.
 *
 * Safe to call multiple times — existing Loan / Collection documents are
 * skipped (upsert by loanId / transactionId) so no data is duplicated.
 *
 * Returns a summary of how many documents were created / skipped.
 */
export async function POST() {
  try {
    await connectToDb();

    const customers = await Customer.find({}).lean();

    let loansCreated = 0;
    let loansSkipped = 0;
    let collectionsCreated = 0;
    let collectionsSkipped = 0;
    const errors: string[] = [];

    for (const customer of customers) {
      const customerId = String(customer.customerId);
      const customerName = String(customer.name);

      // ----------------------------------------------------------------
      // Build all loans for this customer
      // ----------------------------------------------------------------

      // Helper: build a single Loan document from a loan-shaped object
      const buildLoanDoc = (loanData: any, isCurrentLoan: boolean) => {
        const paidAmount = Number(loanData.paidAmount ?? 0);
        const totalWithInterest = Number(loanData.totalWithInterest ?? 0);
        const remaining = Math.max(totalWithInterest - paidAmount, 0);

        return {
          loanId: String(loanData.loanId),
          customerId,
          customerName,
          loanAmount: Number(loanData.loanAmount ?? 0),
          interestRate: Number(loanData.interestRate ?? 0),
          duration: Number(loanData.duration ?? 0),
          totalWithInterest,
          monthlyPayment: Number(loanData.monthlyPayment ?? 0),
          dailyPayment: Number(loanData.dailyPayment ?? 0),
          loanStartDate:
            loanData.loanStartDate ?? loanData.openedAt ?? customer.createdAt,
          loanEndDate: loanData.loanEndDate ?? loanData.closedAt,
          paidAmount,
          status: loanData.status ?? (remaining > 0 ? "ongoing" : "completed"),
          openedAt:
            loanData.openedAt ?? loanData.loanStartDate ?? customer.createdAt,
          closedAt:
            loanData.closedAt ??
            (remaining === 0 ? loanData.loanEndDate : undefined),
        };
      };

      // Collect all loans (current + history)
      const allLoans: any[] = [];

      // Current active loan — only if it has a loanId
      if (customer.loanId) {
        allLoans.push(buildLoanDoc(customer, true));
      }

      // Historical loans
      const loanHistory: any[] = (customer as any).loanHistory ?? [];
      for (const histLoan of loanHistory) {
        if (histLoan.loanId) {
          allLoans.push(buildLoanDoc(histLoan, false));
        }
      }

      // Upsert each loan
      for (const loanDoc of allLoans) {
        try {
          const result = await Loan.updateOne(
            { loanId: loanDoc.loanId },
            { $setOnInsert: loanDoc },
            { upsert: true },
          );
          if (result.upsertedCount > 0) {
            loansCreated++;
          } else {
            loansSkipped++;
          }
        } catch (err: any) {
          errors.push(`Loan ${loanDoc.loanId}: ${err.message}`);
        }
      }

      // ----------------------------------------------------------------
      // Build all collections (transactions) for this customer
      // ----------------------------------------------------------------

      // Helper: build Collection documents from a transactions array
      const buildCollectionDocs = (transactions: any[], loanId: string) => {
        return transactions
          .filter((tx: any) => tx.transactionId)
          .map((tx: any) => ({
            transactionId: String(tx.transactionId),
            customerId,
            customerName,
            loanId,
            amount: Number(tx.amount ?? 0),
            date: tx.date ?? new Date(),
            note: tx.note ?? "Payment received",
            profit: Number(tx.profit ?? 0),
          }));
      };

      // Current loan transactions
      if (customer.loanId) {
        const currentTxDocs = buildCollectionDocs(
          (customer as any).transactions ?? [],
          String(customer.loanId),
        );
        for (const colDoc of currentTxDocs) {
          try {
            const result = await Collection.updateOne(
              { transactionId: colDoc.transactionId },
              { $setOnInsert: colDoc },
              { upsert: true },
            );
            if (result.upsertedCount > 0) {
              collectionsCreated++;
            } else {
              collectionsSkipped++;
            }
          } catch (err: any) {
            errors.push(`Collection ${colDoc.transactionId}: ${err.message}`);
          }
        }
      }

      // Historical loan transactions
      for (const histLoan of loanHistory) {
        if (!histLoan.loanId) continue;
        const histTxDocs = buildCollectionDocs(
          histLoan.transactions ?? [],
          String(histLoan.loanId),
        );
        for (const colDoc of histTxDocs) {
          try {
            const result = await Collection.updateOne(
              { transactionId: colDoc.transactionId },
              { $setOnInsert: colDoc },
              { upsert: true },
            );
            if (result.upsertedCount > 0) {
              collectionsCreated++;
            } else {
              collectionsSkipped++;
            }
          } catch (err: any) {
            errors.push(`Collection ${colDoc.transactionId}: ${err.message}`);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Migration completed",
      summary: {
        customersProcessed: customers.length,
        loansCreated,
        loansSkipped,
        collectionsCreated,
        collectionsSkipped,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error("Migration failed:", error);
    return NextResponse.json(
      { success: false, message: "Migration failed", error: String(error) },
      { status: 500 },
    );
  }
}

/**
 * GET /api/migrate
 * Returns a count of how many documents are in each collection,
 * useful to verify migration status.
 */
export async function GET() {
  try {
    await connectToDb();

    const [customerCount, loanCount, collectionCount] = await Promise.all([
      Customer.countDocuments(),
      Loan.countDocuments(),
      Collection.countDocuments(),
    ]);

    return NextResponse.json({
      success: true,
      counts: {
        customers: customerCount,
        loans: loanCount,
        collections: collectionCount,
      },
    });
  } catch (error) {
    console.error("Failed to fetch migration status:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch migration status" },
      { status: 500 },
    );
  }
}
