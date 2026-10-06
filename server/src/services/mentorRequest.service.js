const prisma = require("../config/prisma");

const activeThesisStatuses = [
  "PENDING",
  "APPROVED",
  "IN_PROGRESS",
  "SUBMITTED",
  "UNDER_EVALUATION",
];

const createMentorRequest = async ({ studentId, mentorId, message }) => {
  const normalizedMentorId = Number(mentorId);
  if (!Number.isSafeInteger(normalizedMentorId) || normalizedMentorId <= 0) {
    throw new Error("MENTOR_NOT_FOUND");
  }
  const mentor = await prisma.mentorProfile.findUnique({
    where: { id: normalizedMentorId },
    include: { user: { select: { id: true, isActive: true, role: { select: { name: true } } } } },
  });
  if (!mentor || !mentor.user?.isActive || mentor.user.role?.name !== "MENTOR") {
    throw new Error("MENTOR_NOT_FOUND");
  }
  if (mentor.userId === studentId) throw new Error("CANNOT_REQUEST_SELF");
  if (!mentor.isAvailable) throw new Error("MENTOR_NOT_AVAILABLE");

  const activeThesis = await prisma.thesis.findFirst({
    where: { studentId, status: { in: activeThesisStatuses } },
  });
  if (activeThesis) throw new Error("STUDENT_ALREADY_HAS_THESIS");

  const existingRequest = await prisma.mentorRequest.findFirst({
    where: { studentId, mentorId: normalizedMentorId, status: "PENDING" },
  });
  if (existingRequest) throw new Error("PENDING_REQUEST_EXISTS");

  return prisma.mentorRequest.create({
    data: {
      studentId,
      mentorId: normalizedMentorId,
      message: typeof message === "string" && message.trim() ? message.trim() : null,
    },
    include: {
      mentor: {
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      },
    },
  });
};

const getStudentMentorRequests = async (studentId) => prisma.mentorRequest.findMany({
  where: { studentId },
  orderBy: { requestDate: "desc" },
  include: {
    mentor: {
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    },
  },
});

const getMentorRequests = async (mentorUserId) => {
  const mentorProfile = await prisma.mentorProfile.findUnique({ where: { userId: mentorUserId } });
  if (!mentorProfile) throw new Error("MENTOR_PROFILE_NOT_FOUND");
  return prisma.mentorRequest.findMany({
    where: { mentorId: mentorProfile.id },
    orderBy: { requestDate: "desc" },
    include: {
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
  });
};

const acceptMentorRequest = async ({ mentorUserId, requestId }) => {
  const mentorProfile = await prisma.mentorProfile.findUnique({ where: { userId: mentorUserId } });
  if (!mentorProfile) throw new Error("MENTOR_PROFILE_NOT_FOUND");
  const request = await prisma.mentorRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new Error("REQUEST_NOT_FOUND");
  if (request.mentorId !== mentorProfile.id) throw new Error("UNAUTHORIZED_REQUEST");
  if (request.studentId === mentorUserId) throw new Error("CANNOT_ACCEPT_OWN_REQUEST");
  if (request.status !== "PENDING") throw new Error("REQUEST_NOT_PENDING");

  try {
    const thesis = await prisma.$transaction(async (tx) => {
      const existingThesis = await tx.thesis.findFirst({
        where: { studentId: request.studentId, status: { in: activeThesisStatuses } },
      });
      if (existingThesis) throw new Error("STUDENT_ALREADY_HAS_THESIS");
      const update = await tx.mentorRequest.updateMany({
        where: { id: requestId, mentorId: mentorProfile.id, status: "PENDING" },
        data: { status: "ACCEPTED", responseDate: new Date() },
      });
      if (update.count !== 1) throw new Error("REQUEST_NOT_PENDING");
      return tx.thesis.create({
        data: {
          studentId: request.studentId,
          mentorId: mentorProfile.userId,
          title: "Untitled Thesis",
          status: "PENDING",
        },
      });
    }, { isolationLevel: "Serializable" });

    const updatedRequest = await prisma.mentorRequest.findUnique({
      where: { id: requestId },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
        mentor: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
    });
    return { ...updatedRequest, thesis };
  } catch (error) {
    if (error.code === "P2034") throw new Error("REQUEST_CONFLICT");
    throw error;
  }
};

const rejectMentorRequest = async ({ mentorUserId, requestId }) => {
  const mentorProfile = await prisma.mentorProfile.findUnique({ where: { userId: mentorUserId } });
  if (!mentorProfile) throw new Error("MENTOR_PROFILE_NOT_FOUND");
  const request = await prisma.mentorRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new Error("REQUEST_NOT_FOUND");
  if (request.mentorId !== mentorProfile.id) throw new Error("UNAUTHORIZED_REQUEST");
  if (request.status !== "PENDING") throw new Error("REQUEST_NOT_PENDING");
  const result = await prisma.mentorRequest.updateMany({
    where: { id: requestId, mentorId: mentorProfile.id, status: "PENDING" },
    data: { status: "REJECTED", responseDate: new Date() },
  });
  if (result.count !== 1) throw new Error("REQUEST_NOT_PENDING");
  return prisma.mentorRequest.findUnique({
    where: { id: requestId },
    include: { student: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
};

const cancelMentorRequest = async ({ studentId, requestId }) => {
  const request = await prisma.mentorRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new Error("REQUEST_NOT_FOUND");
  if (request.studentId !== studentId) throw new Error("UNAUTHORIZED_REQUEST");
  if (request.status !== "PENDING") throw new Error("REQUEST_NOT_PENDING");
  const result = await prisma.mentorRequest.updateMany({
    where: { id: requestId, studentId, status: "PENDING" },
    data: { status: "CANCELLED", responseDate: new Date() },
  });
  if (result.count !== 1) throw new Error("REQUEST_NOT_PENDING");
  return prisma.mentorRequest.findUnique({ where: { id: requestId } });
};

module.exports = {
  createMentorRequest,
  getStudentMentorRequests,
  getMentorRequests,
  acceptMentorRequest,
  rejectMentorRequest,
  cancelMentorRequest,
};
