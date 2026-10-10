/**
 * Seeds faculty accounts directly into MongoDB. Faculty accounts are never
 * created via the public /register flow — they are pre-provisioned here.
 *
 * Usage: node scripts/seedFaculty.js
 *
 * Edit the FACULTY_ACCOUNTS list below to add real names/passwords, then
 * re-run. Existing accounts (matched by username) are left untouched.
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const FACULTY_ACCOUNTS = [
  { username: "FACULTY1", name: "Faculty Admin", password: "Faculty@123" },
];

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

  for (const account of FACULTY_ACCOUNTS) {
    const usn = account.username.trim().toUpperCase();
    const existing = await users.findOne({ usn });

    if (existing) {
      console.log(`Skipped (already exists): ${usn}`);
      continue;
    }

    const passwordHash = await bcrypt.hash(account.password, 10);

    await users.insertOne({
      usn,
      name: account.name,
      passwordHash,
      role: "faculty",
      accountStatus: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`Created faculty account: ${usn} (${account.name})`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
