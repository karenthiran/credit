"use client";

import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type DashboardSummary = {
  totalLoanGiven: number;
  totalCollected: number;
  pendingLoan: number;
  activeCustomers: number;
  profitFromLoanInterest: number;
  monthlyProfit?: number;
  monthName?: string;
  monthlyCollected?: number;
  monthlyLoanGiven?: number;
  totalCustomers?: number;
  todaysCollected?: number;
  todaysProfit?: number;
  recentTransactions: Array<{
    txId?: string;
    customerId: string;
    customerName: string;
    amount: number;
    date: string;
    note?: string;
    loanStatus?: "ongoing" | "completed";
    remaining?: number;
  }>;
};

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const formatCurrency = (amount: number) => `Rs. ${amount.toFixed(2)}`;

  useEffect(() => {
    async function loadSummary() {
      setLoading(true);

      try {
        const response = await fetch("/api/dashboard/summary");
        const data = await response.json();

        if (!response.ok || !data.success) {
          setSummary(null);
          return;
        }

        setSummary(data.summary as DashboardSummary);
      } finally {
        setLoading(false);
      }
    }

    void loadSummary();
  }, []);

  const totalLoanGiven = summary?.totalLoanGiven ?? 0;
  const totalCollected = summary?.totalCollected ?? 0;
  const pendingLoan = summary?.pendingLoan ?? 0;
  const activeCustomers = summary?.activeCustomers ?? 0;
  const profitFromLoanInterest = summary?.profitFromLoanInterest ?? 0;
  const monthlyProfit = summary?.monthlyProfit ?? 0;
  const monthlyCollected = summary?.monthlyCollected ?? 0;
  const monthlyLoanGiven = summary?.monthlyLoanGiven ?? 0;
  const totalCustomers = summary?.totalCustomers ?? 0;
  const todaysCollected = summary?.todaysCollected ?? 0;
  const todaysProfit = summary?.todaysProfit ?? 0;
  const monthName =
    summary?.monthName ??
    new Date().toLocaleString(undefined, { month: "long" });
  const recentTransactions = [...(summary?.recentTransactions ?? [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return (
    <div className="p-6 space-y-6">
      {/* TITLE */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Live loan portfolio overview
        </p>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total loan amount given — {monthName}</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-bold">
            {formatCurrency(monthlyLoanGiven)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly profit — {monthName}</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-bold text-indigo-600">
            {formatCurrency(monthlyProfit)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Total amount collected from customers — {monthName}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-bold text-green-600">
            {formatCurrency(monthlyCollected)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active customers</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-bold">
            {loading ? "Loading..." : activeCustomers}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total loan amount given (all months)</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-bold">
            {formatCurrency(totalLoanGiven)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total profit (all months)</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-bold text-indigo-600">
            {formatCurrency(profitFromLoanInterest)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending loans</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-bold text-red-600">
            {formatCurrency(pendingLoan)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total customers</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-bold">
            {loading ? "Loading..." : totalCustomers}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today's Collected Amount</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-bold text-green-600">
            {formatCurrency(todaysCollected)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today's Profit</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-bold text-blue-600">
            {formatCurrency(todaysProfit)}
          </CardContent>
        </Card>
      </div>

      {/* RECENT TRANSACTIONS */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {recentTransactions.length > 0 ? (
                recentTransactions.map((t) => (
                  <TableRow
                    key={t.txId ?? `${t.customerId}-${t.date}-${t.amount}`}
                  >
                    <TableCell>
                      {t.customerId} - {t.customerName}
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          t.loanStatus === "completed"
                            ? "text-green-600 font-medium"
                            : "text-orange-600 font-medium"
                        }
                      >
                        {t.loanStatus === "completed" ? "Completed" : "Ongoing"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {new Date(t.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-green-600 font-medium">
                      Rs. {t.amount.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="h-24 text-center text-zinc-500"
                  >
                    No transactions yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
