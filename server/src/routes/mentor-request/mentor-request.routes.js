const express = require("express");

const {
  createMentorRequest,
} = require("../../controllers/mentorRequest.controller");

const { authenticate } = require("../../middleware/auth.middleware");
const { requireRole } = require("../../middleware/role.middleware");

const router = express.Router();

router.post(
  "/",
  authenticate,
  requireRole("STUDENT"),
  createMentorRequest
);

module.exports = router;