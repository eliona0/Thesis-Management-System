const adminService = require("../services/admin.service");

const getUsers = async (req, res) => {
  try {
    const users = await adminService.getUsers();
    return res.status(200).json({ success: true, users });
  } catch (error) {
    console.error("Get admin users error:", error);
    return res.status(500).json({ success: false, message: "Unable to load users" });
  }
};

const getStudyPrograms = async (req, res) => {
  try {
    const programs = await adminService.getStudyPrograms();
    return res.status(200).json({ success: true, programs });
  } catch (error) {
    console.error("Get admin study programs error:", error);
    return res.status(500).json({ success: false, message: "Unable to load study programs" });
  }
};

const getDashboard = async (req, res) => {
  try {
    const dashboard = await adminService.getDashboard();
    return res.status(200).json({ success: true, dashboard });
  } catch (error) {
    console.error("Get admin dashboard error:", error);
    return res.status(500).json({ success: false, message: "Unable to load admin dashboard" });
  }
};

const normalizeProgramFields = (body, creating) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("INVALID_PROGRAM");
  const allowed = ["name", "department", "degreeLevel", "status"];
  if (Object.keys(body).some((key) => !allowed.includes(key)) || (!creating && !Object.keys(body).length)) throw new Error("INVALID_PROGRAM");
  const data = {};
  for (const field of allowed) {
    if (!Object.hasOwn(body, field)) continue;
    const value = body[field];
    if (field === "status") {
      if (value !== "ACTIVE" && value !== "INACTIVE") throw new Error("INVALID_PROGRAM");
      data.status = value;
    } else if (field === "name") {
      if (typeof value !== "string" || !value.trim() || value.trim().length > 150) throw new Error("INVALID_PROGRAM");
      data.name = value.trim();
    } else {
      if (value !== null && (typeof value !== "string" || value.trim().length > (field === "degreeLevel" ? 50 : 150))) throw new Error("INVALID_PROGRAM");
      data[field] = typeof value === "string" ? value.trim() || null : null;
    }
  }
  if (creating && !data.name) throw new Error("INVALID_PROGRAM");
  return data;
};

const createStudyProgram = async (req, res) => {
  try {
    const data = normalizeProgramFields(req.body, true);
    const program = await adminService.createStudyProgram(data);
    return res.status(201).json({ success: true, program });
  } catch (error) {
    if (error.message === "INVALID_PROGRAM") return res.status(400).json({ success: false, message: "Enter a valid program name, department, degree level, and status" });
    console.error("Create study program error:", error);
    return res.status(500).json({ success: false, message: "Unable to create study program" });
  }
};

const updateStudyProgram = async (req, res) => {
  try {
    const id = Number(req.params.programId);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ success: false, message: "Invalid study program ID" });
    const data = normalizeProgramFields(req.body, false);
    const program = await adminService.updateStudyProgram(id, data);
    if (!program) return res.status(404).json({ success: false, message: "Study program not found" });
    return res.status(200).json({ success: true, program });
  } catch (error) {
    if (error.message === "INVALID_PROGRAM") return res.status(400).json({ success: false, message: "Enter valid program fields" });
    console.error("Update study program error:", error);
    return res.status(500).json({ success: false, message: "Unable to update study program" });
  }
};

const updateUserStatus = async (req, res) => {
  const id = Number(req.params.userId);
  const { isActive } = req.body || {};
  if (!Number.isSafeInteger(id) || id <= 0 || typeof isActive !== "boolean") {
    return res.status(400).json({ success: false, message: "Provide a valid user ID and account status" });
  }
  if (id === req.user.userId && !isActive) {
    return res.status(400).json({ success: false, message: "You cannot deactivate your own account" });
  }
  try {
    const user = await adminService.updateUserStatus(id, isActive);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    return res.status(200).json({ success: true, user });
  } catch (error) {
    console.error("Update user status error:", error);
    return res.status(500).json({ success: false, message: "Unable to update account status" });
  }
};

module.exports = { getUsers, getStudyPrograms, getDashboard, createStudyProgram, updateStudyProgram, updateUserStatus };
