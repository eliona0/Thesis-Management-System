const express = require("express");
const cors = require("cors");
require("dotenv").config();
const path = require("path");

const prisma = require("./config/prisma");
const authRoutes = require("./routes/auth/auth.routes");
const studentRoutes = require("./routes/student/student.routes");
const mentorRequestRoutes = require("./routes/mentor-request/mentor-request.routes");
const mentorRoutes = require("./routes/mentor/mentor.routes");
const thesisRoutes = require("./routes/thesis/thesis.routes");
const feedbackRoutes = require("./routes/feedback/feedback.routes");
const committeeRoutes = require("./routes/committee/committee.routes");
const { getActiveStudyPrograms } = require("./controllers/studyProgram.controller");
const { authenticate } = require("./middleware/auth.middleware");
const { authorizeThesisFile } = require("./middleware/thesis-file.middleware");

const app = express();

app.use(cors());
app.use(express.json());
app.use(
  "/uploads/theses",
  authenticate,
  authorizeThesisFile,
  express.static(path.join(__dirname, "../uploads/theses"), {
    setHeaders: (res) => res.setHeader("Cache-Control", "private, no-store"),
  })
);

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Thesis Management System API is running",
  });
});

app.get("/api/health/db", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      success: true,
      message: "Database connection is working",
    });
  } catch (error) {
    console.error("Database connection error:", error);

    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/mentor-requests", mentorRequestRoutes);
app.use("/api/mentor", mentorRoutes);
app.use("/api/thesis", thesisRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/committee", committeeRoutes);

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.message === "ONLY_PDF_FILES_ALLOWED") {
    return res.status(400).json({ success: false, message: "Only PDF files are allowed" });
  }
  if (error.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ success: false, message: "Thesis file exceeds the 10 MB limit" });
  }
  console.error("Unhandled API error:", error);
  return res.status(500).json({ success: false, message: "Something went wrong" });
});

app.get("/api/study-programs", getActiveStudyPrograms);

module.exports = app;
