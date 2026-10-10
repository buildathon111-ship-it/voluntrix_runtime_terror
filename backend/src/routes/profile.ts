import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { z } from "zod";
import { connectDB } from "../lib/db";
import User from "../models/User";
import VolunteerProfile from "../models/VolunteerProfile";
import { requireAuth } from "../middleware/auth";

const router = Router();

const SkillSchema = z.object({
  name: z.string().min(1).max(50),
  proficiency: z.enum(["beginner", "intermediate", "advanced"]),
});

const ProfileUpdateSchema = z.object({
  yearOfStudy: z.number().int().min(1).max(6).optional(),
  skills: z.array(SkillSchema).max(50).optional(),
  interests: z.array(z.string().max(50)).max(30).optional(),
  developmentGoals: z.array(z.string().max(100)).max(20).optional(),
  availability: z
    .object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      blockedDates: z.array(z.string()).optional(),
    })
    .optional(),
  preferences: z
    .object({
      eventCategories: z.array(z.string().max(50)).optional(),
      maxHoursPerMonth: z.number().min(0).max(744).optional(),
    })
    .optional(),
});

router.get("/", requireAuth, async (req, res) => {
  if (req.auth!.role !== "student") {
    res.status(403).json({ error: "Only students have volunteer profiles" });
    return;
  }

  await connectDB();

  const profile = await VolunteerProfile.findOne({ userId: req.auth!.userId });
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  res.json({ profile });
});

router.put("/", requireAuth, async (req, res) => {
  if (req.auth!.role !== "student") {
    res.status(403).json({ error: "Only students have volunteer profiles" });
    return;
  }

  try {
    const parsed = ProfileUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }

    await connectDB();

    const update: Record<string, unknown> = { ...parsed.data };

    if (parsed.data.availability) {
      update.availability = {
        startDate: parsed.data.availability.startDate
          ? new Date(parsed.data.availability.startDate)
          : undefined,
        endDate: parsed.data.availability.endDate
          ? new Date(parsed.data.availability.endDate)
          : undefined,
        blockedDates:
          parsed.data.availability.blockedDates?.map((d) => new Date(d)) ?? [],
      };
    }

    const profile = await VolunteerProfile.findOneAndUpdate(
      { userId: req.auth!.userId },
      { $set: update },
      { new: true, upsert: true, returnDocument: "after" }
    );

    res.json({ profile });
  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "avatars");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

router.post(
  "/avatar",
  requireAuth,
  upload.single("avatar"),
  async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "No file provided" });
        return;
      }

      if (!ALLOWED_TYPES[file.mimetype]) {
        res.status(400).json({ error: "Only JPEG, PNG, or WebP images are allowed" });
        return;
      }

      await connectDB();

      const user = await User.findById(req.auth!.userId);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const extension = ALLOWED_TYPES[file.mimetype];
      const filename = `${user._id.toString()}-${Date.now()}.${extension}`;
      const filePath = path.join(UPLOAD_DIR, filename);

      await fs.writeFile(filePath, file.buffer);

      if (user.profilePictureUrl?.startsWith("/uploads/avatars/")) {
        const oldPath = path.join(process.cwd(), "public", user.profilePictureUrl);
        await fs.unlink(oldPath).catch(() => {});
      }

      const publicUrl = `/uploads/avatars/${filename}`;
      user.profilePictureUrl = publicUrl;
      await user.save();

      res.json({ profilePictureUrl: publicUrl });
    } catch (err) {
      console.error("Avatar upload error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.delete("/avatar", requireAuth, async (req, res) => {
  await connectDB();

  const user = await User.findById(req.auth!.userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (user.profilePictureUrl?.startsWith("/uploads/avatars/")) {
    const oldPath = path.join(process.cwd(), "public", user.profilePictureUrl);
    await fs.unlink(oldPath).catch(() => {});
  }

  user.profilePictureUrl = undefined;
  await user.save();

  res.json({ profilePictureUrl: null });
});

export default router;
