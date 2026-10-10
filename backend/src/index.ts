import express from "express";
import cors from "cors";
import path from "path";
import multer from "multer";
import { attachAuth } from "./middleware/auth";
import authRoutes from "./routes/auth";
import profileRoutes from "./routes/profile";
import facultyRoutes from "./routes/faculty";
import eventRoutes from "./routes/events";
import studentEventRoutes from "./routes/studentEvents";
import organizerApplicationRoutes from "./routes/organizerApplications";
import applicationRoutes from "./routes/applications";
import assignmentRoutes from "./routes/assignments";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

// Reflect the request origin so the app works from any LAN IP/device without
// hardcoding a single allowed origin. We use Bearer tokens (not cookies) for
// auth, so credentials:true isn't required, but it's harmless to include.
app.use(
  cors({
    origin: (origin, callback) => callback(null, origin ?? true),
    credentials: true,
  })
);

app.use(express.json());
app.use("/uploads", express.static(path.join(process.cwd(), "public", "uploads")));

app.use(attachAuth);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/faculty", facultyRoutes);
// studentEventRoutes must be mounted before eventRoutes: its "/browse"
// paths would otherwise be swallowed by eventRoutes' catch-all "/:id"
// (Express matches route params against any string, including "browse").
app.use("/api/events", studentEventRoutes);
app.use("/api/events", organizerApplicationRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/assignments", assignmentRoutes);

// Multer errors (e.g. file too large) land here instead of the generic 500 handler.
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _next: express.NextFunction
  ) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ error: "Image must be smaller than 2MB" });
        return;
      }
      res.status(400).json({ error: err.message });
      return;
    }
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend listening on http://0.0.0.0:${PORT}`);
});
