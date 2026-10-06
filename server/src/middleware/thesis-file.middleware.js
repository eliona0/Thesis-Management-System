const path = require("path");
const prisma = require("../config/prisma");

const authorizeThesisFile = async (req, res, next) => {
  try {
    const fileName = path.basename(req.path);
    if (!fileName || fileName === "." || fileName === "..") {
      return res.status(404).json({ success: false, message: "Thesis file not found" });
    }

    const version = await prisma.thesisVersion.findFirst({
      where: { filePath: `/uploads/theses/${fileName}` },
      include: { thesis: true },
    });
    if (!version) return res.status(404).json({ success: false, message: "Thesis file not found" });

    const ownsThesis = req.user.role === "STUDENT" && version.thesis.studentId === req.user.userId;
    const mentorsThesis = req.user.role === "MENTOR" && version.thesis.mentorId === req.user.userId;
    if (!ownsThesis && !mentorsThesis) {
      return res.status(403).json({ success: false, message: "You are not authorized to access this thesis file" });
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { authorizeThesisFile };
