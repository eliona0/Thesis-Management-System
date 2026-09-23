const path = require("path");
const prisma = require("../config/prisma");

const getStudentThesis = async (studentId) => {
  const thesis = await prisma.thesis.findFirst({
    where: {
      studentId,
    },
    include: {
      mentor: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      versions: {
        orderBy: {
          versionNumber: "desc",
        },
        select: {
          id: true,
          versionNumber: true,
          fileName: true,
          status: true,
          isCurrent: true,
          uploadedAt: true,
        },
      },
    },
  });

  if (!thesis) {
    throw new Error("THESIS_NOT_FOUND");
  }

  return thesis;
};

const updateStudentThesis = async ({
  studentId,
  title,
  description,
  researchField,
}) => {
  const thesis = await prisma.thesis.findFirst({
    where: {
      studentId,
    },
  });

  if (!thesis) {
    throw new Error("THESIS_NOT_FOUND");
  }

  // Student can edit before approval
  // or after rejection in order to resubmit it.
  if (!["PENDING", "REJECTED"].includes(thesis.status)) {
    throw new Error("THESIS_ALREADY_APPROVED");
  }

  const updatedThesis = await prisma.thesis.update({
    where: {
      id: thesis.id,
    },
    data: {
      title,
      description: description || null,
      researchField: researchField || null,
      status: "PENDING",
    },
    include: {
      mentor: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  return updatedThesis;
};

const approveThesis = async ({ mentorUserId, thesisId }) => {
  const thesis = await prisma.thesis.findUnique({
    where: {
      id: thesisId,
    },
  });

  if (!thesis) {
    throw new Error("THESIS_NOT_FOUND");
  }

  // Only the mentor assigned to this thesis can approve it.
  if (thesis.mentorId !== mentorUserId) {
    throw new Error("UNAUTHORIZED_THESIS");
  }

  // Only PENDING theses can be approved.
  if (thesis.status !== "PENDING") {
    throw new Error("THESIS_NOT_PENDING");
  }

  // The mentor should not approve an empty/untitled thesis.
  if (!thesis.title || thesis.title.trim() === "" || thesis.title === "Untitled Thesis") {
    throw new Error("THESIS_TITLE_REQUIRED");
  }

  const approvedThesis = await prisma.thesis.update({
    where: {
      id: thesisId,
    },
    data: {
      status: "APPROVED",
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      mentor: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  return approvedThesis;
};


const rejectThesis = async ({
  mentorUserId,
  thesisId,
  rejectionReason,
}) => {
  const thesis = await prisma.thesis.findUnique({
    where: {
      id: thesisId,
    },
  });

  if (!thesis) {
    throw new Error("THESIS_NOT_FOUND");
  }

  if (thesis.mentorId !== mentorUserId) {
    throw new Error("UNAUTHORIZED_THESIS");
  }

  if (thesis.status !== "PENDING") {
    throw new Error("THESIS_NOT_PENDING");
  }

  const rejectedThesis = await prisma.thesis.update({
    where: {
      id: thesisId,
    },
    data: {
      status: "REJECTED",
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      mentor: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  return {
    ...rejectedThesis,
    rejectionReason: rejectionReason || null,
  };
};

const startThesis = async ({ mentorUserId, thesisId }) => {
  const thesis = await prisma.thesis.findUnique({
    where: {
      id: thesisId,
    },
  });

  if (!thesis) {
    throw new Error("THESIS_NOT_FOUND");
  }

  // Only the assigned mentor can start the thesis.
  if (thesis.mentorId !== mentorUserId) {
    throw new Error("UNAUTHORIZED_THESIS");
  }

  // Only approved theses can be moved to IN_PROGRESS.
  if (thesis.status !== "APPROVED") {
    throw new Error("THESIS_NOT_APPROVED");
  }

  const startedThesis = await prisma.thesis.update({
    where: {
      id: thesisId,
    },
    data: {
      status: "IN_PROGRESS",
      startedAt: new Date(),
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      mentor: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  return startedThesis;
};

const createThesisVersion = async ({
  studentId,
  fileName,
  filePath,
}) => {
  const thesis = await prisma.thesis.findFirst({
    where: { studentId },
  });

  if (!thesis) {
    throw new Error("THESIS_NOT_FOUND");
  }

  if (thesis.status !== "IN_PROGRESS") {
    throw new Error("THESIS_NOT_IN_PROGRESS");
  }

  // Check if there is already a draft or submitted version.
  // Student must finish the current version before creating another one.
  const activeVersion = await prisma.thesisVersion.findFirst({
    where: {
      thesisId: thesis.id,
      status: {
        in: ["DRAFT", "SUBMITTED"],
      },
    },
  });

  if (activeVersion) {
    throw new Error("ACTIVE_VERSION_EXISTS");
  }

  const lastVersion = await prisma.thesisVersion.findFirst({
    where: { thesisId: thesis.id },
    orderBy: { versionNumber: "desc" },
  });

  const nextVersionNumber = lastVersion
    ? lastVersion.versionNumber + 1
    : 1;

  const storedFileName = path.basename(filePath);

  const newFileName = `thesis-student-${studentId}-version-${nextVersionNumber}-${Date.now()}.pdf`;

  const oldFilePath = filePath;

  const newFilePath = path.join(
    path.dirname(oldFilePath),
    newFileName
  );

  const fs = require("fs");

  fs.renameSync(oldFilePath, newFilePath);

  const relativeFilePath = `/uploads/theses/${newFileName}`;

  await prisma.thesisVersion.updateMany({
    where: {
      thesisId: thesis.id,
      isCurrent: true,
    },
    data: {
      isCurrent: false,
    },
  });

  const version = await prisma.thesisVersion.create({
    data: {
      thesisId: thesis.id,
      versionNumber: nextVersionNumber,
      fileName,
      filePath: relativeFilePath,
      uploadedBy: studentId,
      status: "DRAFT",
      isCurrent: true,
    },
  });

  return version;
};

const deleteThesisVersion = async ({
  studentId,
  versionId,
}) => {
  const thesis = await prisma.thesis.findFirst({
    where: { studentId },
  });

  if (!thesis) {
    throw new Error("THESIS_NOT_FOUND");
  }

  const version = await prisma.thesisVersion.findUnique({
    where: { id: versionId },
  });

  if (!version) {
    throw new Error("VERSION_NOT_FOUND");
  }

  if (version.thesisId !== thesis.id) {
    throw new Error("UNAUTHORIZED_VERSION");
  }

  if (version.status !== "DRAFT") {
    throw new Error("VERSION_CANNOT_BE_DELETED");
  }

  const fs = require("fs");

  const uploadsDirectory = path.join(
    __dirname,
    "../../uploads/theses"
  );

  const physicalFilePath = path.join(
    uploadsDirectory,
    path.basename(version.filePath)
  );

  // Fshij file-in fizik
  if (fs.existsSync(physicalFilePath)) {
    fs.unlinkSync(physicalFilePath);
  }

  // Rregullo isCurrent pas fshirjes
  const result = await prisma.$transaction(async (tx) => {
    // 1. Fshije versionin
    await tx.thesisVersion.delete({
      where: { id: versionId },
    });

    // 2. Hiqe isCurrent nga çdo version tjetër
    await tx.thesisVersion.updateMany({
      where: {
        thesisId: thesis.id,
        isCurrent: true,
      },
      data: {
        isCurrent: false,
      },
    });

    // 3. Gjeje versionin e fundit që ka mbetur
    const previousVersion = await tx.thesisVersion.findFirst({
      where: {
        thesisId: thesis.id,
      },
      orderBy: {
        versionNumber: "desc",
      },
    });

    // 4. Bëje atë version current
    if (previousVersion) {
      await tx.thesisVersion.update({
        where: {
          id: previousVersion.id,
        },
        data: {
          isCurrent: true,
        },
      });
    }

    return {
      id: versionId,
      message: "Draft version deleted successfully",
    };
  });

  return result;
};

const getStudentThesisVersions = async (studentId) => {
  const thesis = await prisma.thesis.findFirst({
    where: {
      studentId,
    },
  });

  if (!thesis) {
    throw new Error("THESIS_NOT_FOUND");
  }

const versions = await prisma.thesisVersion.findMany({
  where: {
    thesisId: thesis.id,
  },
  orderBy: {
    versionNumber: "desc",
  },
  select: {
    id: true,
    versionNumber: true,
    fileName: true,
    filePath: true,
    status: true,
    isCurrent: true,
    uploadedAt: true,
  },
});

  return versions;
};

const getMentorThesisVersions = async (mentorUserId, thesisId) => {
  const mentorProfile = await prisma.mentorProfile.findUnique({
    where: {
      userId: mentorUserId,
    },
  });

  if (!mentorProfile) {
    throw new Error("MENTOR_PROFILE_NOT_FOUND");
  }

  const thesis = await prisma.thesis.findUnique({
    where: {
      id: thesisId,
    },
  });

  if (!thesis) {
    throw new Error("THESIS_NOT_FOUND");
  }

if (thesis.mentorId !== mentorUserId) {
  throw new Error("UNAUTHORIZED_THESIS");
}

  const versions = await prisma.thesisVersion.findMany({
    where: {
      thesisId: thesis.id,
    },
    orderBy: {
      versionNumber: "desc",
    },
    select: {
      id: true,
      versionNumber: true,
      fileName: true,
      filePath: true,
      status: true,
      isCurrent: true,
      uploadedAt: true,
      uploader: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  return versions;
};

const submitThesisVersion = async ({
  studentId,
  versionId,
}) => {
  const thesis = await prisma.thesis.findFirst({
    where: { studentId },
  });

  if (!thesis) {
    throw new Error("THESIS_NOT_FOUND");
  }

  if (thesis.status !== "IN_PROGRESS") {
    throw new Error("THESIS_NOT_IN_PROGRESS");
  }

  const version = await prisma.thesisVersion.findUnique({
    where: { id: versionId },
  });

  if (!version) {
    throw new Error("VERSION_NOT_FOUND");
  }

  if (version.thesisId !== thesis.id) {
    throw new Error("UNAUTHORIZED_VERSION");
  }

  if (version.status !== "DRAFT") {
    throw new Error("VERSION_NOT_DRAFT");
  }

  const submittedVersion = await prisma.thesisVersion.update({
    where: { id: versionId },
    data: {
      status: "SUBMITTED",
    },
  });

  return submittedVersion;
};


const approveFinalThesisVersion = async ({
  mentorUserId,
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

  // Kontrollo që ky mentor është mentori i kësaj teme
  if (version.thesis.mentorId !== mentorUserId) {
    throw new Error("UNAUTHORIZED_VERSION");
  }

  // Thesis duhet të jetë ende në proces
  if (version.thesis.status !== "IN_PROGRESS") {
    throw new Error("THESIS_NOT_IN_PROGRESS");
  }

  // Vetëm versioni REVIEWED mund të aprovohet finalisht
  if (version.status !== "REVIEWED") {
    throw new Error("VERSION_NOT_REVIEWED");
  }

  // Kontrollo nëse tema e ka startedAt
  if (!version.thesis.startedAt) {
    throw new Error("THESIS_START_DATE_NOT_FOUND");
  }

  // Minimumi 3 muaj nga fillimi zyrtar i temës
  const earliestFinalSubmissionDate = new Date(
    version.thesis.startedAt
  );

  earliestFinalSubmissionDate.setMonth(
    earliestFinalSubmissionDate.getMonth() + 3
  );

  // Nëse 3 muajt nuk kanë kaluar ende
  if (new Date() < earliestFinalSubmissionDate) {
    const error = new Error("MINIMUM_DURATION_NOT_COMPLETED");

    error.earliestFinalSubmissionDate =
      earliestFinalSubmissionDate;

    throw error;
  }

  const result = await prisma.$transaction(async (tx) => {
    // Versioni bëhet final
    const approvedVersion = await tx.thesisVersion.update({
      where: {
        id: versionId,
      },
      data: {
        status: "APPROVED",
        isCurrent: true,
      },
    });

    // Thesis kalon në fazën e dorëzimit final
    const updatedThesis = await tx.thesis.update({
      where: {
        id: version.thesisId,
      },
      data: {
        status: "SUBMITTED",
      },
    });

    return {
      version: approvedVersion,
      thesis: updatedThesis,
    };
  });

  return result;
};

const getFinalApprovalStatus = async ({
  mentorUserId,
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

  if (version.thesis.mentorId !== mentorUserId) {
    throw new Error("UNAUTHORIZED_VERSION");
  }

  if (!version.thesis.startedAt) {
    throw new Error("THESIS_START_DATE_NOT_FOUND");
  }

  const earliestFinalSubmissionDate = new Date(
    version.thesis.startedAt
  );

  earliestFinalSubmissionDate.setMonth(
    earliestFinalSubmissionDate.getMonth() + 3
  );

  const now = new Date();

  const durationCompleted =
    now >= earliestFinalSubmissionDate;

  return {
    available:
      version.status === "REVIEWED" &&
      version.thesis.status === "IN_PROGRESS" &&
      durationCompleted,

    versionStatus: version.status,

    thesisStatus: version.thesis.status,

    startedAt: version.thesis.startedAt,

    earliestFinalSubmissionDate,

    durationCompleted,
  };
};

module.exports = {
  getStudentThesis,
  updateStudentThesis,
  approveThesis,
  rejectThesis,
  startThesis,
  createThesisVersion,  
  getStudentThesisVersions,
  getMentorThesisVersions,
  submitThesisVersion,
  deleteThesisVersion,
  approveFinalThesisVersion,
  getFinalApprovalStatus,
};