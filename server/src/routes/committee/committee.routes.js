const express = require("express");

const {
  assignCommittee,
  getCommittee,
  getCommitteeMembers,
  getMyCommittees,
  scheduleDefense,
  createEvaluation,
} = require("../../controllers/committee.controller");

const { authenticate } = require("../../middleware/auth.middleware");
const { requireRole } = require("../../middleware/role.middleware");

const router = express.Router();

router.get("/members", authenticate, requireRole("ADMIN"), getCommitteeMembers);
router.get("/my", authenticate, requireRole("COMMITTEE_MEMBER"), getMyCommittees);

router.post(
  "/thesis/:thesisId",
  authenticate,
  requireRole("ADMIN"),
  assignCommittee
);

router.get(
  "/thesis/:thesisId",
  authenticate,
  requireRole("ADMIN"),
  getCommittee
);

router.patch(
  "/thesis/:thesisId/schedule",
  authenticate,
  requireRole("ADMIN"),
  scheduleDefense
);

router.post(
  "/thesis/:thesisId/evaluations",
  authenticate,
  requireRole("COMMITTEE_MEMBER"),
  createEvaluation
);

module.exports = router;
