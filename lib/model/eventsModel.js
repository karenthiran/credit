import mongoose from "mongoose";

const eventSchema = new mongoose.Schema({
  eventName: { type: String, required: true },
  eventDate: { type: Date, required: true },
  eventTime: { type: String, required: true },
  location: { type: String, required: true },
  description: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export const Event =
  mongoose.models.Event || mongoose.model("Event", eventSchema);
