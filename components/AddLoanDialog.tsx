"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AddLoanDialogProps = {
  customerId: string;
  customerName: string;
};

export default function AddLoanDialog({
  customerId,
  customerName,
}: AddLoanDialogProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    loanAmount: "",
    interestRate: "",
    duration: "",
    loanStartDate: "",
  });

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    setFormData((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  function isValidDateValue(value: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
  }

  async function handleCreateLoan() {
    if (!isValidDateValue(formData.loanStartDate)) {
      toast.error("Loan start date is required");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(`/api/customers/${customerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newLoan: true,
          loanAmount: Number(formData.loanAmount),
          interestRate: Number(formData.interestRate),
          duration: Number(formData.duration),
          loanStartDate: formData.loanStartDate,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        toast.error(data.message || "Failed to add new loan");
        return;
      }

      toast.success("New loan added successfully");
      setFormData({
        loanAmount: "",
        interestRate: "",
        duration: "",
        loanStartDate: "",
      });
      router.refresh();
    } catch {
      toast.error("Failed to add new loan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="rounded-xl">Add Loan</Button>
      </DialogTrigger>

      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Loan</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-zinc-500">
            Add a fresh loan for {customerName}. The previous loan is already
            fully paid.
          </p>

          <div className="space-y-2">
            <Label>Loan Amount</Label>
            <Input
              type="number"
              name="loanAmount"
              value={formData.loanAmount}
              onChange={handleChange}
              placeholder="Enter loan amount"
            />
          </div>

          <div className="space-y-2">
            <Label>Interest Rate (%)</Label>
            <Input
              type="number"
              name="interestRate"
              value={formData.interestRate}
              onChange={handleChange}
              placeholder="Enter interest rate"
            />
          </div>

          <div className="space-y-2">
            <Label>Duration (Months)</Label>
            <Input
              type="number"
              name="duration"
              value={formData.duration}
              onChange={handleChange}
              placeholder="Enter duration"
            />
          </div>

          <div className="space-y-2">
            <Label>Loan Start Date</Label>
            <Input
              type="date"
              name="loanStartDate"
              value={formData.loanStartDate}
              onChange={handleChange}
            />
          </div>

          <Button
            type="button"
            className="w-full rounded-xl"
            onClick={handleCreateLoan}
            disabled={saving}
          >
            {saving ? "Saving..." : "Create Loan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
