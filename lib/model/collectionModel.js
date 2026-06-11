import mongoose from "mongoose";

/**
 * Collection model — each document represents one payment transaction.
 * Replaces the embedded `transactions` arrays that used to live on the
 * Customer document (and inside loanHistory entries).
 */
const collectionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      uppercase: true,
    },
    // References
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
    loanId: {
      type: String,
      required: true,
      index: true,
      trim: true,
      uppercase: true,
    },
    // Payment details
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now },
    note: { type: String, default: "Payment received" },
    profit: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const Collection =
  mongoose.models.Collection || mongoose.model("Collection", collectionSchema);

export default Collection;
