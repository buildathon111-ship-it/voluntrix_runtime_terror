import { Router } from "express";
import mongoose from "mongoose";
import { connectDB } from "../lib/db";
import Event from "../models/Event";
import EventRole from "../models/EventRole";
import Application from "../models/Application";
import User from "../models/User";
import { requireRole } from "../middleware/auth";

const router = Router();

router.get("/browse", requireRole("student"), async (req, res) => {
  await connectDB();

  const student = await User.findById(req.auth!.userId);
  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }

  const events = await Event.find({
    status: "published",
    applicationDeadline: { $gte: new Date() },
    $or: [
      { eligibleBranches: { $size: 0 } },
      { eligibleBranches: student.branch },
    ],
  }).sort({ startAt: 1 });

  res.json({ events });
});

router.get("/browse/:id", requireRole("student"), async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ error: "Invalid event id" });
    return;
  }

  await connectDB();

  const event = await Event.findOne({ _id: id, status: "published" });
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const student = await User.findById(req.auth!.userId);
  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }

  const branchEligible =
    event.eligibleBranches.length === 0 ||
    event.eligibleBranches.includes(student.branch ?? "");
  const deadlinePassed = new Date() > event.applicationDeadline;

  const roles = await EventRole.find({ eventId: event._id }).sort({ createdAt: 1 });

  const myApplications = await Application.find({
    studentId: student._id,
    roleId: { $in: roles.map((r) => r._id) },
    isWithdrawn: false,
  });
  const applicationByRole = new Map(
    myApplications.map((a) => [a.roleId.toString(), a])
  );

  const rolesWithEligibility = roles.map((role) => {
    const existingApplication = applicationByRole.get(role._id.toString());
    const roleOpen = role.status === "active";
    const canApply =
      branchEligible && !deadlinePassed && roleOpen && !existingApplication;

    return {
      _id: role._id,
      title: role.title,
      description: role.description,
      responsibilities: role.responsibilities,
      requiredSkills: role.requiredSkills,
      preferredSkills: role.preferredSkills,
      targetVolunteerCount: role.targetVolunteerCount,
      shiftStartAt: role.shiftStartAt,
      shiftEndAt: role.shiftEndAt,
      status: role.status,
      eligibility: {
        branchEligible,
        deadlinePassed,
        roleOpen,
        canApply,
        applicationStatus: existingApplication?.status ?? null,
      },
    };
  });

  res.json({ event, roles: rolesWithEligibility });
});

router.post(
  "/browse/:id/roles/:roleId/apply",
  requireRole("student"),
  async (req, res) => {
    const { id, roleId } = req.params;
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(roleId)) {
      res.status(400).json({ error: "Invalid event or role id" });
      return;
    }

    await connectDB();

    const event = await Event.findOne({ _id: id, status: "published" });
    if (!event) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    const role = await EventRole.findOne({ _id: roleId, eventId: event._id });
    if (!role) {
      res.status(404).json({ error: "Role not found" });
      return;
    }

    if (role.status !== "active") {
      res.status(400).json({ error: "This role is no longer accepting applications" });
      return;
    }

    if (new Date() > event.applicationDeadline) {
      res.status(400).json({ error: "The application deadline has passed" });
      return;
    }

    const student = await User.findById(req.auth!.userId);
    if (!student) {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    if (
      event.eligibleBranches.length > 0 &&
      !event.eligibleBranches.includes(student.branch ?? "")
    ) {
      res.status(403).json({ error: "Your branch is not eligible for this event" });
      return;
    }

    try {
      const application = await Application.create({
        eventId: event._id,
        roleId: role._id,
        studentId: student._id,
        status: "submitted",
      });

      res.status(201).json({ application });
    } catch (err) {
      if (err instanceof Error && "code" in err && (err as { code?: number }).code === 11000) {
        res.status(409).json({ error: "You've already applied to this role" });
        return;
      }
      throw err;
    }
  }
);

export default router;
