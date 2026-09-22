const feedbackService = require("../services/feedback.service");

const createFeedback = async (req, res) => {
  try {
    const mentorUserId = req.user.userId;
    const versionId = Number(req.params.versionId);
    const { comment } = req.body;

    const result = await feedbackService.createFeedback({
      mentorUserId,
      versionId,
      comment,
    });

    return res.status(201).json({
      success: true,
      message: "Feedback added successfully",
      feedback: result.feedback,
      version: result.version,
    });
  } catch (error) {
    console.error("Create feedback error:", error);

    if (error.message === "COMMENT_REQUIRED") {
      return res.status(400).json({
        success: false,
        message: "Feedback comment is required",
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
        message: "You are not authorized to review this thesis version",
      });
    }

    if (error.message === "VERSION_NOT_SUBMITTED") {
      return res.status(400).json({
        success: false,
        message: "Only submitted thesis versions can be reviewed",
      });
    }

    if (error.message === "FEEDBACK_ALREADY_EXISTS") {
      return res.status(409).json({
        success: false,
        message: "Feedback has already been added for this version",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

const getMyVersionFeedback = async (req, res) => {
  try {
    const studentId = req.user.userId;
    const versionId = Number(req.params.versionId);

    const feedback = await feedbackService.getStudentFeedback({
      studentId,
      versionId,
    });

    return res.status(200).json({
      success: true,
      feedback,
    });
  } catch (error) {
    console.error("Get feedback error:", error);

    if (error.message === "VERSION_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Thesis version not found",
      });
    }

    if (error.message === "UNAUTHORIZED_VERSION") {
      return res.status(403).json({
        success: false,
        message: "You cannot view feedback for this thesis version",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

module.exports = {
  createFeedback,
  getMyVersionFeedback,
};