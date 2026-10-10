import { Request, Response, NextFunction } from "express";
import { verifyToken, TokenPayload } from "../lib/auth";
import { connectDB } from "../lib/db";
import User from "../models/User";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: TokenPayload;
    }
  }
}

export async function attachAuth(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const payload = verifyToken(token);
      if (payload) {
        // The token only proves identity. Role and account status are read
        // fresh so a promotion, demotion or suspension applies immediately
        // instead of waiting for the token to expire.
        await connectDB();
        const user = await User.findById(payload.userId).select(
          "role accountStatus usn"
        );
        if (user && user.accountStatus === "active") {
          req.auth = {
            userId: payload.userId,
            role: user.role,
            usn: user.usn,
          };
        }
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (!roles.includes(req.auth.role)) {
      res.status(403).json({ error: "Not authorized for this resource" });
      return;
    }
    next();
  };
}
