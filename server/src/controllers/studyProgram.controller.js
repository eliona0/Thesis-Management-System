const studyProgramService = require("../services/studyProgram.service");

const getActiveStudyPrograms = async (req, res) => {
  try {
    const programs = await studyProgramService.getActiveStudyPrograms();
    return res.status(200).json({ success: true, programs });
  } catch (error) {
    console.error("Get active study programs error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

module.exports = { getActiveStudyPrograms };
