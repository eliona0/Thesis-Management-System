const committeeService = require("../services/committee.service");

const assignCommittee = async (req, res) => {
  try {
    const thesisId = Number(req.params.thesisId);

    if (!Number.isSafeInteger(thesisId) || thesisId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid thesis ID",
      });
    }

    const { members } = req.body;

    const committee = await committeeService.assignCommittee({
      thesisId,
      members,
    });

    return res.status(201).json({
      success: true,
      message: "Committee assigned successfully",
      committee,
    });
  } catch (error) {
    console.error("Assign committee error:", error);

    if (error.message === "THESIS_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Thesis not found",
      });
    }

    if (error.message === "THESIS_NOT_SUBMITTED") {
      return res.status(400).json({
        success: false,
        message: "Only submitted theses can have a committee assigned",
      });
    }

    if (error.message === "COMMITTEE_ALREADY_EXISTS") {
      return res.status(409).json({
        success: false,
        message: "A committee has already been assigned to this thesis",
      });
    }

    if (error.message === "INVALID_COMMITTEE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "Committee must contain exactly 3 members",
      });
    }

    if (["INVALID_COMMITTEE_ROLE", "INVALID_COMMITTEE_MEMBER_ID", "INVALID_COMMITTEE_MEMBER_ROLE"].includes(error.message)) {
      return res.status(400).json({ success: false, message: "Committee members or roles are invalid" });
    }

    if (error.message === "INVALID_CHAIR_COUNT") {
      return res.status(400).json({
        success: false,
        message: "Committee must have exactly one chair",
      });
    }

    if (error.message === "INVALID_MEMBER_COUNT") {
      return res.status(400).json({
        success: false,
        message: "Committee must have exactly two members",
      });
    }

    if (error.message === "DUPLICATE_COMMITTEE_MEMBER") {
      return res.status(400).json({
        success: false,
        message: "The same committee member cannot be assigned twice",
      });
    }

    if (error.message === "COMMITTEE_MEMBER_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "One or more committee members were not found",
      });
    }

    if (error.message === "COMMITTEE_MEMBER_INACTIVE") {
      return res.status(400).json({
        success: false,
        message: "One or more committee members are inactive",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Something went wrong while assigning the committee",
    });
  }
};

const getCommittee = async (req, res) => {
  try {
    const thesisId = Number(req.params.thesisId);

    if (!Number.isSafeInteger(thesisId) || thesisId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid thesis ID",
      });
    }

    const committee = await committeeService.getCommittee(thesisId);

    return res.status(200).json({
      success: true,
      committee,
    });
  } catch (error) {
    console.error("Get committee error:", error);

    if (error.message === "THESIS_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Thesis not found",
      });
    }

    if (error.message === "COMMITTEE_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Committee not found for this thesis",
      });
    }

    if (error.message === "INVALID_THESIS_ID") {
      return res.status(400).json({ success: false, message: "Invalid thesis ID" });
    }

    return res.status(500).json({
      success: false,
      message: "Something went wrong while getting the committee",
    });
  }
};

const scheduleDefense = async (req, res) => {
  try {
    const thesisId = Number(req.params.thesisId);
    const { defenseDate } = req.body;

    if (!Number.isSafeInteger(thesisId) || thesisId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid thesis ID",
      });
    }

    if (!defenseDate) {
      return res.status(400).json({
        success: false,
        message: "Defense date is required",
      });
    }

    const committee = await committeeService.scheduleDefense({
      thesisId,
      defenseDate,
    });

    return res.status(200).json({
      success: true,
      message: "Defense scheduled successfully",
      committee,
    });
  } catch (error) {
    console.error("Schedule defense error:", error);

    if (error.message === "COMMITTEE_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Committee not found",
      });
    }

    if (error.message === "COMMITTEE_ALREADY_SCHEDULED") {
      return res.status(409).json({
        success: false,
        message: "Defense has already been scheduled",
      });
    }

    if (error.message === "COMMITTEE_INVALID_TRANSITION") {
      return res.status(409).json({ success: false, message: "Committee is not in a schedulable state" });
    }

    if (error.message === "INVALID_DEFENSE_DATE") {
      return res.status(400).json({
        success: false,
        message: "Invalid defense date",
      });
    }

    if (error.message === "DEFENSE_DATE_MUST_BE_FUTURE") {
      return res.status(400).json({
        success: false,
        message: "Defense date must be in the future",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Something went wrong while scheduling the defense",
    });
  }
};

const createEvaluation = async (req, res) => {
  try {
    const result = await committeeService.createEvaluation({
      committeeMemberUserId: req.user.userId,
      thesisId: req.params.thesisId,
      grade: req.body?.grade,
      comments: req.body?.comments,
    });
    return res.status(201).json({
      success: true,
      message: "Committee evaluation recorded successfully",
      ...result,
    });
  } catch (error) {
    console.error("Create committee evaluation error:", error);
    const errors = {
      INVALID_THESIS_ID: [400, "Invalid thesis ID"],
      INVALID_GRADE: [400, "Grade must be between 6 and 10"],
      INVALID_COMMENTS: [400, "Comments must be text"],
      COMMITTEE_MEMBER_NOT_FOUND: [404, "Committee member profile not found"],
      COMMITTEE_NOT_FOUND: [404, "Committee not found for this thesis"],
      COMMITTEE_NOT_SCHEDULED: [409, "Only scheduled committees can receive evaluations"],
      UNAUTHORIZED_COMMITTEE_MEMBER: [403, "You are not assigned to this committee"],
      EVALUATION_ALREADY_EXISTS: [409, "You have already evaluated this thesis"],
      COMMITTEE_INVALID_TRANSITION: [409, "Committee cannot be completed in its current state"],
    };
    if (errors[error.message]) {
      const [status, message] = errors[error.message];
      return res.status(status).json({ success: false, message });
    }
    return res.status(500).json({ success: false, message: "Something went wrong while recording the evaluation" });
  }
};

module.exports = {
  assignCommittee,
  getCommittee,
  scheduleDefense,
  createEvaluation,
};
