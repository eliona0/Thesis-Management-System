const prisma = require("../config/prisma");

const memberInclude = {
  member: {
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          isActive: true,
        },
      },
    },
  },
};

const assignCommittee = async ({ thesisId, members }) => {
  const normalizedThesisId = Number(thesisId);
  if (!Number.isSafeInteger(normalizedThesisId) || normalizedThesisId <= 0) {
    throw new Error("INVALID_THESIS_ID");
  }

  const thesis = await prisma.thesis.findUnique({
    where: { id: normalizedThesisId },
    include: { committee: true },
  });
  if (!thesis) throw new Error("THESIS_NOT_FOUND");
  if (thesis.status !== "SUBMITTED") throw new Error("THESIS_NOT_SUBMITTED");
  if (thesis.committee) throw new Error("COMMITTEE_ALREADY_EXISTS");

  if (!Array.isArray(members) || members.length !== 3) {
    throw new Error("INVALID_COMMITTEE_SIZE");
  }
  if (members.some((member) => !member || !["CHAIR", "MEMBER"].includes(member.role))) {
    throw new Error("INVALID_COMMITTEE_ROLE");
  }

  const chairCount = members.filter((member) => member.role === "CHAIR").length;
  const memberCount = members.filter((member) => member.role === "MEMBER").length;
  if (chairCount !== 1) throw new Error("INVALID_CHAIR_COUNT");
  if (memberCount !== 2) throw new Error("INVALID_MEMBER_COUNT");

  const memberIds = members.map((member) => Number(member.committeeMemberId));
  if (memberIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    throw new Error("INVALID_COMMITTEE_MEMBER_ID");
  }
  if (new Set(memberIds).size !== 3) throw new Error("DUPLICATE_COMMITTEE_MEMBER");

  const profiles = await prisma.committeeMemberProfile.findMany({
    where: { id: { in: memberIds } },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          isActive: true,
          role: { select: { name: true } },
        },
      },
    },
  });
  if (profiles.length !== 3) throw new Error("COMMITTEE_MEMBER_NOT_FOUND");
  if (profiles.some((profile) => !profile.user.isActive)) {
    throw new Error("COMMITTEE_MEMBER_INACTIVE");
  }
  if (profiles.some((profile) => profile.user.role?.name !== "COMMITTEE_MEMBER")) {
    throw new Error("INVALID_COMMITTEE_MEMBER_ROLE");
  }

  try {
    return await prisma.$transaction(async (tx) => tx.committee.create({
      data: {
        thesisId: thesis.id,
        status: "ASSIGNED",
        members: {
          create: members.map((member, index) => ({
            committeeMemberId: memberIds[index],
            role: member.role,
          })),
        },
      },
      include: { members: { include: memberInclude } },
    }), { isolationLevel: "Serializable" });
  } catch (error) {
    if (error.code === "P2002") throw new Error("COMMITTEE_ALREADY_EXISTS");
    throw error;
  }
};

const getCommittee = async (thesisId) => {
  const normalizedThesisId = Number(thesisId);
  if (!Number.isSafeInteger(normalizedThesisId) || normalizedThesisId <= 0) {
    throw new Error("INVALID_THESIS_ID");
  }
  const thesis = await prisma.thesis.findUnique({ where: { id: normalizedThesisId } });
  if (!thesis) throw new Error("THESIS_NOT_FOUND");

  const committee = await prisma.committee.findUnique({
    where: { thesisId: normalizedThesisId },
    include: {
      members: {
        orderBy: { role: "asc" },
        include: memberInclude,
      },
    },
  });
  if (!committee) throw new Error("COMMITTEE_NOT_FOUND");
  return committee;
};

