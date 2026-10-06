const thesisService = require("../services/thesis.service");

const getMyThesis = async (req, res) => {
  try {
    const studentId = req.user.userId;

    const thesis = await thesisService.getStudentThesis(studentId);

    return res.status(200).json({
      success: true,
      thesis,
    });
  } catch (error) {
    console.error("Get student thesis error:", error);

    if (error.message === "THESIS_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Thesis not found",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

const updateMyThesis = async (req, res) => {
  try {
    const studentId = req.user.userId;
    const { title, description, researchField } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Thesis title is required",
      });
    }

    const thesis = await thesisService.updateStudentThesis({
      studentId,
      title: title.trim(),
      description,
      researchField,
    });

    return res.status(200).json({
      success: true,
      message: "Thesis updated successfully",
      thesis,
    });
  } catch (error) {
    console.error("Update student thesis error:", error);

    if (error.message === "THESIS_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Thesis not found",
      });
    }

    if (error.message === "THESIS_ALREADY_APPROVED") {
      return res.status(409).json({
        success: false,
        message: "Thesis details can no longer be changed directly",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

const approveThesis = async (req, res) => {
  try {
    const mentorUserId = req.user.userId;
    const thesisId = Number(req.params.id);

    if (Number.isNaN(thesisId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid thesis ID",
      });
    }

    const thesis = await thesisService.approveThesis({
      mentorUserId,
      thesisId,
    });

    return res.status(200).json({
      success: true,
      message: "Thesis approved successfully",
      thesis,
    });
  } catch (error) {
    console.error("Approve thesis error:", error);

    if (error.message === "THESIS_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Thesis not found",
      });
    }

    if (error.message === "UNAUTHORIZED_THESIS") {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to approve this thesis",
      });
    }

    if (error.message === "THESIS_NOT_PENDING") {
      return res.status(409).json({
        success: false,
        message: "Only pending theses can be approved",
      });
    }

    if (error.message === "THESIS_TITLE_REQUIRED") {
      return res.status(400).json({
        success: false,
        message: "Thesis must have a valid title before approval",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

const rejectThesis = async (req, res) => {
  try {
    const mentorUserId = req.user.userId;
    const thesisId = Number(req.params.id);
    const { rejectionReason } = req.body;

    if (Number.isNaN(thesisId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid thesis ID",
      });
    }

    const thesis = await thesisService.rejectThesis({
      mentorUserId,
      thesisId,
      rejectionReason,
    });

    return res.status(200).json({
      success: true,
      message: "Thesis rejected successfully",
      thesis,
    });
  } catch (error) {
    console.error("Reject thesis error:", error);

    if (error.message === "THESIS_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Thesis not found",
      });
    }

    if (error.message === "UNAUTHORIZED_THESIS") {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to reject this thesis",
      });
    }

    if (error.message === "THESIS_NOT_PENDING") {
      return res.status(409).json({
        success: false,
        message: "Only pending theses can be rejected",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

const createVersion = async (req, res) => {
  try {
    const studentId = req.user.userId;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Thesis file is required",
      });
    }

    const version =
      await thesisService.createThesisVersion({
        studentId,
        fileName: req.file.originalname,
        filePath: req.file.path,
      });

    return res.status(201).json({
      success: true,
      message: "Thesis version uploaded successfully",
      version,
    });
  } catch (error) {
    console.error("Create thesis version error:", error);

    if (req.file && error.message === "THESIS_NOT_IN_PROGRESS") {
      const fs = require("fs");
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    }

    if (error.message === "THESIS_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Thesis not found",
      });
    }

    if (error.message === "THESIS_NOT_IN_PROGRESS") {
      return res.status(400).json({
        success: false,
        message:
          "Thesis must be in progress before uploading a version",
      });
    }

    if (error.message === "ACTIVE_VERSION_EXISTS") {
  return res.status(400).json({
    success: false,
    message:
      "You must finish the current thesis version before uploading another one",
  });
}

    if (error.message === "ONLY_PDF_FILES_ALLOWED") {
      return res.status(400).json({
        success: false,
        message: "Only PDF files are allowed",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

const getMyThesisVersions = async (req, res) => {
  try {
    const studentId = req.user.userId;

    const versions =
      await thesisService.getStudentThesisVersions(studentId);

    return res.status(200).json({
      success: true,
      versions,
    });
  } catch (error) {
    console.error("Get thesis versions error:", error);

    if (error.message === "THESIS_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Thesis not found",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

const getMentorThesisVersions = async (req, res) => {
  try {
    const mentorUserId = req.user.userId;
    const thesisId = Number(req.params.thesisId);

    if (Number.isNaN(thesisId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid thesis ID",
      });
    }

    const versions = await thesisService.getMentorThesisVersions(
      mentorUserId,
      thesisId
    );

    return res.status(200).json({
      success: true,
      versions,
    });
  } catch (error) {
    console.error("Get mentor thesis versions error:", error);

    if (error.message === "MENTOR_PROFILE_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Mentor profile not found",
      });
    }

    if (error.message === "THESIS_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Thesis not found",
      });
    }

    if (error.message === "UNAUTHORIZED_THESIS") {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this thesis",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};


const submitVersion = async (req, res) => {
  try {
    const studentId = req.user.userId;
    const versionId = Number(req.params.versionId);

    const version = await thesisService.submitThesisVersion({
      studentId,
      versionId,
    });

    return res.status(200).json({
      success: true,
      message: "Thesis version submitted for review",
      version,
    });
  } catch (error) {
    console.error("Submit thesis version error:", error);

    if (error.message === "THESIS_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Thesis not found",
      });
    }

    if (error.message === "THESIS_NOT_IN_PROGRESS") {
      return res.status(400).json({
        success: false,
        message: "Thesis must be in progress",
      });
    }

    if (error.message === "VERSION_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Thesis version not found",
      });
    }

    if (error.message === "UNAUTHORIZED_VERSION") {
      return res.status(403).json({
        success: false,
        message: "You cannot submit this thesis version",
      });
    }

    if (error.message === "VERSION_NOT_DRAFT") {
      return res.status(400).json({
        success: false,
        message: "Only draft versions can be submitted for review",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

const deleteVersion = async (req, res) => {
  try {
    const studentId = req.user.userId;
    const versionId = Number(req.params.versionId);

    const result = await thesisService.deleteThesisVersion({
      studentId,
      versionId,
    });

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("Delete thesis version error:", error);

    if (error.message === "THESIS_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Thesis not found",
      });
    }

    if (error.message === "VERSION_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Thesis version not found",
      });
    }

    if (error.message === "UNAUTHORIZED_VERSION") {
      return res.status(403).json({
        success: false,
        message: "You cannot delete this thesis version",
      });
    }

    if (error.message === "VERSION_CANNOT_BE_DELETED") {
      return res.status(400).json({
        success: false,
        message: "Only draft versions can be deleted",
      });
    }

    if (error.message === "THESIS_NOT_IN_PROGRESS") {
      return res.status(400).json({
        success: false,
        message: "Thesis versions cannot be changed after final approval",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

const submitFinalVersion = async (req, res) => {
  try {
    const version = await thesisService.submitFinalThesisVersion({
      studentId: req.user.userId,
      versionId: Number(req.params.versionId),
    });
    return res.status(200).json({
      success: true,
      message: "Final thesis version submitted successfully",
      version,
    });
  } catch (error) {
    console.error("Submit final thesis version error:", error);
    const messages = {
      THESIS_NOT_FOUND: [404, "Thesis not found"],
      THESIS_NOT_IN_PROGRESS: [400, "Thesis must be in progress"],
      VERSION_NOT_FOUND: [404, "Thesis version not found"],
      UNAUTHORIZED_VERSION: [403, "You cannot submit this thesis version"],
      VERSION_NOT_DRAFT: [400, "Only draft versions can be submitted"],
      THESIS_START_DATE_NOT_FOUND: [400, "Thesis start date is not available"],
    };
    if (error.message === "MINIMUM_DURATION_NOT_COMPLETED") {
      return res.status(400).json({
        success: false,
        code: error.message,
        message: "Minimum thesis duration has not yet been completed.",
        earliestFinalSubmissionDate: error.earliestFinalSubmissionDate,
      });
    }
    if (messages[error.message]) {
      const [status, message] = messages[error.message];
      return res.status(status).json({ success: false, message });
    }
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const approveFinalVersion = async (req, res) => {
  try {
    const mentorUserId = req.user.userId;
    const versionId = Number(req.params.versionId);

    const { mentorFinalEvaluation, finalGrade } = req.body || {};
    const result = await thesisService.approveFinalThesisVersion({
      mentorUserId,
      versionId,
      mentorFinalEvaluation,
      finalGrade,
    });

    return res.status(200).json({
      success: true,
      message: "Final thesis version approved successfully",
      version: result.version,
      thesis: result.thesis,
    });
  } catch (error) {
    console.error("Approve final version error:", error);

    if (error.message === "VERSION_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Thesis version not found",
      });
    }

    if (error.message === "UNAUTHORIZED_VERSION") {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to approve this thesis version",
      });
    }

    if (error.message === "THESIS_NOT_IN_PROGRESS") {
      return res.status(400).json({
        success: false,
        message: "Thesis is not currently in progress",
      });
    }

    if (error.message === "VERSION_NOT_SUBMITTED") {
      return res.status(400).json({
        success: false,
        message: "Only submitted thesis versions can be approved",
      });
    }

    if (error.message === "VERSION_SUBMISSION_DATE_NOT_FOUND") {
      return res.status(400).json({ success: false, message: "Version submission date is not available" });
    }
    if (error.message === "FINAL_EVALUATION_DEADLINE_EXCEEDED") {
      return res.status(400).json({ success: false, code: error.message, message: "The final evaluation deadline has passed" });
    }
    if (error.message === "INVALID_FINAL_GRADE") {
      return res.status(400).json({ success: false, code: error.message, message: "Final grade must be between 6 and 10" });
    }

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

const getFinalApprovalStatus = async (req, res) => {
  try {
    const mentorUserId = req.user.userId;
    const versionId = Number(req.params.versionId);

    if (Number.isNaN(versionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid version ID",
      });
    }

    const status = await thesisService.getFinalApprovalStatus({
      mentorUserId,
      versionId,
    });

    return res.status(200).json({
      success: true,
      ...status,
    });
  } catch (error) {
    console.error("Get final approval status error:", error);

    if (error.message === "VERSION_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Thesis version not found",
      });
    }

    if (error.message === "UNAUTHORIZED_VERSION") {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this version",
      });
    }

    if (error.message === "THESIS_START_DATE_NOT_FOUND") {
      return res.status(400).json({
        success: false,
        message: "Thesis start date is not available",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

module.exports = {
  getMyThesis,
  updateMyThesis,
  approveThesis,
   rejectThesis,
    createVersion,
  getMyThesisVersions,
  getMentorThesisVersions,
  submitVersion,
  submitFinalVersion,
  deleteVersion,
  approveFinalVersion,
  getFinalApprovalStatus,
};
