import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type AssignmentStatus =
  | "pending_confirmation"
  | "confirmed"
  | "declined"
  | "cancelled";

export interface IAssignment extends Document {
  eventId: Types.ObjectId;
  roleId: Types.ObjectId;
  studentId: Types.ObjectId;
  applicationId: Types.ObjectId;
  shiftStartAt: Date;
  shiftEndAt: Date;
  status: AssignmentStatus;
  confirmedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AssignmentSchema = new Schema<IAssignment>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    roleId: { type: Schema.Types.ObjectId, ref: "EventRole", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "Application",
      required: true,
    },
    // Copied from the role/event at creation time rather than looked up
    // every time — conflict-detection queries need every assignment's
    // window without an extra join, and a role's shift shouldn't silently
    // reshape an already-confirmed assignment if edited later.
    shiftStartAt: { type: Date, required: true },
    shiftEndAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["pending_confirmation", "confirmed", "declined", "cancelled"],
      default: "pending_confirmation",
    },
    confirmedAt: { type: Date },
  },
  { timestamps: true }
);

// One assignment per application — selecting the same applicant twice
// should update the existing assignment, not create a second one.
AssignmentSchema.index({ applicationId: 1 }, { unique: true });
AssignmentSchema.index({ roleId: 1, status: 1 });
AssignmentSchema.index({ studentId: 1, status: 1 });

const Assignment: Model<IAssignment> =
  mongoose.models.Assignment ||
  mongoose.model<IAssignment>("Assignment", AssignmentSchema);

export default Assignment;
