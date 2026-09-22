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

const startThesis = async (req, res) => {
  try {
    const mentorUserId = req.user.userId;
    const thesisId = Number(req.params.id);

    if (Number.isNaN(thesisId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid thesis ID",
      });
    }

    const thesis = await thesisService.startThesis({
      mentorUserId,
      thesisId,
    });

    return res.status(200).json({
      success: true,
      message: "Thesis started successfully",
      thesis,
    });
  } catch (error) {
    console.error("Start thesis error:", error);

    if (error.message === "THESIS_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Thesis not found",
      });
    }

    if (error.message === "UNAUTHORIZED_THESIS") {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to start this thesis",
      });
    }

    if (error.message === "THESIS_NOT_APPROVED") {
      return res.status(409).json({
        success: false,
        message: "Only approved theses can be started",
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

module.exports = {
  getMyThesis,
  updateMyThesis,
  approveThesis,
   rejectThesis,
   startThesis,
    createVersion,
  getMyThesisVersions,
  getMentorThesisVersions,
};