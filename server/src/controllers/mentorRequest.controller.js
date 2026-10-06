const mentorRequestService = require("../services/mentorRequest.service");

const createMentorRequest = async (req, res) => {
  try {
    const studentId = req.user.userId;
    const { mentorId, message } = req.body;

    if (!mentorId) {
      return res.status(400).json({
        success: false,
        message: "Mentor ID is required",
      });
    }

    const request = await mentorRequestService.createMentorRequest({
      studentId,
      mentorId,
      message,
    });

    return res.status(201).json({
      success: true,
      message: "Mentor request sent successfully",
      request: {
        id: request.id,
        status: request.status,
        message: request.message,
        requestDate: request.requestDate,
        mentor: {
          firstName: request.mentor.user.firstName,
          lastName: request.mentor.user.lastName,
          email: request.mentor.user.email,
        },
      },
    });
  } catch (error) {
    console.error("Create mentor request error:", error);

    if (error.message === "MENTOR_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Mentor not found",
      });
    }

    if (error.message === "MENTOR_NOT_AVAILABLE") {
      return res.status(400).json({
        success: false,
        message: "Mentor is not available",
      });
    }

    if (error.message === "CANNOT_REQUEST_SELF") {
      return res.status(400).json({ success: false, message: "You cannot request yourself as a mentor" });
    }

    if (error.message === "STUDENT_ALREADY_HAS_THESIS") {
      return res.status(409).json({ success: false, message: "Student already has an active thesis" });
    }

    if (error.message === "PENDING_REQUEST_EXISTS") {
      return res.status(409).json({
        success: false,
        message: "You already have a pending request for this mentor",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

const getMentorRequests = async (req, res) => {
  try {
    const mentorUserId = req.user.userId;

    const requests = await mentorRequestService.getMentorRequests(
      mentorUserId
    );

    return res.status(200).json({
      success: true,
      requests,
    });
  } catch (error) {
    console.error("Get mentor requests error:", error);

    if (error.message === "MENTOR_PROFILE_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Mentor profile not found",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

const acceptMentorRequest = async (req, res) => {
  try {
    const mentorUserId = req.user.userId;
    const requestId = Number(req.params.id);

    if (!Number.isSafeInteger(requestId) || requestId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID",
      });
    }

    const updatedRequest =
      await mentorRequestService.acceptMentorRequest({
        mentorUserId,
        requestId,
      });

    return res.status(200).json({
      success: true,
      message: "Mentor request accepted successfully",
      request: updatedRequest,
    });
  } catch (error) {
    console.error("Accept mentor request error:", error);

    if (error.message === "MENTOR_PROFILE_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Mentor profile not found",
      });
    }

    if (error.message === "REQUEST_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Mentor request not found",
      });
    }

    if (error.message === "UNAUTHORIZED_REQUEST") {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to manage this request",
      });
    }

    if (error.message === "REQUEST_NOT_PENDING") {
      return res.status(400).json({
        success: false,
        message: "Only pending requests can be accepted",
      });
    }

    if (error.message === "CANNOT_ACCEPT_OWN_REQUEST") {
      return res.status(403).json({ success: false, message: "You cannot accept your own mentor request" });
    }

    if (error.message === "STUDENT_ALREADY_HAS_THESIS") {
      return res.status(409).json({ success: false, message: "Student already has an active thesis" });
    }

    if (error.message === "REQUEST_CONFLICT") {
      return res.status(409).json({ success: false, message: "The request changed while it was being processed" });
    }

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

const rejectMentorRequest = async (req, res) => {
  try {
    const mentorUserId = req.user.userId;
    const requestId = Number(req.params.id);

    if (!Number.isSafeInteger(requestId) || requestId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID",
      });
    }

    const updatedRequest =
      await mentorRequestService.rejectMentorRequest({
        mentorUserId,
        requestId,
      });

    return res.status(200).json({
      success: true,
      message: "Mentor request rejected successfully",
      request: updatedRequest,
    });
  } catch (error) {
    console.error("Reject mentor request error:", error);

    if (error.message === "MENTOR_PROFILE_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Mentor profile not found",
      });
    }

    if (error.message === "REQUEST_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Mentor request not found",
      });
    }

    if (error.message === "UNAUTHORIZED_REQUEST") {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to manage this request",
      });
    }

    if (error.message === "REQUEST_NOT_PENDING") {
      return res.status(400).json({
        success: false,
        message: "Only pending requests can be rejected",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

const getMyMentorRequests = async (req, res) => {
  try {
    const requests = await mentorRequestService.getStudentMentorRequests(req.user.userId);
    return res.status(200).json({ success: true, requests });
  } catch (error) {
    console.error("Get student mentor requests error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const cancelMentorRequest = async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    if (!Number.isSafeInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid request ID" });
    }
    const request = await mentorRequestService.cancelMentorRequest({
      studentId: req.user.userId,
      requestId,
    });
    return res.status(200).json({ success: true, message: "Mentor request cancelled successfully", request });
  } catch (error) {
    console.error("Cancel mentor request error:", error);
    if (error.message === "REQUEST_NOT_FOUND") {
      return res.status(404).json({ success: false, message: "Mentor request not found" });
    }
    if (error.message === "UNAUTHORIZED_REQUEST") {
      return res.status(403).json({ success: false, message: "You cannot cancel this mentor request" });
    }
    if (error.message === "REQUEST_NOT_PENDING") {
      return res.status(409).json({ success: false, message: "Only pending requests can be cancelled" });
    }
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

module.exports = {
  createMentorRequest,
  getMyMentorRequests,
  cancelMentorRequest,
  getMentorRequests,
  acceptMentorRequest,
  rejectMentorRequest,
};
