require("dotenv").config();

const bcrypt = require("bcrypt");

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log("Starting database seed...");

  // =====================================================
  // ROLES
  // =====================================================

  const roles = [
    {
      name: "ADMIN",
      description: "System administrator",
    },
    {
      name: "STUDENT",
      description: "University student",
    },
    {
      name: "MENTOR",
      description: "Thesis mentor",
    },
    {
      name: "COMMITTEE_MEMBER",
      description: "Thesis committee member",
    },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: {
        name: role.name,
      },
      update: {
        description: role.description,
      },
      create: role,
    });
  }

  console.log("Roles seeded successfully.");

  // =====================================================
  // UBT STUDY PROGRAMS
  // Academic Year 2026/2027
  // =====================================================

  const studyPrograms = [
    // ===================================================
    // BACHELOR PROGRAMS
    // ===================================================

    {
      name: "Management, Business and Economics",
      department: "Management, Business and Economics",
      degreeLevel: "Bachelor",
    },
    {
      name: "FinTech and Business Analytics",
      department: "Management, Business and Economics",
      degreeLevel: "Bachelor",
    },
    {
      name: "Computer Science and Engineering",
      department: "Computer Science and Engineering",
      degreeLevel: "Bachelor",
    },
    {
      name: "Mechatronics Engineering",
      department: "Mechatronics Engineering",
      degreeLevel: "Bachelor",
    },
    {
      name: "Mechanical Engineering",
      department: "Mechanical Engineering",
      degreeLevel: "Bachelor",
    },
    {
      name: "Information Systems",
      department: "Information Systems",
      degreeLevel: "Bachelor",
    },
    {
      name: "Architecture and Spatial Planning",
      department: "Architecture and Spatial Planning",
      degreeLevel: "Bachelor",
    },
    {
      name: "Architecture and Spatial Planning (Prizren)",
      department: "Architecture and Spatial Planning",
      degreeLevel: "Bachelor",
    },
    {
      name: "Architecture and Spatial Planning (Ferizaj)",
      department: "Architecture and Spatial Planning",
      degreeLevel: "Bachelor",
    },
    {
      name: "Civil Engineering and Infrastructure",
      department: "Civil Engineering and Infrastructure",
      degreeLevel: "Bachelor",
    },
    {
      name: "Energy Engineering",
      department: "Energy Engineering",
      degreeLevel: "Bachelor",
    },
    {
      name: "Environmental Engineering and Sustainable Infrastructure",
      department: "Environmental Engineering and Sustainable Infrastructure",
      degreeLevel: "Bachelor",
    },
    {
      name: "Law",
      department: "Law",
      degreeLevel: "Bachelor",
    },
    {
      name: "Law (Prizren)",
      department: "Law",
      degreeLevel: "Bachelor",
    },
    {
      name: "Media and Communication",
      department: "Media and Communication",
      degreeLevel: "Bachelor",
    },
    {
      name: "English Language",
      department: "English Language",
      degreeLevel: "Bachelor",
    },
    {
      name: "Psychology",
      department: "Psychology",
      degreeLevel: "Bachelor",
    },
    {
      name: "Political Science",
      department: "Political Science",
      degreeLevel: "Bachelor",
    },
    {
      name: "Security Studies",
      department: "Security Studies",
      degreeLevel: "Bachelor",
    },
    {
      name: "Food Science and Biotechnology",
      department: "Food Science and Biotechnology",
      degreeLevel: "Bachelor",
    },
    {
      name: "Food Science and Biotechnology (Prizren)",
      department: "Food Science and Biotechnology",
      degreeLevel: "Bachelor",
    },
    {
      name: "Medical Biochemistry",
      department: "Medical Biochemistry",
      degreeLevel: "Bachelor",
    },
    {
      name: "Pharmacy",
      department: "Pharmacy",
      degreeLevel: "Bachelor",
    },
    {
      name: "Dentistry",
      department: "Dentistry",
      degreeLevel: "Bachelor",
    },
    {
      name: "Dental Technician",
      department: "Dental Technology",
      degreeLevel: "Bachelor",
    },
    {
      name: "Radiology Technician",
      department: "Radiology",
      degreeLevel: "Bachelor",
    },
    {
      name: "Applied Chemistry",
      department: "Applied Chemistry",
      degreeLevel: "Bachelor",
    },
    {
      name: "Public Health and Medical Sciences",
      department: "Public Health and Medical Sciences",
      degreeLevel: "Bachelor",
    },
    {
      name: "Aesthetics and Cosmetology",
      department: "Aesthetics and Cosmetology",
      degreeLevel: "Bachelor",
    },
    {
      name: "Agriculture and Environmental Engineering",
      department: "Agriculture and Environmental Engineering",
      degreeLevel: "Bachelor",
    },
    {
      name: "Modern Music, Digital Production and Management",
      department: "Arts and Design",
      degreeLevel: "Bachelor",
    },
    {
      name: "Sport Science and Movement",
      department: "Sport Science and Movement",
      degreeLevel: "Bachelor",
    },
    {
      name: "Art and Digital Media",
      department: "Arts and Design",
      degreeLevel: "Bachelor",
    },
    {
      name: "Tourism",
      department: "Management, Business and Economics",
      degreeLevel: "Bachelor",
    },
    {
      name: "Management of Real Estate and Infrastructure",
      department: "Management, Business and Economics",
      degreeLevel: "Bachelor",
    },

    // ===================================================
    // PROFESSIONAL BACHELOR PROGRAMS
    // ===================================================

    {
      name: "Bachelor Professional Design",
      department: "Arts and Design",
      degreeLevel: "Professional Bachelor",
    },
    {
      name: "Bachelor Professional Design (Prizren)",
      department: "Arts and Design",
      degreeLevel: "Professional Bachelor",
    },
    {
      name: "Fashion Design",
      department: "Arts and Design",
      degreeLevel: "Professional Bachelor",
    },
    {
      name: "Dramatic Arts",
      department: "Arts and Design",
      degreeLevel: "Professional Bachelor",
    },

    // ===================================================
    // MASTER PROGRAMS
    // ===================================================

    {
      name: "Management, Business and Economy",
      department: "Management, Business and Economics",
      degreeLevel: "Master",
    },
    {
      name: "FinTech and Innovation Management",
      department: "Management, Business and Economics",
      degreeLevel: "Master",
    },
    {
      name: "Computer Science and Engineering",
      department: "Computer Science and Engineering",
      degreeLevel: "Master",
    },
    {
      name: "Civil Engineering and Infrastructure",
      department: "Civil Engineering and Infrastructure",
      degreeLevel: "Master",
    },
    {
      name: "Traffic and Transport Engineering",
      department: "Traffic and Transport Engineering",
      degreeLevel: "Master",
    },
    {
      name: "Information Systems and Management",
      department: "Information Systems and Management",
      degreeLevel: "Master",
    },
    {
      name: "Mechatronics Engineering",
      department: "Mechatronics Engineering",
      degreeLevel: "Master",
    },
    {
      name: "Architecture and Spatial Planning",
      department: "Architecture and Spatial Planning",
      degreeLevel: "Master",
    },
    {
      name: "Energy and Environment Engineering",
      department: "Energy Engineering and Environment",
      degreeLevel: "Master",
    },
    {
      name: "Criminal Law",
      department: "Law",
      degreeLevel: "Master",
    },
    {
      name: "Civil and Property Law",
      department: "Law",
      degreeLevel: "Master",
    },
  ];

  // =====================================================
  // INSERT / UPDATE STUDY PROGRAMS
  // =====================================================

  for (const program of studyPrograms) {
    const existingProgram = await prisma.studyProgram.findFirst({
      where: {
        name: program.name,
        degreeLevel: program.degreeLevel,
      },
    });

    if (existingProgram) {
      await prisma.studyProgram.update({
        where: {
          id: existingProgram.id,
        },
        data: {
          department: program.department,
          status: "ACTIVE",
        },
      });
    } else {
      await prisma.studyProgram.create({
        data: {
          name: program.name,
          department: program.department,
          degreeLevel: program.degreeLevel,
          status: "ACTIVE",
        },
      });
    }
  }

  console.log("Study programs seeded successfully.");

  // =====================================================
  // HISTORICAL PROGRAMS
  // =====================================================

  const historicalPrograms = [
    {
      name: "Integrated Design",
      department: "Arts and Design",
      degreeLevel: "Bachelor",
    },
    {
      name: "Energy Engineering and Management",
      department: "Energy Engineering",
      degreeLevel: "Bachelor",
    },
    {
      name: "Agriculture Engineering and Environments",
      department: "Agriculture and Environmental Engineering",
      degreeLevel: "Bachelor",
    },
  ];

  for (const program of historicalPrograms) {
    const existingProgram = await prisma.studyProgram.findFirst({
      where: {
        name: program.name,
        degreeLevel: program.degreeLevel,
      },
    });

    if (existingProgram) {
      await prisma.studyProgram.update({
        where: {
          id: existingProgram.id,
        },
        data: {
          department: program.department,
          status: "INACTIVE",
        },
      });
    } else {
      await prisma.studyProgram.create({
        data: {
          name: program.name,
          department: program.department,
          degreeLevel: program.degreeLevel,
          status: "INACTIVE",
        },
      });
    }
  }

  console.log("Historical programs seeded successfully.");

    // =====================================================
  // TEST MENTOR
  // =====================================================

  const mentorRole = await prisma.role.findUnique({
    where: {
      name: "MENTOR",
    },
  });

  const mentorStudyProgram = await prisma.studyProgram.findFirst({
    where: {
      name: "Computer Science and Engineering",
      degreeLevel: "Bachelor",
    },
  });

  if (!mentorRole) {
    throw new Error("MENTOR role not found.");
  }

  if (!mentorStudyProgram) {
    throw new Error("Computer Science and Engineering study program not found.");
  }

  const mentorPasswordHash = await bcrypt.hash("Mentor1234!", 10);

  const mentorUser = await prisma.user.upsert({
    where: {
      email: "test.mentor@example.com",
    },
    update: {
      roleId: mentorRole.id,
      studyProgramId: mentorStudyProgram.id,
      firstName: "Test",
      lastName: "Mentor",
      isActive: true,
    },
    create: {
      roleId: mentorRole.id,
      studyProgramId: mentorStudyProgram.id,
      firstName: "Test",
      lastName: "Mentor",
      email: "test.mentor@example.com",
      passwordHash: mentorPasswordHash,
      mentorProfile: {
        create: {
          academicTitle: "Prof. Ass.",
          specialization: "Software Engineering",
          department: "Computer Science and Engineering",
          isAvailable: true,
        },
      },
    },
  });

  await prisma.mentorProfile.upsert({
    where: {
      userId: mentorUser.id,
    },
    update: {
      academicTitle: "Prof. Ass.",
      specialization: "Software Engineering",
      department: "Computer Science and Engineering",
      isAvailable: true,
    },
    create: {
      userId: mentorUser.id,
      academicTitle: "Prof. Ass.",
      specialization: "Software Engineering",
      department: "Computer Science and Engineering",
      isAvailable: true,
    },
  });

  console.log("Test mentor seeded successfully.");

    // =====================================================
  // TEST ADMIN
  // =====================================================

  const adminRole = await prisma.role.findUnique({
    where: {
      name: "ADMIN",
    },
  });

  if (!adminRole) {
    throw new Error("ADMIN role not found.");
  }

  const adminPasswordHash = await bcrypt.hash("Admin1234!", 10);

  await prisma.user.upsert({
    where: {
      email: "test.admin@example.com",
    },
    update: {
      roleId: adminRole.id,
      firstName: "Test",
      lastName: "Admin",
      isActive: true,
    },
    create: {
      roleId: adminRole.id,
      firstName: "Test",
      lastName: "Admin",
      email: "test.admin@example.com",
      passwordHash: adminPasswordHash,
    },
  });

  console.log("Test admin seeded successfully.");


  // =====================================================
  // TEST COMMITTEE MEMBERS
  // =====================================================

  const committeeRole = await prisma.role.findUnique({
    where: {
      name: "COMMITTEE_MEMBER",
    },
  });

  if (!committeeRole) {
    throw new Error("COMMITTEE_MEMBER role not found.");
  }

  const committeeMembers = [
    {
      email: "test.chair@example.com",
      firstName: "Test",
      lastName: "Chair",
      academicTitle: "Prof. Dr.",
      specialization: "Software Engineering",
      department: "Computer Science and Engineering",
    },
    {
      email: "test.member1@example.com",
      firstName: "Test",
      lastName: "Member One",
      academicTitle: "Prof. Ass.",
      specialization: "Artificial Intelligence",
      department: "Computer Science and Engineering",
    },
    {
      email: "test.member2@example.com",
      firstName: "Test",
      lastName: "Member Two",
      academicTitle: "Prof. Ass.",
      specialization: "Computer Networks",
      department: "Computer Science and Engineering",
    },
  ];

  const committeePasswordHash = await bcrypt.hash(
    "Committee1234!",
    10
  );

  for (const member of committeeMembers) {
    const user = await prisma.user.upsert({
      where: {
        email: member.email,
      },
      update: {
        roleId: committeeRole.id,
        firstName: member.firstName,
        lastName: member.lastName,
        isActive: true,
      },
      create: {
        roleId: committeeRole.id,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        passwordHash: committeePasswordHash,
      },
    });

    await prisma.committeeMemberProfile.upsert({
      where: {
        userId: user.id,
      },
      update: {
        academicTitle: member.academicTitle,
        specialization: member.specialization,
        department: member.department,
      },
      create: {
        userId: user.id,
        academicTitle: member.academicTitle,
        specialization: member.specialization,
        department: member.department,
      },
    });
  }

  console.log("Test committee members seeded successfully.");

  console.log("Database seed completed successfully.");
}

main()
  .catch((error) => {
    console.error("Database seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });