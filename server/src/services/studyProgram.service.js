const prisma = require("../config/prisma");

const getActiveStudyPrograms = () => prisma.studyProgram.findMany({
  where: { status: "ACTIVE" },
  select: { id: true, name: true },
  orderBy: { name: "asc" },
});

module.exports = { getActiveStudyPrograms };
