const express = require("express");

const {
  assignCommittee,
  getCommittee,
  getCommitteeMembers,
  getEligibleTheses,
  getAdminCommittees,
  getMyCommittees,
  getMyDashboard,
  scheduleDefense,
  createEvaluation,
  confirmFinalDecision,
} = require("../../controllers/committee.controller");

const { authenticate } = require("../../middleware/auth.middleware");
const { requireRole } = require("../../middleware/role.middleware");

const router = express.Router();

router.get("/members", authenticate, requireRole("ADMIN"), getCommitteeMembers);
router.get("/eligible-theses", authenticate, requireRole("ADMIN"), getEligibleTheses);
router.get("/admin", authenticate, requireRole("ADMIN"), getAdminCommittees);
router.get("/my", authenticate, requireRole("COMMITTEE_MEMBER"), getMyCommittees);
router.get("/dashboard", authenticate, requireRole("COMMITTEE_MEMBER"), getMyDashboard);

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

router.post(
  "/thesis/:thesisId/final-decision",
  authenticate,
  requireRole("COMMITTEE_MEMBER"),
  confirmFinalDecision
);

module.exports = router;
