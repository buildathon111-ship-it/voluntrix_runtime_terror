import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type SkillProficiency = "beginner" | "intermediate" | "advanced";

export interface ISkill {
  name: string;
  proficiency: SkillProficiency;
}

export interface IExperience {
  eventId?: Types.ObjectId;
  roleTitle: string;
  year: number;
  description?: string;
}

export interface IAvailability {
  startDate?: Date;
  endDate?: Date;
  blockedDates: Date[];
}

export interface IVolunteerProfile extends Document {
  userId: Types.ObjectId;
  yearOfStudy?: number;
  skills: ISkill[];
  interests: string[];
  experience: IExperience[];
  availability: IAvailability;
  developmentGoals: string[];
  preferences: {
    eventCategories: string[];
    maxHoursPerMonth?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const SkillSchema = new Schema<ISkill>(
  {
    name: { type: String, required: true, trim: true },
    proficiency: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      default: "beginner",
    },
  },
  { _id: false }
);

const ExperienceSchema = new Schema<IExperience>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event" },
    roleTitle: { type: String, required: true },
    year: { type: Number, required: true },
    description: { type: String },
  },
  { _id: false }
);

const VolunteerProfileSchema = new Schema<IVolunteerProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    yearOfStudy: { type: Number, min: 1, max: 6 },
    skills: { type: [SkillSchema], default: [] },
    interests: { type: [String], default: [] },
    experience: { type: [ExperienceSchema], default: [] },
    availability: {
      startDate: { type: Date },
      endDate: { type: Date },
      blockedDates: { type: [Date], default: [] },
    },
    developmentGoals: { type: [String], default: [] },
    preferences: {
      eventCategories: { type: [String], default: [] },
      maxHoursPerMonth: { type: Number },
    },
  },
  { timestamps: true }
);

VolunteerProfileSchema.index({ yearOfStudy: 1 });

const VolunteerProfile: Model<IVolunteerProfile> =
  mongoose.models.VolunteerProfile ||
  mongoose.model<IVolunteerProfile>("VolunteerProfile", VolunteerProfileSchema);

export default VolunteerProfile;
