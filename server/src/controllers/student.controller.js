const prisma = require("../config/prisma");

const getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: req.user.userId,
      },
      include: {
        role: true,
        studyProgram: true,
        studentProfile: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    return res.status(200).json({
      success: true,
      student: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role.name,
        studentNumber: user.studentProfile
          ? user.studentProfile.studentNumber
          : null,
        studyProgram: user.studyProgram
          ? user.studyProgram.name
          : null,
      },
    });
  } catch (error) {
    console.error("Get student profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

const getAvailableMentors = async (req, res) => {
  try {
    const mentors = await prisma.mentorProfile.findMany({
      where: {
        isAvailable: true,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        user: {
          firstName: "asc",
        },
      },
    });

    return res.status(200).json({
      success: true,
      mentors: mentors.map((mentor) => ({
        id: mentor.id,
        userId: mentor.user.id,
        firstName: mentor.user.firstName,
        lastName: mentor.user.lastName,
        email: mentor.user.email,
        academicTitle: mentor.academicTitle,
        specialization: mentor.specialization,
        department: mentor.department,
        isAvailable: mentor.isAvailable,
      })),
    });
  } catch (error) {
    console.error("Get available mentors error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

module.exports = {
  getProfile,
  getAvailableMentors,
};