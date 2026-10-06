const prisma = require("../config/prisma");

const getProfile = async (req, res) => {
  try {
    const profile = await prisma.mentorProfile.findUnique({
      where: { userId: req.user.userId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            studyProgram: { select: { id: true, name: true, department: true } },
          },
        },
      },
    });
    if (!profile) return res.status(404).json({ success: false, message: "Mentor profile not found" });
    return res.status(200).json({
      success: true,
      mentor: {
        id: profile.user.id,
        firstName: profile.user.firstName,
        lastName: profile.user.lastName,
        email: profile.user.email,
        studyProgram: profile.user.studyProgram,
        academicTitle: profile.academicTitle,
        specialization: profile.specialization,
        department: profile.department,
        isAvailable: profile.isAvailable,
      },
    });
  } catch (error) {
    console.error("Get mentor profile error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

module.exports = { getProfile };
