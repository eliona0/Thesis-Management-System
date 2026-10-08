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
      thesis: {
        select: {
          id: true, title: true, description: true, researchField: true, status: true,
          student: { select: { id: true, firstName: true, lastName: true, email: true } },
          evaluations: {
            include: { committeeMember: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } } },
          },
        },
      },
      members: {
        orderBy: { role: "asc" },
        include: memberInclude,
      },
    },
  });
  if (!committee) throw new Error("COMMITTEE_NOT_FOUND");
  return committee;
};

const getEligibleTheses = async () => prisma.thesis.findMany({
  where: { status: "SUBMITTED", committee: { is: null } },
  orderBy: { updatedAt: "desc" },
  select: {
    id: true, title: true, description: true, researchField: true, status: true, updatedAt: true,
    student: { select: { id: true, firstName: true, lastName: true, email: true } },
  },
});

const getAdminCommittees = async () => prisma.committee.findMany({
  orderBy: { assignedDate: "desc" },
  include: {
    thesis: {
      select: {
        id: true, title: true, description: true, researchField: true, status: true,
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
        evaluations: {
          include: { committeeMember: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } } },
        },
      },
    },
    members: { orderBy: { role: "asc" }, include: memberInclude },
  },
});

const getCommitteeMembers = async () => {
  const profiles = await prisma.committeeMemberProfile.findMany({
    where: { user: { isActive: true, role: { name: "COMMITTEE_MEMBER" } } },
    select: {
      id: true, userId: true,
      user: { select: { firstName: true, lastName: true, email: true } },
    },
    orderBy: { user: { firstName: "asc" } },
  });
  return profiles.map((profile) => ({
    id: profile.id,
    userId: profile.userId,
    firstName: profile.user.firstName,
    lastName: profile.user.lastName,
    email: profile.user.email,
  }));
};

const getMyCommittees = async (userId) => {
  const profile = await prisma.committeeMemberProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) return [];

  const memberships = await prisma.committeeMember.findMany({
    where: { committeeMemberId: profile.id },
    orderBy: { committee: { assignedDate: "desc" } },
    select: {
      id: true,
      role: true,
      committee: {
        select: {
          id: true, status: true, defenseDate: true, finalGrade: true,
          thesis: {
            select: {
              id: true, title: true, description: true, researchField: true, status: true,
              student: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
          },
        },
      },
    },
  });
  const evaluations = await prisma.evaluation.findMany({
    where: { committeeMemberId: profile.id },
    select: { id: true, thesisId: true, grade: true, comments: true, evaluationDate: true },
  });
  const evaluationByThesis = new Map(evaluations.map((evaluation) => [evaluation.thesisId, evaluation]));
  const evaluationCounts = await prisma.evaluation.findMany({
    where: { thesisId: { in: memberships.map(({ committee }) => committee.thesis.id) } },
    select: { thesisId: true },
  });
  const countByThesis = new Map();
  for (const evaluation of evaluationCounts) countByThesis.set(evaluation.thesisId, (countByThesis.get(evaluation.thesisId) || 0) + 1);
  return Promise.all(memberships.map(async ({ committee, ...membership }) => {
    const evaluationCount = countByThesis.get(committee.thesis.id) || 0;
    const result = {
      committee: { id: committee.id, status: committee.status, defenseDate: committee.defenseDate, finalGrade: committee.finalGrade },
      thesis: committee.thesis,
      member: { id: profile.id, role: membership.role },
      evaluation: evaluationByThesis.get(committee.thesis.id) || null,
      evaluationCount,
    };
    if (membership.role === "CHAIR" && committee.status === "SCHEDULED" && evaluationCount === 3) {
      const committeeEvaluations = await prisma.evaluation.findMany({
        where: { thesisId: committee.thesis.id },
        include: { committeeMember: { include: { user: { select: { id: true, firstName: true, lastName: true } } } } },
      });
      const grades = committeeEvaluations.map((evaluation) => Number(evaluation.grade));
      result.committeeEvaluations = committeeEvaluations;
      result.gradesAgree = grades.length === 3 && grades.every((grade) => grade === grades[0]);
      result.agreedGrade = result.gradesAgree ? grades[0] : null;
    }
    return result;
  }));
};

