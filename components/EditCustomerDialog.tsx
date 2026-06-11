"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { calculateLoanSummary } from "@/lib/calculations";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function EditCustomerDialog({
  customer,
  onCustomerSaved,
}: {
  customer: any;
  onCustomerSaved?: () => void;
}) {
  const [formData, setFormData] = useState({
    name: "",
    contact: "",
    address: "",
    loanAmount: "",
    interestRate: "",
    duration: "",
    loanStartDate: "",
  });

  useEffect(() => {
    if (customer) {
      setFormData({
        name: String(customer.name ?? ""),
        contact: String(customer.contact ?? ""),
        address: String(customer.address ?? ""),
        loanAmount: String(customer.loanAmount ?? ""),
        interestRate: String(customer.interestRate ?? ""),
        duration: String(customer.duration ?? ""),
        loanStartDate: customer.loanStartDate
          ? String(customer.loanStartDate).slice(0, 10)
          : "",
      });
    }
  }, [customer]);

  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [contactError, setContactError] = useState("");
  const [loanStartDateError, setLoanStartDateError] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.name === "contact" && contactError) setContactError("");
    if (e.target.name === "loanStartDate" && loanStartDateError)
      setLoanStartDateError("");

    setFormData({ ...formData, [e.target.name]: e.target.value });
  }

  function isValidPhoneNumber(value: string) {
    const normalized = value.trim().replace(/\D/g, "");
    return /^0\d{9}$/.test(normalized);
  }

  function normalizePhoneNumber(value: string) {
    return value.trim().replace(/\D/g, "");
  }

  function isValidDateValue(value: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
  }

  // loan calculations
  const loan = Number(formData.loanAmount || 0);
  const monthlyRate = Number(formData.interestRate || 0);
  const duration = Number(formData.duration || 0);

  const {
    totalInterest,
    totalWithInterest,
    monthlyPayment,
    dailyPayment,
  } = calculateLoanSummary(loan, monthlyRate, duration);

  async function handleSubmit() {
    const contactValue = normalizePhoneNumber(formData.contact);

    if (!isValidPhoneNumber(contactValue)) {
      setContactError("Phone number must start with 0 and contain exactly 10 digits");
      return;
    }

    if (!isValidDateValue(formData.loanStartDate)) {
      setLoanStartDateError("Loan start date is required");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          contact: contactValue,
          address: formData.address,
          loanAmount: loan,
          interestRate: monthlyRate,
          duration,
          loanStartDate: formData.loanStartDate,
          totalWithInterest,
          monthlyPayment,
          dailyPayment,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.message || "Failed to update customer. Please try again.");
        return;
      }

      toast.success("Customer updated successfully");
      onCustomerSaved?.();
      setDialogOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update customer. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={(open) => setDialogOpen(open)}>
      <DialogTrigger asChild>
        <Button size="sm" className="rounded-lg mr-2 text-xs sm:text-sm">
          Edit
        </Button>
      </DialogTrigger>

      <DialogContent className="rounded-2xl sm:max-w-150">
        <DialogHeader>
          <DialogTitle>Edit Customer</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="space-y-2 col-span-2">
            <Label>Customer ID</Label>
            <Input type="text" value={customer?.id ?? ""} disabled />
          </div>

          <div className="space-y-2">
            <Label>Customer Name</Label>
            <Input name="name" value={formData.name} onChange={handleChange} />
          </div>

          <div className="space-y-2">
            <Label>Contact</Label>
            <Input
              type="tel"
              inputMode="tel"
              placeholder="Ex: 0764050277"
              name="contact"
              value={formData.contact}
              onChange={handleChange}
              aria-invalid={Boolean(contactError)}
            />
            {contactError ? <p className="text-xs text-red-600">{contactError}</p> : null}
          </div>

          <div className="space-y-2 col-span-2">
            <Label>Address</Label>
            <Input name="address" value={formData.address} onChange={handleChange} />
          </div>

          <div className="space-y-2">
            <Label>Loan Amount</Label>
            <Input type="number" name="loanAmount" value={formData.loanAmount} onChange={handleChange} />
          </div>

          <div className="space-y-2">
            <Label>Monthly Interest %</Label>
            <Input type="number" name="interestRate" value={formData.interestRate} onChange={handleChange} />
          </div>

          <div className="space-y-2">
            <Label>Duration (Months)</Label>
            <Input type="number" name="duration" value={formData.duration} onChange={handleChange} />
          </div>

          <div className="space-y-2 col-span-2">
            <Label>Loan Start Date</Label>
            <Input type="date" name="loanStartDate" value={formData.loanStartDate} onChange={handleChange} aria-invalid={Boolean(loanStartDateError)} />
            {loanStartDateError ? <p className="text-xs text-red-600">{loanStartDateError}</p> : null}
          </div>
        </div>

        <div className="p-4 bg-zinc-50 rounded-xl space-y-1 text-sm border">
          <p>
            Total Amount: <b>Rs. {totalWithInterest.toLocaleString()}</b>
          </p>

          <p>
            Monthly Payment: <b>Rs. {monthlyPayment.toFixed(2)}</b>
          </p>

          <p>
            Daily Payment: <b>Rs. {dailyPayment.toFixed(2)}</b>
          </p>

          <p>
            Loan Start Date: <b>{formData.loanStartDate || "Not set"}</b>
          </p>
        </div>

        <div className="flex justify-end">
          <Button type="button" onClick={handleSubmit} className="rounded-xl" disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
