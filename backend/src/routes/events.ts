import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "../lib/db";
import Event from "../models/Event";
import EventRole from "../models/EventRole";
import { requireRole } from "../middleware/auth";

const router = Router();

const VenueSchema = z.object({
  name: z.string().max(150).optional(),
  address: z.string().max(300).optional(),
  mapLink: z.string().max(500).optional(),
});

const EventCreateSchema = z.object({
  title: z.string().min(3).max(150),
  description: z.string().min(1).max(3000),
  category: z.string().max(100).optional(),
  eligibleBranches: z.array(z.string().max(100)).max(50).optional(),
  startAt: z.string(),
  endAt: z.string(),
  venue: VenueSchema.optional(),
  applicationDeadline: z.string(),
});

const EventUpdateSchema = EventCreateSchema.partial().extend({
  status: z.enum(["draft", "published", "cancelled"]).optional(),
});

function validateDates(
  startAt: string,
  endAt: string,
  applicationDeadline: string
): string | null {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const deadline = new Date(applicationDeadline);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || isNaN(deadline.getTime())) {
    return "Invalid date(s) provided";
  }
  if (end <= start) {
    return "Event end time must be after the start time";
  }
  if (deadline > start) {
    return "Application deadline must be on or before the event start time";
  }
  return null;
}

router.post("/", requireRole("organizer"), async (req, res) => {
  try {
    const parsed = EventCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }

    const { title, description, category, eligibleBranches, startAt, endAt, venue, applicationDeadline } =
      parsed.data;

    const dateError = validateDates(startAt, endAt, applicationDeadline);
    if (dateError) {
      res.status(400).json({ error: dateError });
      return;
    }

    await connectDB();

    const event = await Event.create({
      title,
      description,
      category,
      organizerId: req.auth!.userId,
      eligibleBranches: eligibleBranches ?? [],
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      venue: venue ?? {},
      applicationDeadline: new Date(applicationDeadline),
      status: "draft",
    });

    res.status(201).json({ event });
  } catch (err) {
    console.error("Create event error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", requireRole("organizer"), async (req, res) => {
  await connectDB();

  const events = await Event.find({ organizerId: req.auth!.userId }).sort({
    createdAt: -1,
  });

  res.json({ events });
});

router.get("/:id", requireRole("organizer"), async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ error: "Invalid event id" });
    return;
  }

  await connectDB();

  const event = await Event.findOne({ _id: id, organizerId: req.auth!.userId });
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const roles = await EventRole.find({ eventId: event._id }).sort({ createdAt: 1 });

  res.json({ event, roles });
});

router.put("/:id", requireRole("organizer"), async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ error: "Invalid event id" });
    return;
  }

  const parsed = EventUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }

  await connectDB();

  const event = await Event.findOne({ _id: id, organizerId: req.auth!.userId });
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const update = { ...parsed.data };

  const nextStart = update.startAt ? new Date(update.startAt) : event.startAt;
  const nextEnd = update.endAt ? new Date(update.endAt) : event.endAt;
  const nextDeadline = update.applicationDeadline
    ? new Date(update.applicationDeadline)
    : event.applicationDeadline;

  const dateError = validateDates(
    nextStart.toISOString(),
    nextEnd.toISOString(),
    nextDeadline.toISOString()
  );
  if (dateError) {
    res.status(400).json({ error: dateError });
    return;
  }

  if (update.title !== undefined) event.title = update.title;
  if (update.description !== undefined) event.description = update.description;
  if (update.category !== undefined) event.category = update.category;
  if (update.eligibleBranches !== undefined) event.eligibleBranches = update.eligibleBranches;
  if (update.startAt !== undefined) event.startAt = nextStart;
  if (update.endAt !== undefined) event.endAt = nextEnd;
  if (update.applicationDeadline !== undefined) event.applicationDeadline = nextDeadline;
  if (update.venue !== undefined) event.venue = { ...event.venue, ...update.venue };
  if (update.status !== undefined) event.status = update.status;

  await event.save();

  res.json({ event });
});

router.delete("/:id", requireRole("organizer"), async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ error: "Invalid event id" });
    return;
  }

  await connectDB();

  const event = await Event.findOne({ _id: id, organizerId: req.auth!.userId });
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  await EventRole.deleteMany({ eventId: event._id });
  await event.deleteOne();

  res.json({ message: "Event deleted" });
});

const RoleCreateSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  responsibilities: z.array(z.string().max(200)).max(30).optional(),
  requiredSkills: z.array(z.string().max(60)).max(30).optional(),
  preferredSkills: z.array(z.string().max(60)).max(30).optional(),
  targetVolunteerCount: z.number().int().min(1).max(1000),
  shiftStartAt: z.string().optional(),
  shiftEndAt: z.string().optional(),
});

const RoleUpdateSchema = RoleCreateSchema.partial().extend({
  status: z.enum(["active", "closed"]).optional(),
});

async function findOwnedEvent(eventId: string, organizerId: string) {
  if (!mongoose.isValidObjectId(eventId)) return null;
  return Event.findOne({ _id: eventId, organizerId });
}

router.post("/:id/roles", requireRole("organizer"), async (req, res) => {
  const parsed = RoleCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }

  await connectDB();

  const event = await findOwnedEvent(req.params.id, req.auth!.userId);
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const { shiftStartAt, shiftEndAt, ...rest } = parsed.data;

  const role = await EventRole.create({
    eventId: event._id,
    ...rest,
    shiftStartAt: shiftStartAt ? new Date(shiftStartAt) : undefined,
    shiftEndAt: shiftEndAt ? new Date(shiftEndAt) : undefined,
  });

  res.status(201).json({ role });
});

router.put("/:id/roles/:roleId", requireRole("organizer"), async (req, res) => {
  const { roleId } = req.params;
  if (!mongoose.isValidObjectId(roleId)) {
    res.status(400).json({ error: "Invalid role id" });
    return;
  }

  const parsed = RoleUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }

  await connectDB();

  const event = await findOwnedEvent(req.params.id, req.auth!.userId);
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const role = await EventRole.findOne({ _id: roleId, eventId: event._id });
  if (!role) {
    res.status(404).json({ error: "Role not found" });
    return;
  }

  const { shiftStartAt, shiftEndAt, ...rest } = parsed.data;

  Object.assign(role, rest);
  if (shiftStartAt !== undefined) role.shiftStartAt = new Date(shiftStartAt);
  if (shiftEndAt !== undefined) role.shiftEndAt = new Date(shiftEndAt);

  await role.save();

  res.json({ role });
});

router.delete("/:id/roles/:roleId", requireRole("organizer"), async (req, res) => {
  const { roleId } = req.params;
  if (!mongoose.isValidObjectId(roleId)) {
    res.status(400).json({ error: "Invalid role id" });
    return;
  }

  await connectDB();

  const event = await findOwnedEvent(req.params.id, req.auth!.userId);
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const role = await EventRole.findOneAndDelete({ _id: roleId, eventId: event._id });
  if (!role) {
    res.status(404).json({ error: "Role not found" });
    return;
  }

  res.json({ message: "Role deleted" });
});

export default router;
