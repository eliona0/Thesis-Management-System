const prisma = require("../config/prisma");

const getUsers = () => prisma.user.findMany({
  select: {
    id: true, firstName: true, lastName: true, email: true, isActive: true, createdAt: true,
    role: { select: { name: true } },
    studyProgram: { select: { name: true } },
    studentProfile: { select: { studentNumber: true, studyYear: true, verificationStatus: true } },
    mentorProfile: { select: { academicTitle: true, department: true, isAvailable: true } },
    committeeMemberProfile: { select: { academicTitle: true, department: true } },
  },
  orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
});

const getStudyPrograms = () => prisma.studyProgram.findMany({
  select: {
    id: true, name: true, department: true, degreeLevel: true, status: true, createdAt: true,
    _count: { select: { users: true } },
  },
  orderBy: { name: "asc" },
});

const getDashboard = async () => {
  const [users, programCount, theses, upcomingDefenseCount, upcomingDefenses] = await Promise.all([
    prisma.user.findMany({ select: { role: { select: { name: true } } } }),
    prisma.studyProgram.count(),
    prisma.thesis.findMany({ select: { status: true } }),
    prisma.committee.count({ where: { status: "SCHEDULED", defenseDate: { gte: new Date() } } }),
    prisma.committee.findMany({
      where: { status: "SCHEDULED", defenseDate: { gte: new Date() } },
      orderBy: { defenseDate: "asc" }, take: 5,
      select: { id: true, status: true, defenseDate: true, thesis: { select: { title: true, student: { select: { firstName: true, lastName: true } } } } },
    }),
  ]);
  const usersByRole = {};
  for (const { role } of users) usersByRole[role.name] = (usersByRole[role.name] || 0) + 1;
  const thesisCounts = {};
  for (const { status } of theses) thesisCounts[status] = (thesisCounts[status] || 0) + 1;
  return {
    totalUsers: users.length,
    students: usersByRole.STUDENT || 0,
    mentors: usersByRole.MENTOR || 0,
    committeeMembers: usersByRole.COMMITTEE_MEMBER || 0,
    admins: usersByRole.ADMIN || 0,
    studyPrograms: programCount,
    activeTheses: (thesisCounts.APPROVED || 0) + (thesisCounts.IN_PROGRESS || 0),
    completedTheses: thesisCounts.COMPLETED || 0,
    upcomingDefenseCount,
    upcomingDefenses,
  };
};

const createStudyProgram = (data) => prisma.studyProgram.create({ data });

const updateStudyProgram = async (id, data) => {
  const program = await prisma.studyProgram.findUnique({ where: { id } });
  if (!program) return null;
  return prisma.studyProgram.update({ where: { id }, data });
};

const updateUserStatus = async (id, isActive) => {
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) return null;
  return prisma.user.update({ where: { id }, data: { isActive }, select: { id: true, isActive: true } });
};

module.exports = { getUsers, getStudyPrograms, getDashboard, createStudyProgram, updateStudyProgram, updateUserStatus };
