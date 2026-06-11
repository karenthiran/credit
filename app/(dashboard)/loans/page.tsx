"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  calculateRemainingBalance,
  determineLoanStatus,
} from "@/lib/calculations";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Loan = {
  loanId: string;
  customerId: string;
  customerName: string;
  loanAmount: number;
  interestRate: number;
  duration: number;
  totalWithInterest: number;
  paidAmount: number;
  status: "ongoing" | "completed";
  openedAt?: string | Date;
  closedAt?: string | Date;
};

export default function Loans() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLoans() {
      setLoading(true);
      try {
        const response = await fetch("/api/loans");
        const data = await response.json();

        if (!response.ok || !data.success) {
          setLoans([]);
          return;
        }

        setLoans(data.loans ?? []);
      } finally {
        setLoading(false);
      }
    }

    void loadLoans();
  }, []);

  return (
    <div className="w-full p-3 sm:p-6 space-y-4">
      {/* HEADER */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Loans</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Individual customer loan details
        </p>
      </div>

      <div className="rounded-xl border bg-white overflow-hidden overflow-x-auto">
        <Table>
          {/* TABLE HEADER */}
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap text-xs sm:text-sm">
                Loan ID
              </TableHead>

              <TableHead className="whitespace-nowrap text-xs sm:text-sm">
                Customer Name
              </TableHead>

              <TableHead className="hidden sm:table-cell whitespace-nowrap text-xs sm:text-sm">
                Customer ID
              </TableHead>

              <TableHead className="whitespace-nowrap text-xs sm:text-sm">
                Loan Amount
              </TableHead>

              <TableHead className="hidden md:table-cell whitespace-nowrap text-xs sm:text-sm">
                Interest
              </TableHead>

              <TableHead className="hidden md:table-cell whitespace-nowrap text-xs sm:text-sm">
                Duration
              </TableHead>

              <TableHead className="hidden lg:table-cell whitespace-nowrap text-xs sm:text-sm">
                Total Payable
              </TableHead>

              <TableHead className="whitespace-nowrap text-xs sm:text-sm">
                Remaining
              </TableHead>

              <TableHead className="whitespace-nowrap text-xs sm:text-sm">
                Status
              </TableHead>
            </TableRow>
          </TableHeader>

          {/* TABLE BODY */}
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="h-24 text-center text-zinc-500 text-xs sm:text-sm"
                >
                  Loading loans...
                </TableCell>
              </TableRow>
            ) : loans.length > 0 ? (
              loans.map((loan) => {
                const remaining = calculateRemainingBalance(
                  loan.totalWithInterest,
                  loan.paidAmount,
                );
                const completed = loan.status === "completed" || remaining <= 0;

                return (
                  <TableRow key={loan.loanId}>
                    <TableCell className="font-medium text-xs sm:text-sm whitespace-nowrap">
                      {loan.loanId}
                    </TableCell>

                    <TableCell className="text-xs sm:text-sm whitespace-nowrap">
                      {loan.customerName}
                    </TableCell>

                    <TableCell className="hidden sm:table-cell text-xs sm:text-sm whitespace-nowrap">
                      {loan.customerId}
                    </TableCell>

                    <TableCell className="text-xs sm:text-sm whitespace-nowrap">
                      Rs. {loan.loanAmount.toLocaleString()}
                    </TableCell>

                    <TableCell className="hidden md:table-cell text-xs sm:text-sm whitespace-nowrap">
                      {loan.interestRate}%
                    </TableCell>

                    <TableCell className="hidden md:table-cell text-xs sm:text-sm whitespace-nowrap">
                      {loan.duration} Months
                    </TableCell>

                    <TableCell className="hidden lg:table-cell font-medium text-xs sm:text-sm whitespace-nowrap">
                      Rs. {loan.totalWithInterest.toLocaleString()}
                    </TableCell>

                    <TableCell className="font-medium text-xs sm:text-sm whitespace-nowrap">
                      Rs. {remaining.toLocaleString()}
                    </TableCell>

                    <TableCell className="whitespace-nowrap">
                      {completed ? (
                        <Badge
                          className="bg-green-500 text-xs"
                          variant="default"
                        >
                          Completed
                        </Badge>
                      ) : (
                        <Badge className="text-xs" variant="destructive">
                          Active
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="h-24 text-center text-zinc-500 text-xs sm:text-sm"
                >
                  No loans found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
