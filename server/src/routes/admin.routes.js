const express = require("express");
const { getUsers, getStudyPrograms, getDashboard, createStudyProgram, updateStudyProgram, updateUserStatus } = require("../controllers/admin.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

const router = express.Router();
router.use(authenticate, requireRole("ADMIN"));
router.get("/users", getUsers);
router.patch("/users/:userId/status", updateUserStatus);
router.get("/dashboard", getDashboard);
router.get("/study-programs", getStudyPrograms);
router.post("/study-programs", createStudyProgram);
router.patch("/study-programs/:programId", updateStudyProgram);

module.exports = router;
