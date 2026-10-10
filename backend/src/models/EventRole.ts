import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type EventRoleStatus = "active" | "closed";

export interface IEventRole extends Document {
  eventId: Types.ObjectId;
  title: string;
  description?: string;
  responsibilities: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  targetVolunteerCount: number;
  shiftStartAt?: Date;
  shiftEndAt?: Date;
  status: EventRoleStatus;
  createdAt: Date;
  updatedAt: Date;
}

const EventRoleSchema = new Schema<IEventRole>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, maxlength: 2000 },
    responsibilities: { type: [String], default: [] },
    requiredSkills: { type: [String], default: [] },
    preferredSkills: { type: [String], default: [] },
    targetVolunteerCount: { type: Number, required: true, min: 1, max: 1000 },
    shiftStartAt: { type: Date },
    shiftEndAt: { type: Date },
    status: {
      type: String,
      enum: ["active", "closed"],
      default: "active",
    },
  },
  { timestamps: true }
);

EventRoleSchema.index({ eventId: 1 });

const EventRole: Model<IEventRole> =
  mongoose.models.EventRole ||
  mongoose.model<IEventRole>("EventRole", EventRoleSchema);

export default EventRole;
