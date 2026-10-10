import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type EventStatus = "draft" | "published" | "cancelled";

export interface IEventVenue {
  name?: string;
  address?: string;
  mapLink?: string;
}

export interface IEvent extends Document {
  title: string;
  description: string;
  category?: string;
  organizerId: Types.ObjectId;
  eligibleBranches: string[];
  startAt: Date;
  endAt: Date;
  venue: IEventVenue;
  applicationDeadline: Date;
  status: EventStatus;
  createdAt: Date;
  updatedAt: Date;
}

const EventSchema = new Schema<IEvent>(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, required: true, maxlength: 3000 },
    category: { type: String, trim: true },
    organizerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    eligibleBranches: { type: [String], default: [] },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    venue: {
      name: { type: String, trim: true },
      address: { type: String, trim: true },
      mapLink: { type: String, trim: true },
    },
    applicationDeadline: { type: Date, required: true },
    status: {
      type: String,
      enum: ["draft", "published", "cancelled"],
      default: "draft",
    },
  },
  { timestamps: true }
);

EventSchema.index({ organizerId: 1, status: 1 });
EventSchema.index({ status: 1, startAt: 1 });

const Event: Model<IEvent> =
  mongoose.models.Event || mongoose.model<IEvent>("Event", EventSchema);

export default Event;
