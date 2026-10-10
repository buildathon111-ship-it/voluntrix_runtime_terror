import { Router } from "express";
import mongoose from "mongoose";
import { connectDB } from "../lib/db";
import User, { UserRole } from "../models/User";
import VolunteerProfile from "../models/VolunteerProfile";
import { requireRole } from "../middleware/auth";

const router = Router();

// Accounts a faculty member can view and manage.
const MANAGED_ROLES: UserRole[] = ["student", "organizer"];

router.get("/students", requireRole("faculty"), async (_req, res) => {
  await connectDB();

  // Organizers are promoted students, so both are listed here and the
  // dashboard groups them by role.
  const students = await User.find({ role: { $in: MANAGED_ROLES } })
    .select("usn name branch profilePictureUrl role")
    .sort({ usn: 1 });

  res.json({
    students: students.map((s) => ({
      id: s._id.toString(),
      usn: s.usn,
      name: s.name,
      branch: s.branch,
      profilePictureUrl: s.profilePictureUrl,
      role: s.role,
    })),
  });
});

router.get("/students/:id", requireRole("faculty"), async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ error: "Invalid student id" });
    return;
  }

  await connectDB();

  const student = await User.findOne({
    _id: id,
    role: { $in: MANAGED_ROLES },
  });
  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }

  const profile = await VolunteerProfile.findOne({ userId: student._id });

  res.json({
    student: {
      id: student._id.toString(),
      usn: student.usn,
      name: student.name,
      email: student.email,
      branch: student.branch,
      gender: student.gender,
      phone: student.phone,
      profilePictureUrl: student.profilePictureUrl,
      accountStatus: student.accountStatus,
      role: student.role,
      createdAt: student.createdAt,
    },
    profile: profile
      ? {
          yearOfStudy: profile.yearOfStudy,
          skills: profile.skills,
          interests: profile.interests,
          developmentGoals: profile.developmentGoals,
        }
      : null,
  });
});

router.post("/students/:id/promote", requireRole("faculty"), async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ error: "Invalid student id" });
    return;
  }

  await connectDB();

  const student = await User.findOne({ _id: id, role: "student" });
  if (!student) {
    res.status(404).json({ error: "Student not found, or already promoted" });
    return;
  }

  student.role = "organizer";
  await student.save();

  res.json({
    message: `${student.name} has been promoted to Organizer.`,
    student: {
      id: student._id.toString(),
      usn: student.usn,
      name: student.name,
      role: student.role,
    },
  });
});

router.post("/students/:id/demote", requireRole("faculty"), async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ error: "Invalid student id" });
    return;
  }

  await connectDB();

  const organizer = await User.findOne({ _id: id, role: "organizer" });
  if (!organizer) {
    res.status(404).json({ error: "Organizer not found, or access already removed" });
    return;
  }

  organizer.role = "student";
  await organizer.save();

  res.json({
    message: `Organizer access removed for ${organizer.name}.`,
    student: {
      id: organizer._id.toString(),
      usn: organizer.usn,
      name: organizer.name,
      role: organizer.role,
    },
  });
});

export default router;
