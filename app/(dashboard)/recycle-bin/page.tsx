"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

type DeletedLoan = {
  loanId: string;
  customerName: string;
  customerId: string;
  loanAmount: number;
  interestRate: number;
  duration: number;
  totalWithInterest: number;
};

export default function RecycleBin() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [deletedLoans, setDeletedLoans] = useState<DeletedLoan[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    async function checkAccess() {
      try {
        const response = await fetch("/api/auth/me");
        const data = await response.json();

        if (!response.ok || !data.success) {
          router.push("/login");
          return;
        }

        const role = data.user?.role;
        setUserRole(role);

        if (role !== "admin") {
          router.push("/dashboard");
          return;
        }

        await loadDeletedLoans();
      } catch {
        router.push("/login");
      }
    }

    void checkAccess();
  }, [router]);

  async function loadDeletedLoans() {
    setLoading(true);
    try {
      // TODO: Replace with actual API endpoint for deleted loans
      // For now, showing empty state
      setDeletedLoans([]);
    } catch {
      setDeletedLoans([]);
    } finally {
      setLoading(false);
    }
  }

  if (userRole !== "admin") {
    return null;
  }

  return (
    <div className="w-full p-3 sm:p-6 space-y-4">
      {/* HEADER */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Deleted Loans</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          View and manage deleted loan records
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

              <TableHead className="whitespace-nowrap text-xs sm:text-sm">
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
                Action
              </TableHead>
            </TableRow>
          </TableHeader>

          {/* TABLE BODY */}
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-zinc-500 text-xs sm:text-sm"
                >
                  Loading deleted loans...
                </TableCell>
              </TableRow>
            ) : deletedLoans.length > 0 ? (
              deletedLoans.map((loan) => (
                <TableRow key={loan.loanId}>
                  <TableCell className="font-medium text-xs sm:text-sm whitespace-nowrap">
                    {loan.loanId}
                  </TableCell>
                  <TableCell className="text-xs sm:text-sm whitespace-nowrap">
                    {loan.customerName}
                  </TableCell>
                  <TableCell className="text-xs sm:text-sm whitespace-nowrap">
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
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs sm:text-sm"
                    >
                      Restore
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-zinc-500 text-xs sm:text-sm"
                >
                  No deleted loans found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
