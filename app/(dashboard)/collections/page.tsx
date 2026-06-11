"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type CollectionRecord = {
  transactionId: string;
  customerId: string;
  customerName: string;
  loanId: string;
  amount: number;
  date: string | Date;
  note?: string;
  profit?: number;
};

type CustomerSearch = {
  id: string;
  name: string;
  loanId: string;
  totalWithInterest: number;
  paidAmount: number;
  contact: string;
};

export default function Collections() {
  const [search, setSearch] = useState("");
  const [amount, setAmount] = useState("");
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Add-payment dialog
  const [addPaymentDialogOpen, setAddPaymentDialogOpen] = useState(false);
  const [dialogSearchId, setDialogSearchId] = useState("");
  const [dialogCustomer, setDialogCustomer] = useState<CustomerSearch | null>(
    null,
  );
  const [dialogDate, setDialogDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogSubmitLoading, setDialogSubmitLoading] = useState(false);

  // Edit-payment dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCollection, setEditingCollection] =
    useState<CollectionRecord | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [editLoading, setEditLoading] = useState(false);

  async function loadCollections(searchTerm = search) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set("search", searchTerm);

      const response = await fetch(
        `/api/collections${params.toString() ? `?${params.toString()}` : ""}`,
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        setCollections([]);
        return;
      }

      setCollections(data.collections ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCollections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toLocalDateKey(value: string | Date | number | null | undefined) {
    if (!value) return "";
    const date = new Date(value as string | number);
    if (Number.isNaN(date.getTime())) return "";
    return (
      date.getFullYear() +
      "-" +
      String(date.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(date.getDate()).padStart(2, "0")
    );
  }

  // Apply date filter to collections
  const filtered = collections.filter((c) => {
    if (dateFilter === "all") return true;

    const dateKey = toLocalDateKey(c.date);
    if (!dateKey) return false;

    if (dateFilter === "today") {
      return dateKey === toLocalDateKey(new Date());
    }

    if (dateFilter === "last7days") {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      return (
        dateKey >= toLocalDateKey(sevenDaysAgo) &&
        dateKey <= toLocalDateKey(new Date())
      );
    }

    if (dateFilter === "custom") {
      if (!customStartDate && !customEndDate) return false;
      if (customStartDate && dateKey < customStartDate) return false;
      if (customEndDate && dateKey > customEndDate) return false;
      return true;
    }

    return true;
  });

  async function searchCustomerByIdOrPhone() {
    const identifier = dialogSearchId.trim();
    if (!identifier) {
      setDialogCustomer(null);
      return;
    }

    setDialogLoading(true);
    try {
      const resp = await fetch(
        `/api/customers?identifier=${encodeURIComponent(identifier)}`,
      );
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        setDialogCustomer(null);
        return;
      }

      const found =
        Array.isArray(data.customers) && data.customers.length > 0
          ? data.customers[0]
          : null;

      setDialogCustomer(
        found
          ? {
              id: found.id,
              name: found.name,
              loanId: found.loanId,
              totalWithInterest: found.totalWithInterest,
              paidAmount: found.paidAmount,
              contact: found.contact,
            }
          : null,
      );
    } finally {
      setDialogLoading(false);
    }
  }

  async function submitDialogPayment() {
    if (!dialogCustomer) return;

    const paymentAmount = Number(amount);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) return;

    const remainingBalance = Math.max(
      Number(dialogCustomer.totalWithInterest || 0) -
        Number(dialogCustomer.paidAmount || 0),
      0,
    );

    if (paymentAmount > remainingBalance) {
      toast.error(
        `Payment amount (Rs. ${paymentAmount.toLocaleString()}) exceeds remaining balance (Rs. ${remainingBalance.toLocaleString()}).`,
      );
      return;
    }

    setDialogSubmitLoading(true);
    try {
      const response = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: dialogCustomer.id,
          loanId: dialogCustomer.loanId,
          amount: paymentAmount,
          date: new Date(dialogDate).toISOString(),
        }),
      });

      if (response.ok) {
        setAmount("");
        setDialogCustomer(null);
        setDialogSearchId("");
        setDialogDate(new Date().toISOString().slice(0, 10));
        setAddPaymentDialogOpen(false);
        void loadCollections(search);
      } else {
        const errorData = await response.json();
        toast.error(`Payment failed: ${errorData.message || "Unknown error"}`);
      }
    } catch (error) {
      toast.error("Failed to submit payment");
    } finally {
      setDialogSubmitLoading(false);
    }
  }

  function openEditDialog(col: CollectionRecord) {
    setEditingCollection(col);
    setEditAmount(String(col.amount ?? ""));
    setEditDate(
      col.date
        ? new Date(col.date).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
    );
    setEditDialogOpen(true);
  }

  async function submitEditPayment() {
    if (!editingCollection) return;

    const paymentAmount = Number(editAmount);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) return;

    setEditLoading(true);
    try {
      const response = await fetch("/api/collections", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: editingCollection.transactionId,
          amount: paymentAmount,
          date: new Date(editDate).toISOString(),
          note: editingCollection.note,
        }),
      });

      if (response.ok) {
        setEditDialogOpen(false);
        setEditingCollection(null);
        setEditAmount("");
        setEditDate(new Date().toISOString().slice(0, 10));
        void loadCollections(search);
      } else {
        const errorData = await response.json();
        toast.error(`Update failed: ${errorData.message || "Unknown error"}`);
      }
    } finally {
      setEditLoading(false);
    }
  }

  return (
    <div className="p-3 sm:p-6 space-y-4">
      {/* HEADER */}
      <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-xl sm:text-2xl font-bold">Collections</h1>

        <div className="flex flex-col gap-2 sm:gap-3 lg:flex-row lg:items-start lg:justify-between w-full lg:w-auto">
          <div className="flex flex-col gap-2 sm:gap-3 lg:flex-row lg:items-center">
            <Input
              placeholder="Search by customer name"
              className="w-full lg:w-80 text-xs sm:text-sm h-9 sm:h-10"
              value={search}
              onChange={(e) => {
                const value = e.target.value;
                setSearch(value);
                void loadCollections(value);
              }}
            />

            <select
              className="h-9 sm:h-10 rounded-md border border-input bg-background px-2 sm:px-3 py-1 sm:py-2 text-xs sm:text-sm w-full lg:w-auto min-w-[160px]"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="today">Today</option>
              <option value="last7days">Last 7 days</option>
              <option value="custom">Custom date range</option>
            </select>

            {dateFilter === "custom" && (
              <div className="flex flex-col gap-2 sm:flex-row lg:flex-row">
                <Input
                  type="date"
                  placeholder="Start date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="text-xs sm:text-sm h-9 sm:h-10 w-full sm:w-auto"
                />
                <Input
                  type="date"
                  placeholder="End date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="text-xs sm:text-sm h-9 sm:h-10 w-full sm:w-auto"
                />
              </div>
            )}
          </div>

          {/* Add Payment Dialog */}
          <Dialog
            open={addPaymentDialogOpen}
            onOpenChange={(open) => {
              setAddPaymentDialogOpen(open);
              if (!open) {
                setDialogSearchId("");
                setDialogCustomer(null);
                setAmount("");
                setDialogDate(new Date().toISOString().slice(0, 10));
                setDialogLoading(false);
                setDialogSubmitLoading(false);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className="w-full lg:w-auto text-xs sm:text-sm h-9 sm:h-10 whitespace-nowrap">
                Add Payment
              </Button>
            </DialogTrigger>

            <DialogContent className="rounded-2xl w-full sm:w-96">
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg">
                  Add Payment
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    placeholder="Enter customer ID or phone"
                    value={dialogSearchId}
                    onChange={(e) => setDialogSearchId(e.target.value)}
                    className="flex-1 text-xs sm:text-sm h-9 sm:h-10"
                  />
                  <Button
                    onClick={searchCustomerByIdOrPhone}
                    disabled={dialogLoading}
                    className="text-xs sm:text-sm h-9 sm:h-10 w-full sm:w-auto"
                  >
                    {dialogLoading ? "Searching..." : "Search"}
                  </Button>
                </div>

                {dialogCustomer ? (
                  <div className="rounded-md border p-3">
                    <div className="font-medium text-sm">
                      {dialogCustomer.name}
                    </div>
                    <div className="text-xs sm:text-sm text-zinc-600">
                      Available balance: Rs.{" "}
                      {(
                        dialogCustomer.totalWithInterest -
                        dialogCustomer.paidAmount
                      ).toLocaleString()}
                    </div>
                    <div className="text-xs text-zinc-500">
                      Loan: {dialogCustomer.loanId}
                    </div>
                  </div>
                ) : (
                  dialogSearchId && (
                    <div className="text-xs sm:text-sm text-zinc-500">
                      No customer found
                    </div>
                  )
                )}

                <div>
                  <label className="text-xs sm:text-sm">Date</label>
                  <Input
                    type="date"
                    value={dialogDate}
                    onChange={(e) => setDialogDate(e.target.value)}
                    className="text-xs sm:text-sm h-9 sm:h-10"
                  />
                </div>

                <div>
                  <Input
                    type="number"
                    placeholder="Enter amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="text-xs sm:text-sm h-9 sm:h-10"
                  />
                </div>

                <Button
                  className="w-full text-xs sm:text-sm h-9 sm:h-10"
                  onClick={submitDialogPayment}
                  disabled={dialogSubmitLoading || !dialogCustomer}
                >
                  {dialogSubmitLoading ? "Submitting..." : "Submit Payment"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Edit Payment Dialog */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setEditingCollection(null);
            setEditAmount("");
            setEditDate(new Date().toISOString().slice(0, 10));
          }
        }}
      >
        <DialogContent className="rounded-2xl w-full sm:w-96">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">
              Edit Payment
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {editingCollection && (
              <div className="rounded-md border p-3">
                <div className="font-medium text-sm">
                  {editingCollection.customerName}
                </div>
                <div className="text-xs sm:text-sm text-zinc-600">
                  Collection ID: {editingCollection.transactionId}
                </div>
                <div className="text-xs text-zinc-500">
                  Loan: {editingCollection.loanId}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs sm:text-sm">Date</label>
              <Input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="text-xs sm:text-sm h-9 sm:h-10"
              />
            </div>

            <div>
              <Input
                type="number"
                placeholder="Enter corrected amount"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="text-xs sm:text-sm h-9 sm:h-10"
              />
            </div>

            <Button
              className="w-full text-xs sm:text-sm h-9 sm:h-10"
              onClick={submitEditPayment}
              disabled={editLoading}
            >
              {editLoading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* TABLE */}
      <div className="border rounded-xl overflow-hidden bg-white overflow-x-auto">
        <Table>
          <TableHeader className="bg-zinc-50">
            <TableRow>
              <TableHead className="text-xs sm:text-sm whitespace-nowrap">
                Collection ID
              </TableHead>
              <TableHead className="text-xs sm:text-sm whitespace-nowrap">
                Customer Name
              </TableHead>
              <TableHead className="hidden sm:table-cell text-xs sm:text-sm whitespace-nowrap">
                Customer ID
              </TableHead>
              <TableHead className="hidden sm:table-cell text-xs sm:text-sm whitespace-nowrap">
                Loan ID
              </TableHead>
              <TableHead className="text-xs sm:text-sm whitespace-nowrap">
                Amount
              </TableHead>
              <TableHead className="text-xs sm:text-sm whitespace-nowrap">
                Date
              </TableHead>
              <TableHead className="hidden sm:table-cell text-xs sm:text-sm whitespace-nowrap">
                Note
              </TableHead>
              <TableHead className="text-xs sm:text-sm whitespace-nowrap text-right">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-zinc-500 text-xs sm:text-sm"
                >
                  Loading collections...
                </TableCell>
              </TableRow>
            ) : filtered.length > 0 ? (
              filtered.map((col) => (
                <TableRow key={col.transactionId}>
                  <TableCell className="font-medium text-xs sm:text-sm whitespace-nowrap">
                    {col.transactionId}
                  </TableCell>

                  <TableCell className="text-xs sm:text-sm whitespace-nowrap">
                    {col.customerName}
                  </TableCell>

                  <TableCell className="hidden sm:table-cell text-xs sm:text-sm whitespace-nowrap">
                    {col.customerId}
                  </TableCell>

                  <TableCell className="hidden sm:table-cell text-xs sm:text-sm whitespace-nowrap">
                    {col.loanId}
                  </TableCell>

                  <TableCell className="text-xs sm:text-sm whitespace-nowrap">
                    Rs. {Number(col.amount).toLocaleString()}
                  </TableCell>

                  <TableCell className="text-xs sm:text-sm whitespace-nowrap">
                    {toLocalDateKey(col.date)}
                  </TableCell>

                  <TableCell className="hidden sm:table-cell text-xs sm:text-sm">
                    {col.note ?? "Payment received"}
                  </TableCell>

                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditDialog(col)}
                      className="text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
                    >
                      Edit
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
                  No collections found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
