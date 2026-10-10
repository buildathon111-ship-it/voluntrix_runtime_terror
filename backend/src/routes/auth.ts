import { Router } from "express";
import { z } from "zod";
import { connectDB } from "../lib/db";
import User from "../models/User";
import VolunteerProfile from "../models/VolunteerProfile";
import {
  hashPassword,
  comparePassword,
  signToken,
  REMEMBER_ME_JWT_EXPIRES_IN,
} from "../lib/auth";
import { requireAuth } from "../middleware/auth";

const router = Router();

const RegisterSchema = z.object({
  usn: z
    .string()
    .trim()
    .min(3)
    .max(20)
    .regex(/^[A-Za-z0-9]+$/, "USN must be alphanumeric"),
  name: z.string().min(2).max(100),
  gender: z.enum(["male", "female"]),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{7,15}$/, "Enter a valid phone number"),
  email: z.string().email(),
  branch: z.string().min(2).max(100),
  password: z.string().min(8).max(100),
  skills: z.array(z.string().min(1).max(60)).max(50).optional(),
  interests: z.array(z.string().min(1).max(60)).max(30).optional(),
});

const DEFAULT_ROLE = "student" as const;

router.post("/register", async (req, res) => {
  try {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }

    const { usn, name, gender, phone, email, branch, password, skills, interests } =
      parsed.data;

    await connectDB();

    const normalizedUsn = usn.toUpperCase();

    const existing = await User.findOne({
      $or: [{ usn: normalizedUsn }, { email: email.toLowerCase() }],
    });

    if (existing) {
      if (existing.usn === normalizedUsn) {
        res.status(409).json({ error: "An account with this USN already exists" });
        return;
      }
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const passwordHash = await hashPassword(password);

    const user = await User.create({
      usn: normalizedUsn,
      name,
      gender,
      phone,
      email: email.toLowerCase(),
      branch,
      passwordHash,
      role: DEFAULT_ROLE,
    });

    await VolunteerProfile.create({
      userId: user._id,
      skills: (skills ?? []).map((skillName) => ({
        name: skillName,
        proficiency: "beginner",
      })),
      interests: interests ?? [],
    });

    const token = signToken({
      userId: user._id.toString(),
      role: user.role,
      usn: user.usn,
    });

    res.status(201).json({
      token,
      user: {
        id: user._id.toString(),
        usn: user.usn,
        name: user.name,
        email: user.email,
        role: user.role,
        branch: user.branch,
        gender: user.gender,
        phone: user.phone,
        profilePictureUrl: user.profilePictureUrl,
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const LoginSchema = z.object({
  usn: z.string().trim().min(1),
  password: z.string().min(1),
  role: z.enum(["student", "organizer", "faculty"]),
  rememberMe: z.boolean().optional().default(false),
});

router.post("/login", async (req, res) => {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }

    const { usn, password, role, rememberMe } = parsed.data;

    await connectDB();

    const user = await User.findOne({ usn: usn.trim().toUpperCase() }).select(
      "+passwordHash"
    );

    if (!user) {
      res.status(401).json({ error: "Invalid USN or password" });
      return;
    }

    if (user.accountStatus !== "active") {
      res.status(403).json({ error: "This account is not active" });
      return;
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid USN or password" });
      return;
    }

    // The selected tab is a declared intent, not a privilege grant — the
    // account's actual stored role (not the request) always decides what the
    // token can do. A mismatch here just means "wrong tab", not "wrong
    // password", so it gets its own message instead of lumping it in with
    // invalid credentials.
    if (user.role !== role) {
      res.status(403).json({
        error: `This account is registered as ${user.role}, not ${role}. Please select the correct role.`,
      });
      return;
    }

    const token = signToken(
      { userId: user._id.toString(), role: user.role, usn: user.usn },
      rememberMe ? REMEMBER_ME_JWT_EXPIRES_IN : undefined
    );

    res.json({
      token,
      user: {
        id: user._id.toString(),
        usn: user.usn,
        name: user.name,
        email: user.email,
        role: user.role,
        branch: user.branch,
        gender: user.gender,
        phone: user.phone,
        profilePictureUrl: user.profilePictureUrl,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/logout", (_req, res) => {
  // Stateless JWT: logout is handled client-side by discarding the token.
  res.json({ message: "Logged out" });
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    await connectDB();
    const user = await User.findById(req.auth!.userId);
    if (!user || user.accountStatus !== "active") {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    res.json({
      user: {
        id: user._id.toString(),
        usn: user.usn,
        name: user.name,
        email: user.email,
        role: user.role,
        branch: user.branch,
        gender: user.gender,
        phone: user.phone,
        profilePictureUrl: user.profilePictureUrl,
      },
    });
  } catch (err) {
    console.error("Me error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

router.post("/change-password", requireAuth, async (req, res) => {
  try {
    const parsed = ChangePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }

    const { currentPassword, newPassword } = parsed.data;

    await connectDB();

    const user = await User.findById(req.auth!.userId).select("+passwordHash");
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const valid = await comparePassword(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }

    const samePassword = await comparePassword(newPassword, user.passwordHash);
    if (samePassword) {
      res.status(400).json({
        error: "New password must be different from the current password",
      });
      return;
    }

    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