const getMyDashboard = async (userId) => {
  const profile = await prisma.committeeMemberProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) return [];
  const memberships = await prisma.committeeMember.findMany({
    where: { committeeMemberId: profile.id },
    orderBy: { committee: { assignedDate: "desc" } },
    select: {
      id: true, role: true,
      committee: { select: {
        id: true, status: true, defenseDate: true,
        thesis: { select: { id: true, title: true, status: true, student: { select: { firstName: true, lastName: true } } } },
        members: { select: { role: true, member: { select: { user: { select: { firstName: true, lastName: true } } } } } },
      } },
    },
  });
  const thesisIds = memberships.map(({ committee }) => committee.thesis.id);
  if (!thesisIds.length) return [];
  const [ownEvaluations, counts] = await Promise.all([
    prisma.evaluation.findMany({ where: { committeeMemberId: profile.id, thesisId: { in: thesisIds } }, select: { thesisId: true } }),
    prisma.evaluation.findMany({ where: { thesisId: { in: thesisIds } }, select: { thesisId: true } }),
  ]);
  const own = new Set(ownEvaluations.map(({ thesisId }) => thesisId));
  const countByThesis = new Map();
  for (const { thesisId } of counts) countByThesis.set(thesisId, (countByThesis.get(thesisId) || 0) + 1);
  return memberships.map(({ committee, role }) => ({
    committee: { id: committee.id, status: committee.status, defenseDate: committee.defenseDate },
    thesis: committee.thesis,
    role,
    members: committee.members.map(({ role: memberRole, member }) => ({ role: memberRole, name: [member.user.firstName, member.user.lastName].filter(Boolean).join(" ") })),
    evaluationCount: countByThesis.get(committee.thesis.id) || 0,
    evaluationSubmitted: own.has(committee.thesis.id),
  }));
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
      !Number.isFinite(numericGrade) || numericGrade < 6 || numericGrade > 10 ||
      Math.abs(numericGrade * 100 - Math.round(numericGrade * 100)) > 1e-8) {
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
  if (!committee.defenseDate || new Date(committee.defenseDate) > new Date()) {
    throw new Error("DEFENSE_DATE_NOT_REACHED");
  }
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

      const assignedMemberIds = committee.members.map((member) => member.committeeMemberId);
      const evaluations = await tx.evaluation.findMany({
        where: { thesisId: normalizedThesisId, committeeMemberId: { in: assignedMemberIds } },
        select: { id: true },
      });
      return { evaluation, evaluationCount: evaluations.length, committeeStatus: "SCHEDULED" };
    });
  } catch (error) {
    if (error.code === "P2002") throw new Error("EVALUATION_ALREADY_EXISTS");
    throw error;
  }
};

const confirmFinalDecision = async ({ committeeMemberUserId, thesisId, finalGrade }) => {
  const normalizedThesisId = Number(thesisId);
  const grade = Number(finalGrade);
  if (!Number.isSafeInteger(normalizedThesisId) || normalizedThesisId <= 0) throw new Error("INVALID_THESIS_ID");
  if (finalGrade === undefined || finalGrade === null || finalGrade === "" || !Number.isFinite(grade) || grade < 6 || grade > 10 || Math.abs(grade * 100 - Math.round(grade * 100)) > 1e-8) throw new Error("INVALID_GRADE");

  const profile = await prisma.committeeMemberProfile.findUnique({ where: { userId: committeeMemberUserId }, select: { id: true } });
  if (!profile) throw new Error("COMMITTEE_MEMBER_NOT_FOUND");
  const committee = await prisma.committee.findUnique({ where: { thesisId: normalizedThesisId }, include: { members: true } });
  if (!committee) throw new Error("COMMITTEE_NOT_FOUND");
  if (committee.status !== "SCHEDULED") throw new Error("COMMITTEE_NOT_SCHEDULED");
  const chair = committee.members.filter((member) => member.role === "CHAIR");
  if (chair.length !== 1 || chair[0].committeeMemberId !== profile.id) throw new Error("UNAUTHORIZED_COMMITTEE_CHAIR");
  const evaluations = await prisma.evaluation.findMany({ where: { thesisId: normalizedThesisId, committeeMemberId: { in: committee.members.map((member) => member.committeeMemberId) } }, select: { grade: true } });
  if (committee.members.length !== 3 || evaluations.length !== 3) throw new Error("EVALUATIONS_INCOMPLETE");
  const grades = evaluations.map((evaluation) => Number(evaluation.grade));
  const agreed = grades.every((candidate) => candidate === grades[0]);
  if (agreed && grade !== grades[0]) throw new Error("AGREED_GRADE_MISMATCH");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.committee.updateMany({ where: { id: committee.id, status: "SCHEDULED", finalGrade: null }, data: { status: "COMPLETED", finalGrade: grade } });
    if (updated.count !== 1) throw new Error("COMMITTEE_INVALID_TRANSITION");
    const thesis = await tx.thesis.updateMany({ where: { id: normalizedThesisId, status: "SUBMITTED" }, data: { status: "COMPLETED" } });
    if (thesis.count !== 1) throw new Error("THESIS_INVALID_TRANSITION");
    return { finalGrade: grade, committeeStatus: "COMPLETED", thesisStatus: "COMPLETED" };
  });
};

module.exports = {
  assignCommittee,
  getCommittee,
  getEligibleTheses,
  getAdminCommittees,
  getCommitteeMembers,
  getMyCommittees,
  getMyDashboard,
  scheduleDefense,
  createEvaluation,
  confirmFinalDecision,
};
