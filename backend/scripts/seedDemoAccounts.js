/**
 * Seeds demo accounts for presentations/demos — one Student and one
 * Organizer, fixed credentials, so a live demo doesn't depend on whatever
 * real accounts happen to exist. Faculty already has a demo account via
 * seedFaculty.js (FACULTY1) — reused here, not duplicated.
 *
 * Usage: node scripts/seedDemoAccounts.js
 *
 * Existing accounts (matched by USN) are left untouched — safe to re-run.
 * These credentials are also hardcoded in the frontend's "Auto-Fill"
 * buttons on /login and /register (frontend/src/lib/demoAccounts.ts) —
 * keep both in sync if you change them here.
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const DEMO_STUDENT = {
  usn: "DEMOSTU1",
  name: "Demo Student",
  gender: "female",
  phone: "9999900001",
  email: "demo.student@example.com",
  branch: "Computer Science",
  password: "Demo@123",
  skills: ["Event Planning & Coordination", "Photography"],
  interests: ["Technical Fests & Hackathons", "Cultural Fests"],
};

const DEMO_ORGANIZER = {
  usn: "DEMOORG1",
  name: "Demo Organizer",
  gender: "male",
  phone: "9999900002",
  email: "demo.organizer@example.com",
  branch: "Information Science",
  password: "Demo@123",
};

function loadMongoUri() {
  const envPath = path.join(__dirname, "..", ".env");
  const envContent = fs.readFileSync(envPath, "utf8");
  const match = envContent.match(/MONGODB_URI=(.+)/);
  if (!match) throw new Error("MONGODB_URI not found in .env");
  return match[1].trim();
}

async function main() {
  const uri = loadMongoUri();
  await mongoose.connect(uri);

  const users = mongoose.connection.db.collection("users");
  const profiles = mongoose.connection.db.collection("volunteerprofiles");

  // Student
  {
    const usn = DEMO_STUDENT.usn;
    const existing = await users.findOne({ usn });
    if (existing) {
      console.log(`Skipped (already exists): ${usn}`);
    } else {
      const passwordHash = await bcrypt.hash(DEMO_STUDENT.password, 10);
      const result = await users.insertOne({
        usn,
        name: DEMO_STUDENT.name,
        gender: DEMO_STUDENT.gender,
        phone: DEMO_STUDENT.phone,
        email: DEMO_STUDENT.email,
        branch: DEMO_STUDENT.branch,
        passwordHash,
        role: "student",
        accountStatus: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await profiles.insertOne({
        userId: result.insertedId,
        skills: DEMO_STUDENT.skills.map((name) => ({ name, proficiency: "intermediate" })),
        interests: DEMO_STUDENT.interests,
        experience: [],
        availability: { blockedDates: [] },
        developmentGoals: [],
        preferences: { eventCategories: [] },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log(`Created student account: ${usn} (${DEMO_STUDENT.name})`);
    }
  }

  // Organizer — seeded directly with role "organizer" for demo convenience.
  // In normal operation, organizer accounts only come from Faculty promoting
  // a Student; this bypass exists purely so a demo doesn't require that
  // extra step every time.
  {
    const usn = DEMO_ORGANIZER.usn;
    const existing = await users.findOne({ usn });
    if (existing) {
      console.log(`Skipped (already exists): ${usn}`);
    } else {
      const passwordHash = await bcrypt.hash(DEMO_ORGANIZER.password, 10);
      await users.insertOne({
        usn,
        name: DEMO_ORGANIZER.name,
        gender: DEMO_ORGANIZER.gender,
        phone: DEMO_ORGANIZER.phone,
        email: DEMO_ORGANIZER.email,
        branch: DEMO_ORGANIZER.branch,
        passwordHash,
        role: "organizer",
        accountStatus: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`Created organizer account: ${usn} (${DEMO_ORGANIZER.name})`);
    }
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
