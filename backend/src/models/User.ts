import mongoose, { Schema, Document, Model } from "mongoose";

export type UserRole = "student" | "organizer" | "faculty" | "admin";
export type AccountStatus = "active" | "inactive" | "suspended";
export type Gender = "male" | "female";

export interface IUser extends Document {
  usn: string;
  name: string;
  gender?: Gender;
  phone?: string;
  email?: string;
  branch?: string;
  passwordHash: string;
  role: UserRole;
  accountStatus: AccountStatus;
  profilePictureUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    usn: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: { type: String, required: true, trim: true },
    gender: {
      type: String,
      enum: ["male", "female"],
    },
    phone: { type: String, trim: true },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    branch: { type: String, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["student", "organizer", "faculty", "admin"],
      required: true,
      default: "student",
    },
    accountStatus: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },
    profilePictureUrl: { type: String },
  },
  { timestamps: true }
);

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
