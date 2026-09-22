const express = require("express");

const {
  createFeedback,
  getMyVersionFeedback,
} = require("../../controllers/feedback.controller");

const { authenticate } = require("../../middleware/auth.middleware");
const { requireRole } = require("../../middleware/role.middleware");

const router = express.Router();

// Mentor gives feedback on a submitted thesis version
router.post(
  "/:versionId",
  authenticate,
  requireRole("MENTOR"),
  createFeedback
);

// Student views feedback for own thesis version
router.get(
  "/my-version/:versionId",
  authenticate,
  requireRole("STUDENT"),
  getMyVersionFeedback
);

module.exports = router;