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

  if (!thesis) throw new Error("THESIS_NOT_FOUND");

  if (thesis.status !== "IN_PROGRESS") {
    throw new Error("THESIS_NOT_IN_PROGRESS");
  }

  const lastVersion = await prisma.thesisVersion.findFirst({
    where: { thesisId: thesis.id },
    orderBy: { versionNumber: "desc" },
  });

  const nextVersionNumber = lastVersion
    ? lastVersion.versionNumber + 1
    : 1;

  // Get the actual uploaded filename generated by Multer
  const storedFileName = path.basename(filePath);

  // Make the physical filename meaningful:
  // student + version + unique timestamp
  const newFileName = `thesis-student-${studentId}-version-${nextVersionNumber}-${Date.now()}.pdf`;

  const oldFilePath = filePath;
  const newFilePath = path.join(
    path.dirname(oldFilePath),
    newFileName
  );

  // Rename the physical file
  const fs = require("fs");

  fs.renameSync(oldFilePath, newFilePath);

  // Store a relative path in the database
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


module.exports = {
  getStudentThesis,
  updateStudentThesis,
  approveThesis,
  rejectThesis,
  startThesis,
  createThesisVersion,
  getStudentThesisVersions,
  getMentorThesisVersions,
};