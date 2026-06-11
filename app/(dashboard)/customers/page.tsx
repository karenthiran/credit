"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import AddCustomerDialog from "@/components/AddCustomerDialog";
import EditCustomerDialog from "@/components/EditCustomerDialog";

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(true);

  async function loadCustomers(searchTerm = "") {
    setLoading(true);

    try {
      const response = await fetch(
        `/api/customers${searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : ""}`,
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        setCustomers([]);
        return;
      }

      setCustomers(data.customers ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCustomers();
  }, []);

  return (
    <div className="w-full p-3 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Title */}
        <h1 className="text-2xl font-bold">Customers</h1>

        {/* Right Side */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:flex-none sm:w-80">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
            />

            <Input
              type="text"
              placeholder="Search customers..."
              value={search}
              onChange={(e) => {
                const value = e.target.value;
                setSearch(value);
                void loadCustomers(value);
              }}
              className="pl-10 h-10 rounded-xl w-full"
            />
          </div>

          {/* Add Customer Button */}
          <div className="w-full sm:w-auto">
            <AddCustomerDialog onCustomerSaved={() => void loadCustomers()} />
          </div>
        </div>
      </div>
      {/* Table */}
      <div className="rounded-xl border bg-white overflow-hidden overflow-x-auto">
        <Table>
          {/* Table Header */}
          <TableHeader className="bg-zinc-50">
            <TableRow>
              <TableHead className="w-12 sm:w-20">ID</TableHead>
              <TableHead className="whitespace-nowrap">Name</TableHead>
              <TableHead className="hidden sm:table-cell whitespace-nowrap">
                Contact
              </TableHead>
              <TableHead className="hidden md:table-cell whitespace-nowrap">
                Address
              </TableHead>
              <TableHead className="whitespace-nowrap">Loan</TableHead>
              <TableHead className="hidden sm:table-cell whitespace-nowrap">
                Interest
              </TableHead>
              <TableHead className="hidden md:table-cell whitespace-nowrap">
                Duration
              </TableHead>
              <TableHead className="text-right whitespace-nowrap">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>

          {/* Table Body */}
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-zinc-500"
                >
                  Loading customers...
                </TableCell>
              </TableRow>
            ) : customers.length > 0 ? (
              customers
                .sort((a, b) => a.id - b.id)
                .map((c, index) => (
                  <TableRow
                    key={`${String(c.id ?? "missing")}-${String(c.mongoId ?? index)}`}
                    className="hover:bg-zinc-50 transition"
                  >
                    <TableCell className="font-medium text-sm sm:text-base">
                      {c.id}
                    </TableCell>

                    <TableCell className="text-sm sm:text-base">
                      {c.name}
                    </TableCell>

                    <TableCell className="hidden sm:table-cell text-sm">
                      {c.contact}
                    </TableCell>

                    <TableCell className="hidden md:table-cell text-sm">
                      {c.address}
                    </TableCell>

                    <TableCell className="text-xs sm:text-sm font-medium">
                      Rs. {Number(c.loanAmount).toLocaleString()}
                    </TableCell>

                    <TableCell className="hidden sm:table-cell text-sm">
                      {c.interestRate}%
                    </TableCell>

                    <TableCell className="hidden md:table-cell text-sm">
                      {c.duration}mo
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <EditCustomerDialog customer={c} onCustomerSaved={() => void loadCustomers()} />

                        <Link href={`/customers/${c.id}`}>
                          <Button
                            size="sm"
                            className="rounded-lg cursor-pointer text-xs sm:text-sm"
                          >
                            View
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-zinc-500 text-sm"
                >
                  No customers found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
