const prisma = require("../config/prisma");

const createFeedback = async ({
  mentorUserId,
  versionId,
  comment,
}) => {
  if (!comment || !comment.trim()) {
    throw new Error("COMMENT_REQUIRED");
  }

  const version = await prisma.thesisVersion.findUnique({
    where: {
      id: versionId,
    },
    include: {
      thesis: true,
    },
  });

  if (!version) {
    throw new Error("VERSION_NOT_FOUND");
  }

  // Vetëm mentori i asaj teme mund të japë feedback
  if (version.thesis.mentorId !== mentorUserId) {
    throw new Error("UNAUTHORIZED_VERSION");
  }

  if (version.thesis.status !== "IN_PROGRESS" || version.submittedAt) {
    throw new Error("FINAL_VERSION_REQUIRES_APPROVAL");
  }

  // Feedback lejohet vetëm pasi studenti e ka submit-uar versionin
  if (version.status !== "SUBMITTED") {
    throw new Error("VERSION_NOT_SUBMITTED");
  }

  // Një feedback për një version
  const existingFeedback = await prisma.feedback.findFirst({
    where: {
      versionId,
    },
  });

  if (existingFeedback) {
    throw new Error("FEEDBACK_ALREADY_EXISTS");
  }

  const result = await prisma.$transaction(async (tx) => {
    const versionUpdate = await tx.thesisVersion.updateMany({
      where: { id: versionId, status: "SUBMITTED", submittedAt: null },
      data: { status: "REVIEWED" },
    });
    if (versionUpdate.count !== 1) throw new Error("VERSION_NOT_SUBMITTED");

    const feedback = await tx.feedback.create({
      data: {
        versionId,
        mentorId: mentorUserId,
        comment: comment.trim(),
      },
    });

    const updatedVersion = await tx.thesisVersion.findUnique({ where: { id: versionId } });

    return {
      feedback,
      version: updatedVersion,
    };
  });

  return result;
};

const getStudentFeedback = async ({
  studentId,
  versionId,
}) => {
  const version = await prisma.thesisVersion.findUnique({
    where: {
      id: versionId,
    },
    include: {
      thesis: true,
    },
  });

  if (!version) {
    throw new Error("VERSION_NOT_FOUND");
  }

  if (version.thesis.studentId !== studentId) {
    throw new Error("UNAUTHORIZED_VERSION");
  }

  const feedback = await prisma.feedback.findMany({
    where: {
      versionId,
    },
    include: {
      mentor: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return feedback;
};

const getMentorFeedback = async (mentorUserId) => prisma.feedback.findMany({
  where: { mentorId: mentorUserId },
  orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  select: {
    id: true,
    comment: true,
    createdAt: true,
    version: {
      select: {
        id: true,
        versionNumber: true,
        uploadedAt: true,
        submittedAt: true,
        thesis: {
          select: {
            id: true,
            title: true,
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                studentProfile: { select: { studentNumber: true } },
                studyProgram: { select: { name: true } },
              },
            },
          },
        },
      },
    },
  },
});

module.exports = {
  createFeedback,
  getStudentFeedback,
  getMentorFeedback,
};
