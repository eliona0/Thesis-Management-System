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

  const update = await prisma.thesis.updateMany({
    where: { id: thesis.id, status: { in: ["PENDING", "REJECTED"] } },
    data: {
      title,
      description: description || null,
      researchField: researchField || null,
      status: "PENDING",
    },
  });
  if (update.count !== 1) throw new Error("THESIS_ALREADY_APPROVED");
  const updatedThesis = await prisma.thesis.findUnique({
    where: { id: thesis.id },
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

  // Vetëm mentori i caktuar mund ta aprovojë temën
  if (thesis.mentorId !== mentorUserId) {
    throw new Error("UNAUTHORIZED_THESIS");
  }

  // Vetëm temat PENDING mund të aprovohen
  if (thesis.status !== "PENDING") {
    throw new Error("THESIS_NOT_PENDING");
  }

  // Titulli duhet të jetë plotësuar
  if (
    !thesis.title ||
    thesis.title.trim() === "" ||
    thesis.title === "Untitled Thesis"
  ) {
    throw new Error("THESIS_TITLE_REQUIRED");
  }

  // Me aprovimin e titullit, tema fillon zyrtarisht
  const result = await prisma.thesis.updateMany({
    where: { id: thesisId, mentorId: mentorUserId, status: "PENDING" },
    data: { status: "IN_PROGRESS", startedAt: new Date() },
  });
  if (result.count !== 1) throw new Error("THESIS_NOT_PENDING");
  const startedThesis = await prisma.thesis.findUnique({
    where: { id: thesisId },
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

  const result = await prisma.thesis.updateMany({
    where: { id: thesisId, mentorId: mentorUserId, status: "PENDING" },
    data: { status: "REJECTED" },
  });
  if (result.count !== 1) throw new Error("THESIS_NOT_PENDING");
  const rejectedThesis = await prisma.thesis.findUnique({
    where: { id: thesisId },
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

  const fs = require("fs");
  const fileDescriptor = fs.openSync(filePath, "r");
  const fileSignature = Buffer.alloc(5);
  const signatureBytesRead = fs.readSync(fileDescriptor, fileSignature, 0, 5, 0);
  fs.closeSync(fileDescriptor);
  if (signatureBytesRead !== 5 || fileSignature.toString("ascii") !== "%PDF-") {
    throw new Error("ONLY_PDF_FILES_ALLOWED");
  }

  let movedFilePath;
  try {
    return await prisma.$transaction(async (tx) => {
      const thesisLock = await tx.thesis.updateMany({
        where: { id: thesis.id, status: "IN_PROGRESS" },
        data: { status: "IN_PROGRESS" },
      });
      if (thesisLock.count !== 1) throw new Error("THESIS_NOT_IN_PROGRESS");

      const activeVersion = await tx.thesisVersion.findFirst({
        where: { thesisId: thesis.id, status: { in: ["DRAFT", "SUBMITTED"] } },
      });
      if (activeVersion) throw new Error("ACTIVE_VERSION_EXISTS");

      const lastVersion = await tx.thesisVersion.findFirst({
        where: { thesisId: thesis.id },
        orderBy: { versionNumber: "desc" },
      });
      const nextVersionNumber = lastVersion ? lastVersion.versionNumber + 1 : 1;
      const newFileName = `thesis-student-${studentId}-version-${nextVersionNumber}-${Date.now()}.pdf`;
      movedFilePath = path.join(path.dirname(filePath), newFileName);
      fs.renameSync(filePath, movedFilePath);

      await tx.thesisVersion.updateMany({
        where: { thesisId: thesis.id, isCurrent: true },
        data: { isCurrent: false },
      });
      return tx.thesisVersion.create({
        data: {
          thesisId: thesis.id,
          versionNumber: nextVersionNumber,
          fileName,
          filePath: `/uploads/theses/${newFileName}`,
          uploadedBy: studentId,
          status: "DRAFT",
          isCurrent: true,
        },
      });
    });
  } catch (error) {
    if (movedFilePath && fs.existsSync(movedFilePath)) fs.renameSync(movedFilePath, filePath);
    throw error;
  }
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

  if (thesis.status !== "IN_PROGRESS") {
    throw new Error("THESIS_NOT_IN_PROGRESS");
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

  // Rregullo isCurrent pas fshirjes
  const result = await prisma.$transaction(async (tx) => {
    const thesisLock = await tx.thesis.updateMany({
      where: { id: thesis.id, status: "IN_PROGRESS" },
      data: { status: "IN_PROGRESS" },
    });
    if (thesisLock.count !== 1) throw new Error("THESIS_NOT_IN_PROGRESS");

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

  if (fs.existsSync(physicalFilePath)) fs.unlinkSync(physicalFilePath);

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

  return prisma.$transaction(async (tx) => {
    const thesisLock = await tx.thesis.updateMany({
      where: { id: thesis.id, status: "IN_PROGRESS" },
      data: { status: "IN_PROGRESS" },
    });
    if (thesisLock.count !== 1) throw new Error("THESIS_NOT_IN_PROGRESS");
    const update = await tx.thesisVersion.updateMany({
      where: { id: versionId, thesisId: thesis.id, status: "DRAFT" },
      data: { status: "SUBMITTED" },
    });
    if (update.count !== 1) throw new Error("VERSION_NOT_DRAFT");
    return tx.thesisVersion.findUnique({ where: { id: versionId } });
  });
};

const submitFinalThesisVersion = async ({ studentId, versionId }) => {
  const thesis = await prisma.thesis.findFirst({ where: { studentId } });
  if (!thesis) throw new Error("THESIS_NOT_FOUND");
  if (thesis.status !== "IN_PROGRESS") throw new Error("THESIS_NOT_IN_PROGRESS");

  const version = await prisma.thesisVersion.findUnique({ where: { id: versionId } });
  if (!version) throw new Error("VERSION_NOT_FOUND");
  if (version.thesisId !== thesis.id) throw new Error("UNAUTHORIZED_VERSION");
  if (version.status !== "DRAFT") throw new Error("VERSION_NOT_DRAFT");
  if (!thesis.startedAt) throw new Error("THESIS_START_DATE_NOT_FOUND");

  const earliestFinalSubmissionDate = new Date(thesis.startedAt);
  const startDay = earliestFinalSubmissionDate.getDate();
  earliestFinalSubmissionDate.setDate(1);
  earliestFinalSubmissionDate.setMonth(earliestFinalSubmissionDate.getMonth() + 3);
  const finalMonthLastDay = new Date(
    earliestFinalSubmissionDate.getFullYear(),
    earliestFinalSubmissionDate.getMonth() + 1,
    0
  ).getDate();
  earliestFinalSubmissionDate.setDate(Math.min(startDay, finalMonthLastDay));
  if (new Date() < earliestFinalSubmissionDate) {
    const error = new Error("MINIMUM_DURATION_NOT_COMPLETED");
    error.earliestFinalSubmissionDate = earliestFinalSubmissionDate;
    throw error;
  }

  const submittedAt = new Date();
  return prisma.$transaction(async (tx) => {
    const thesisLock = await tx.thesis.updateMany({
      where: { id: thesis.id, status: "IN_PROGRESS" },
      data: { status: "IN_PROGRESS" },
    });
    if (thesisLock.count !== 1) throw new Error("THESIS_NOT_IN_PROGRESS");
    const update = await tx.thesisVersion.updateMany({
      where: { id: versionId, thesisId: thesis.id, status: "DRAFT" },
      data: { status: "SUBMITTED", submittedAt },
    });
    if (update.count !== 1) throw new Error("VERSION_NOT_DRAFT");
    return tx.thesisVersion.findUnique({ where: { id: versionId } });
  });
};


const approveFinalThesisVersion = async ({
  mentorUserId,
  versionId,
  mentorFinalEvaluation,
  finalGrade,
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

  if (version.status !== "SUBMITTED") throw new Error("VERSION_NOT_SUBMITTED");
  if (!version.submittedAt) throw new Error("VERSION_SUBMISSION_DATE_NOT_FOUND");
  if (mentorFinalEvaluation !== undefined && mentorFinalEvaluation !== null &&
      typeof mentorFinalEvaluation !== "string") {
    throw new Error("INVALID_FINAL_EVALUATION");
  }
  if (finalGrade !== undefined && finalGrade !== null &&
      (!Number.isFinite(Number(finalGrade)) || Number(finalGrade) < 6 || Number(finalGrade) > 10)) {
    throw new Error("INVALID_FINAL_GRADE");
  }

  const evaluationDeadline = new Date(version.submittedAt);
  evaluationDeadline.setDate(evaluationDeadline.getDate() + 7);
  if (new Date() > evaluationDeadline) throw new Error("FINAL_EVALUATION_DEADLINE_EXCEEDED");
  const evaluatedAt = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const thesisLock = await tx.thesis.updateMany({
      where: { id: version.thesisId, status: "IN_PROGRESS" },
      data: {
        status: "SUBMITTED",
        mentorFinalEvaluation: mentorFinalEvaluation ?? null,
        finalEvaluatedAt: evaluatedAt,
        finalGrade: finalGrade ?? null,
      },
    });
    if (thesisLock.count !== 1) throw new Error("THESIS_NOT_IN_PROGRESS");

    const versionLock = await tx.thesisVersion.updateMany({
      where: { id: versionId, thesisId: version.thesisId, status: "SUBMITTED" },
      data: { status: "APPROVED", isCurrent: true, reviewedAt: evaluatedAt },
    });
    if (versionLock.count !== 1) throw new Error("VERSION_NOT_SUBMITTED");

    const [approvedVersion, updatedThesis] = await Promise.all([
      tx.thesisVersion.findUnique({ where: { id: versionId } }),
      tx.thesis.findUnique({ where: { id: version.thesisId } }),
    ]);

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

  const now = new Date();
  const evaluationDeadline = version.submittedAt
    ? new Date(version.submittedAt)
    : null;
  if (evaluationDeadline) evaluationDeadline.setDate(evaluationDeadline.getDate() + 7);

  return {
    available: version.status === "SUBMITTED" &&
      version.thesis.status === "IN_PROGRESS" &&
      Boolean(evaluationDeadline) && now <= evaluationDeadline,

    versionStatus: version.status,

    thesisStatus: version.thesis.status,

    submittedAt: version.submittedAt,
    evaluationDeadline,
  };
};

module.exports = {
  getStudentThesis,
  updateStudentThesis,
  approveThesis,
  rejectThesis,
  createThesisVersion,  
  getStudentThesisVersions,
  getMentorThesisVersions,
  submitThesisVersion,
  submitFinalThesisVersion,
  deleteThesisVersion,
  approveFinalThesisVersion,
  getFinalApprovalStatus,
};
