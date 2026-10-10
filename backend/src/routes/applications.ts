import { Router } from "express";
import mongoose from "mongoose";
import { connectDB } from "../lib/db";
import Application from "../models/Application";
import Event from "../models/Event";
import EventRole from "../models/EventRole";
import Assignment from "../models/Assignment";
import { requireRole } from "../middleware/auth";

const router = Router();

router.get("/mine", requireRole("student"), async (req, res) => {
  await connectDB();

  const applications = await Application.find({
    studentId: req.auth!.userId,
    isWithdrawn: false,
  }).sort({ createdAt: -1 });

  const eventIds = applications.map((a) => a.eventId);
  const roleIds = applications.map((a) => a.roleId);
  const applicationIds = applications.map((a) => a._id);

  const [events, roles, assignments] = await Promise.all([
    Event.find({ _id: { $in: eventIds } }),
    EventRole.find({ _id: { $in: roleIds } }),
    Assignment.find({ applicationId: { $in: applicationIds } }),
  ]);

  const eventById = new Map(events.map((e) => [e._id.toString(), e]));
  const roleById = new Map(roles.map((r) => [r._id.toString(), r]));
  const assignmentByApplication = new Map(
    assignments.map((a) => [a.applicationId.toString(), a])
  );

  const result = applications.map((app) => {
    const assignment = assignmentByApplication.get(app._id.toString());
    return {
      _id: app._id,
      status: app.status,
      submittedAt: app.submittedAt,
      event: eventById.get(app.eventId.toString()) ?? null,
      role: roleById.get(app.roleId.toString()) ?? null,
      assignment: assignment
        ? {
            id: assignment._id,
            status: assignment.status,
            shiftStartAt: assignment.shiftStartAt,
            shiftEndAt: assignment.shiftEndAt,
          }
        : null,
    };
  });

  res.json({ applications: result });
});

router.post("/:id/withdraw", requireRole("student"), async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ error: "Invalid application id" });
    return;
  }

  await connectDB();

  const application = await Application.findOne({
    _id: id,
    studentId: req.auth!.userId,
  });

  if (!application) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  if (application.status === "withdrawn") {
    res.status(400).json({ error: "Application is already withdrawn" });
    return;
  }

  const assignment = await Assignment.findOne({ applicationId: application._id });
  if (assignment?.status === "confirmed") {
    res.status(400).json({
      error: "You already confirmed this assignment — decline it instead of withdrawing.",
    });
    return;
  }

  if (assignment && assignment.status === "pending_confirmation") {
    assignment.status = "cancelled";
    await assignment.save();
  }

  application.status = "withdrawn";
  application.isWithdrawn = true;
  await application.save();

  res.json({ message: "Application withdrawn", application });
});

export default router;
