const express = require("express");

const {
  assignCommittee,
  getCommittee,
  scheduleDefense,
} = require("../../controllers/committee.controller");

const { authenticate } = require("../../middleware/auth.middleware");
const { requireRole } = require("../../middleware/role.middleware");

const router = express.Router();

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

module.exports = router;