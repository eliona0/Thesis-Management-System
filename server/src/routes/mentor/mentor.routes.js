const express = require("express");

const {
  getMentorRequests,
  acceptMentorRequest,
  rejectMentorRequest,
} = require("../../controllers/mentorRequest.controller");

const { authenticate } = require("../../middleware/auth.middleware");
const { requireRole } = require("../../middleware/role.middleware");

const router = express.Router();

router.get(
  "/requests",
  authenticate,
  requireRole("MENTOR"),
  getMentorRequests
);

router.patch(
  "/requests/:id/accept",
  authenticate,
  requireRole("MENTOR"),
  acceptMentorRequest
);

router.patch(
  "/requests/:id/reject",
  authenticate,
  requireRole("MENTOR"),
  rejectMentorRequest
);

module.exports = router;