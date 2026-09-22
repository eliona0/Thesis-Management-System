const express = require("express");

const {
  getMyThesis,
  updateMyThesis,
  approveThesis,
  rejectThesis,
  startThesis,
  createVersion,
  getMyThesisVersions,
  getMentorThesisVersions,
} = require("../../controllers/thesis.controller");

const { authenticate } = require("../../middleware/auth.middleware");
const { requireRole } = require("../../middleware/role.middleware");
const { uploadThesis } = require("../../middleware/upload.middleware");

const router = express.Router();

// Student: view own thesis
router.get(
  "/my-thesis",
  authenticate,
  requireRole("STUDENT"),
  getMyThesis
);

// Student: edit thesis details before mentor approval
router.patch(
  "/my-thesis",
  authenticate,
  requireRole("STUDENT"),
  updateMyThesis
);

// Mentor: approve assigned thesis
router.patch(
  "/:id/approve",
  authenticate,
  requireRole("MENTOR"),
  approveThesis
);

// Mentor: reject assigned thesis
router.patch(
  "/:id/reject",
  authenticate,
  requireRole("MENTOR"),
  rejectThesis
);

// Mentor: start approved thesis
router.patch(
  "/:id/start",
  authenticate,
  requireRole("MENTOR"),
  startThesis
);

// Student: upload a new thesis version
router.post(
  "/my-thesis/versions",
  authenticate,
  requireRole("STUDENT"),
  uploadThesis.single("thesisFile"),
  createVersion
);

// Student: view own thesis versions
router.get(
  "/my-thesis/versions",
  authenticate,
  requireRole("STUDENT"),
  getMyThesisVersions
);

router.get(
  "/:thesisId/versions",
  authenticate,
  requireRole("MENTOR"),
  getMentorThesisVersions
);

module.exports = router;