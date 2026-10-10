import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type ApplicationStatus =
  | "submitted"
  | "under_review"
  | "shortlisted"
  | "selected"
  | "rejected"
  | "withdrawn"
  | "waitlisted";

export interface IApplication extends Document {
  eventId: Types.ObjectId;
  roleId: Types.ObjectId;
  studentId: Types.ObjectId;
  status: ApplicationStatus;
  // Mirrors `status === "withdrawn"`, kept in sync on every status change.
  // MongoDB partial index filters only support equality-style operators
  // ($eq, $exists, $gt/$gte/$lt/$lte, $type) — "$ne: withdrawn" is not
  // expressible there, so this field exists purely to give the partial
  // unique index something it can match on.
  isWithdrawn: boolean;
  submittedAt: Date;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ApplicationSchema = new Schema<IApplication>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    roleId: { type: Schema.Types.ObjectId, ref: "EventRole", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: [
        "submitted",
        "under_review",
        "shortlisted",
        "selected",
        "rejected",
        "withdrawn",
        "waitlisted",
      ],
      default: "submitted",
    },
    isWithdrawn: { type: Boolean, default: false },
    submittedAt: { type: Date, default: () => new Date() },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

// A student can re-apply to the same role after withdrawing, but can't have
// two simultaneously-active applications to the same role.
ApplicationSchema.index(
  { studentId: 1, roleId: 1 },
  { unique: true, partialFilterExpression: { isWithdrawn: false } }
);
ApplicationSchema.index({ roleId: 1, status: 1 });
ApplicationSchema.index({ studentId: 1 });

const Application: Model<IApplication> =
  mongoose.models.Application ||
  mongoose.model<IApplication>("Application", ApplicationSchema);

export default Application;
