"use client";

import { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ProfitFilter = "monthly" | "custom" | "daily";

type ProfitRow = {
  customerId: string;
  customerName: string;
  paymentAmount: number;
  interestRate: number;
  profit: number;
  date: string;
};

type ProfitApiResponse = {
  rows: ProfitRow[];
  totalProfit: number;
  totalPayments: number;
  totalProfitOngoing?: number;
  totalProfitCompleted?: number;
};

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toMonthInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function Profits() {
  const [filter, setFilter] = useState<ProfitFilter>("monthly");
  const [month, setMonth] = useState(toMonthInputValue(new Date()));
  const [dailyDate, setDailyDate] = useState(toDateInputValue(new Date()));
  const [startDate, setStartDate] = useState(toDateInputValue(new Date()));
  const [endDate, setEndDate] = useState(toDateInputValue(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<ProfitApiResponse>({
    rows: [],
    totalProfit: 0,
    totalPayments: 0,
  });

  const filterLabel = filter === "monthly" ? "Monthly" : filter === "daily" ? "Daily" : "Custom Range";

  const formatCurrency = (amount: number) => {
    const roundedAmount = Number(amount.toFixed(2));
    return `Rs. ${roundedAmount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  useEffect(() => {
    async function loadProfits() {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({ filter });
        
        if (filter === "monthly") {
          params.set("month", month);
        } else if (filter === "daily") {
          params.set("date", dailyDate);
        } else {
          params.set("startDate", startDate);
          params.set("endDate", endDate);
        }

        const response = await fetch(
          `/api/dashboard/profits?${params.toString()}`,
        );
        const result = await response.json();

        if (!response.ok || !result.success) {
          setData({ rows: [], totalProfit: 0, totalPayments: 0 });
          setError(result?.message ?? "Failed to load profits");
          return;
        }

        setData(result.data as ProfitApiResponse);
      } catch {
        setData({ rows: [], totalProfit: 0, totalPayments: 0 });
        setError("Failed to load profits");
      } finally {
        setLoading(false);
      }
    }

    void loadProfits();
  }, [filter, month, dailyDate, startDate, endDate]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Profit Analysis</h1>
        <p className="text-sm text-muted-foreground">
          Profit table from loan-interest collections with dynamic date filters
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter Options</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="space-y-1">
              <div className="text-sm font-medium">Filter Type</div>
              <Select value={filter} onValueChange={(v) => setFilter(v as ProfitFilter)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filter === "monthly" ? (
              <div className="space-y-1">
                <div className="text-sm font-medium">Month</div>
                <Input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="w-[190px]"
                />
              </div>
            ) : filter === "daily" ? (
              <div className="space-y-1">
                <div className="text-sm font-medium">Date</div>
                <Input
                  type="date"
                  value={dailyDate}
                  onChange={(e) => setDailyDate(e.target.value)}
                  className="w-[190px]"
                />
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <div className="text-sm font-medium">Start Date</div>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-[170px]"
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">End Date</div>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-[170px]"
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Total Payments ({filterLabel})</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-bold text-green-600">
            {formatCurrency(data.totalPayments)}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-2">
          <Card>
            <CardHeader>
              <CardTitle>Total Profit ({filterLabel})</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-bold text-blue-600">
              {formatCurrency(data.totalProfit)}
            </CardContent>
          </Card>

        </div>
      </div>

    
    </div>
  );
}
