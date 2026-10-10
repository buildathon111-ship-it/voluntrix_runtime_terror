import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { UserRole } from "../models/User";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

if (!JWT_SECRET) {
  throw new Error("Missing JWT_SECRET environment variable");
}

export interface TokenPayload {
  userId: string;
  role: UserRole;
  usn: string;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: TokenPayload, expiresIn?: string): string {
  return jwt.sign(payload, JWT_SECRET as string, {
    expiresIn: expiresIn || JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

export const REMEMBER_ME_JWT_EXPIRES_IN = "30d";

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET as string) as TokenPayload;
  } catch {
    return null;
  }
}
