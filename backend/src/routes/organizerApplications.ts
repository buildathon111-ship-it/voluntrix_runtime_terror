import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "../lib/db";
import Event from "../models/Event";
import EventRole from "../models/EventRole";
import Application from "../models/Application";
import Assignment from "../models/Assignment";
import User from "../models/User";
import VolunteerProfile from "../models/VolunteerProfile";
import { requireRole } from "../middleware/auth";

const router = Router();

async function findOwnedEventAndRole(
  eventId: string,
  roleId: string,
  organizerId: string
) {
  if (!mongoose.isValidObjectId(eventId) || !mongoose.isValidObjectId(roleId)) {
    return { event: null, role: null };
  }
  const event = await Event.findOne({ _id: eventId, organizerId });
  if (!event) return { event: null, role: null };
  const role = await EventRole.findOne({ _id: roleId, eventId: event._id });
  return { event, role };
}

router.get(
  "/:id/roles/:roleId/applications",
  requireRole("organizer"),
  async (req, res) => {
    await connectDB();

    const { event, role } = await findOwnedEventAndRole(
      req.params.id,
      req.params.roleId,
      req.auth!.userId
    );
    if (!event || !role) {
      res.status(404).json({ error: "Event or role not found" });
      return;
    }

    const applications = await Application.find({
      roleId: role._id,
      isWithdrawn: false,
    }).sort({ submittedAt: 1 });

    const studentIds = applications.map((a) => a.studentId);
    const [students, profiles, assignments] = await Promise.all([
      User.find({ _id: { $in: studentIds } }),
      VolunteerProfile.find({ userId: { $in: studentIds } }),
      Assignment.find({ roleId: role._id }),
    ]);

    const studentById = new Map(students.map((s) => [s._id.toString(), s]));
    const profileByStudent = new Map(
      profiles.map((p) => [p.userId.toString(), p])
    );
    const assignmentByApplication = new Map(
      assignments.map((a) => [a.applicationId.toString(), a])
    );

    const confirmedOrPendingCount = assignments.filter((a) =>
      ["pending_confirmation", "confirmed"].includes(a.status)
    ).length;

    const result = applications.map((app) => {
      const student = studentById.get(app.studentId.toString());
      const profile = profileByStudent.get(app.studentId.toString());
      const assignment = assignmentByApplication.get(app._id.toString());
      const studentSkills = (profile?.skills ?? []).map((s) => s.name);
      const matchedSkills = role.requiredSkills.filter((skill) =>
        studentSkills.includes(skill)
      );

      return {
        _id: app._id,
        status: app.status,
        submittedAt: app.submittedAt,
        student: student
          ? {
              id: student._id.toString(),
              usn: student.usn,
              name: student.name,
              branch: student.branch,
              profilePictureUrl: student.profilePictureUrl,
            }
          : null,
        skillsMatch: {
          matched: matchedSkills,
          total: role.requiredSkills.length,
        },
        interests: profile?.interests ?? [],
        assignment: assignment
          ? { id: assignment._id, status: assignment.status }
          : null,
      };
    });

    res.json({
      applications: result,
      capacity: {
        target: role.targetVolunteerCount,
        filled: confirmedOrPendingCount,
      },
    });
  }
);

const StatusUpdateSchema = z.object({
  status: z.enum(["under_review", "shortlisted", "rejected", "waitlisted"]),
});

router.post(
  "/:id/roles/:roleId/applications/:applicationId/status",
  requireRole("organizer"),
  async (req, res) => {
    const parsed = StatusUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }

    await connectDB();

    const { event, role } = await findOwnedEventAndRole(
      req.params.id,
      req.params.roleId,
      req.auth!.userId
    );
    if (!event || !role) {
      res.status(404).json({ error: "Event or role not found" });
      return;
    }

    const application = await Application.findOne({
      _id: req.params.applicationId,
      roleId: role._id,
      isWithdrawn: false,
    });
    if (!application) {
      res.status(404).json({ error: "Application not found" });
      return;
    }

    application.status = parsed.data.status;
    application.reviewedBy = new mongoose.Types.ObjectId(req.auth!.userId);
    application.reviewedAt = new Date();
    await application.save();

    res.json({ application });
  }
);

router.post(
  "/:id/roles/:roleId/applications/:applicationId/select",
  requireRole("organizer"),
  async (req, res) => {
    await connectDB();

    const { event, role } = await findOwnedEventAndRole(
      req.params.id,
      req.params.roleId,
      req.auth!.userId
    );
    if (!event || !role) {
      res.status(404).json({ error: "Event or role not found" });
      return;
    }

    const application = await Application.findOne({
      _id: req.params.applicationId,
      roleId: role._id,
      isWithdrawn: false,
    });
    if (!application) {
      res.status(404).json({ error: "Application not found" });
      return;
    }

    const existingAssignment = await Assignment.findOne({
      applicationId: application._id,
    });

    // Capacity is checked against every other active assignment for this
    // role — if this application already has one (e.g. re-selecting after
    // a decline), it shouldn't count against its own slot.
    const activeCount = await Assignment.countDocuments({
      roleId: role._id,
      status: { $in: ["pending_confirmation", "confirmed"] },
      _id: { $ne: existingAssignment?._id },
    });

    if (activeCount >= role.targetVolunteerCount) {
      res.status(400).json({ error: "This role is already fully staffed" });
      return;
    }

    const shiftStartAt = role.shiftStartAt ?? event.startAt;
    const shiftEndAt = role.shiftEndAt ?? event.endAt;

    let assignment;
    if (existingAssignment) {
      existingAssignment.status = "pending_confirmation";
      existingAssignment.shiftStartAt = shiftStartAt;
      existingAssignment.shiftEndAt = shiftEndAt;
      existingAssignment.confirmedAt = undefined;
      await existingAssignment.save();
      assignment = existingAssignment;
    } else {
      assignment = await Assignment.create({
        eventId: event._id,
        roleId: role._id,
        studentId: application.studentId,
        applicationId: application._id,
        shiftStartAt,
        shiftEndAt,
        status: "pending_confirmation",
      });
    }

    application.status = "selected";
    application.reviewedBy = new mongoose.Types.ObjectId(req.auth!.userId);
    application.reviewedAt = new Date();
    await application.save();

    res.json({ application, assignment });
  }
);

export default router;
