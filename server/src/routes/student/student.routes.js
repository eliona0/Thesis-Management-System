const express = require("express");

const {
  getProfile,
  getAvailableMentors,
} = require("../../controllers/student.controller");

const { authenticate } = require("../../middleware/auth.middleware");
const { requireRole } = require("../../middleware/role.middleware");

const router = express.Router();

router.get(
  "/mentors",
  authenticate,
  requireRole("STUDENT"),
  getAvailableMentors
);
module.exports = router;