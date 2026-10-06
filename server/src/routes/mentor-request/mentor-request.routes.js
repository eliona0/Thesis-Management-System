const express = require("express");

const {
  createMentorRequest,
  getMyMentorRequests,
  cancelMentorRequest,
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

router.get(
  "/my",
  authenticate,
  requireRole("STUDENT"),
  getMyMentorRequests
);

router.patch(
  "/:id/cancel",
  authenticate,
  requireRole("STUDENT"),
  cancelMentorRequest
);

module.exports = router;
