import mongoose from "mongoose";

/**
 * Loan model — each document represents one loan issued to a customer.
 * Current active loans AND historical loans all live in this collection.
 * Replaces the embedded `loanHistory` array and the loan fields that were
 * stored directly on the Customer document.
 */
const loanSchema = new mongoose.Schema(
  {
    loanId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      uppercase: true,
    },
    // Reference back to the owning customer
    customerId: {
      type: String,
      required: true,
      index: true,
      trim: true,
      uppercase: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    loanAmount: { type: Number, required: true, min: 0 },
    interestRate: { type: Number, required: true, min: 0 },
    duration: { type: Number, required: true, min: 1 },
    totalWithInterest: { type: Number, required: true, min: 0 },
    monthlyPayment: { type: Number, required: true, min: 0 },
    dailyPayment: { type: Number, required: true, min: 0 },
    loanStartDate: { type: Date, required: true },
    loanEndDate: { type: Date, required: true },
    paidAmount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["ongoing", "completed"],
      default: "ongoing",
    },
    openedAt: { type: Date, default: Date.now },
    closedAt: { type: Date },
  },
  { timestamps: true },
);

export const Loan = mongoose.models.Loan || mongoose.model("Loan", loanSchema);

export default Loan;
