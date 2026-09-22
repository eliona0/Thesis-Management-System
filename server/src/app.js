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

const app = express();

app.use(cors());
app.use(express.json());
app.use(
  "/uploads",
  express.static(path.join(__dirname, "../uploads"))
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

module.exports = app;