import { Router } from "express";
import mongoose from "mongoose";
import { connectDB } from "../lib/db";
import Assignment from "../models/Assignment";
import Event from "../models/Event";
import EventRole from "../models/EventRole";
import { requireRole } from "../middleware/auth";

const router = Router();

router.post("/:id/confirm", requireRole("student"), async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ error: "Invalid assignment id" });
    return;
  }

  await connectDB();

  const assignment = await Assignment.findOne({
    _id: id,
    studentId: req.auth!.userId,
  });
  if (!assignment) {
    res.status(404).json({ error: "Assignment not found" });
    return;
  }

  if (assignment.status !== "pending_confirmation") {
    res.status(400).json({ error: "This assignment is no longer awaiting confirmation" });
    return;
  }

  // No two CONFIRMED assignments may overlap in time for the same student.
  // Declined/cancelled/other-pending assignments don't block this — only
  // what's already confirmed represents a real commitment.
  const conflicting = await Assignment.findOne({
    studentId: req.auth!.userId,
    status: "confirmed",
    _id: { $ne: assignment._id },
    shiftStartAt: { $lt: assignment.shiftEndAt },
    shiftEndAt: { $gt: assignment.shiftStartAt },
  });

  if (conflicting) {
    const conflictingEvent = await Event.findById(conflicting.eventId);
    const conflictingRole = await EventRole.findById(conflicting.roleId);
    res.status(409).json({
      error: `This overlaps with your confirmed assignment "${conflictingRole?.title ?? "another role"}" for "${conflictingEvent?.title ?? "another event"}". Decline one before confirming this.`,
    });
    return;
  }

  assignment.status = "confirmed";
  assignment.confirmedAt = new Date();
  await assignment.save();

  res.json({ assignment });
});

router.post("/:id/decline", requireRole("student"), async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ error: "Invalid assignment id" });
    return;
  }

  await connectDB();

  const assignment = await Assignment.findOne({
    _id: id,
    studentId: req.auth!.userId,
  });
  if (!assignment) {
    res.status(404).json({ error: "Assignment not found" });
    return;
  }

  if (!["pending_confirmation", "confirmed"].includes(assignment.status)) {
    res.status(400).json({ error: "This assignment can no longer be declined" });
    return;
  }

  assignment.status = "declined";
  assignment.confirmedAt = undefined;
  await assignment.save();

  res.json({ assignment });
});

export default router;