const scheduleDefense = async ({ thesisId, defenseDate }) => {
  const normalizedThesisId = Number(thesisId);
  if (!Number.isSafeInteger(normalizedThesisId) || normalizedThesisId <= 0) {
    throw new Error("INVALID_THESIS_ID");
  }
  const date = new Date(defenseDate);
  if (!defenseDate || Number.isNaN(date.getTime())) throw new Error("INVALID_DEFENSE_DATE");
  if (date <= new Date()) throw new Error("DEFENSE_DATE_MUST_BE_FUTURE");

  const committee = await prisma.committee.findUnique({
    where: { thesisId: normalizedThesisId },
  });
  if (!committee) throw new Error("COMMITTEE_NOT_FOUND");
  if (committee.status !== "ASSIGNED") throw new Error("COMMITTEE_INVALID_TRANSITION");

  const update = await prisma.committee.updateMany({
    where: { id: committee.id, status: "ASSIGNED" },
    data: { defenseDate: date, status: "SCHEDULED" },
  });
  if (update.count !== 1) throw new Error("COMMITTEE_INVALID_TRANSITION");
  return prisma.committee.findUnique({
    where: { id: committee.id },
    include: { members: { include: memberInclude } },
  });
};

const createEvaluation = async ({ committeeMemberUserId, thesisId, grade, comments }) => {
  const normalizedThesisId = Number(thesisId);
  const numericGrade = Number(grade);
  if (!Number.isSafeInteger(normalizedThesisId) || normalizedThesisId <= 0) {
    throw new Error("INVALID_THESIS_ID");
  }
  if (grade === undefined || grade === null || grade === "" ||
      !Number.isFinite(numericGrade) || numericGrade < 6 || numericGrade > 10) {
    throw new Error("INVALID_GRADE");
  }
  if (comments !== undefined && comments !== null && typeof comments !== "string") {
    throw new Error("INVALID_COMMENTS");
  }

  const profile = await prisma.committeeMemberProfile.findUnique({
    where: { userId: committeeMemberUserId },
    select: { id: true },
  });
  if (!profile) throw new Error("COMMITTEE_MEMBER_NOT_FOUND");

  const committee = await prisma.committee.findUnique({
    where: { thesisId: normalizedThesisId },
    include: { members: true },
  });
  if (!committee) throw new Error("COMMITTEE_NOT_FOUND");
  if (committee.status !== "SCHEDULED") throw new Error("COMMITTEE_NOT_SCHEDULED");
  const assignedMember = committee.members.find(
    (member) => member.committeeMemberId === profile.id
  );
  if (!assignedMember) throw new Error("UNAUTHORIZED_COMMITTEE_MEMBER");

  try {
    return await prisma.$transaction(async (tx) => {
      const committeeLock = await tx.committee.updateMany({
        where: { id: committee.id, status: "SCHEDULED" },
        data: { status: "SCHEDULED" },
      });
      if (committeeLock.count !== 1) throw new Error("COMMITTEE_INVALID_TRANSITION");

      const evaluation = await tx.evaluation.create({
        data: {
          thesisId: normalizedThesisId,
          committeeMemberId: profile.id,
          grade: numericGrade,
          comments: comments ?? null,
        },
        include: {
          thesis: { select: { id: true, title: true } },
          committeeMember: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
          },
        },
      });

      const evaluations = await tx.evaluation.findMany({
        where: { thesisId: normalizedThesisId },
        select: { id: true },
      });
      if (evaluations.length === committee.members.length) {
        const completed = await tx.committee.updateMany({
          where: { id: committee.id, status: "SCHEDULED" },
          data: { status: "COMPLETED" },
        });
        if (completed.count !== 1) throw new Error("COMMITTEE_INVALID_TRANSITION");
      }
      return { evaluation, committeeStatus: evaluations.length === committee.members.length ? "COMPLETED" : "SCHEDULED" };
    });
  } catch (error) {
    if (error.code === "P2002") throw new Error("EVALUATION_ALREADY_EXISTS");
    throw error;
  }
};

module.exports = {
  assignCommittee,
  getCommittee,
  scheduleDefense,
  createEvaluation,
};
