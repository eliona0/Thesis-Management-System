const prisma = require("../config/prisma");

const assignCommittee = async ({
  thesisId,
  members,
}) => {
  // -----------------------------------------------------
  // 1. Find thesis
  // -----------------------------------------------------

  const thesis = await prisma.thesis.findUnique({
    where: {
      id: Number(thesisId),
    },
    include: {
      committee: true,
    },
  });

  if (!thesis) {
    throw new Error("THESIS_NOT_FOUND");
  }

  // -----------------------------------------------------
  // 2. Thesis must be submitted
  // -----------------------------------------------------

  if (thesis.status !== "SUBMITTED") {
    throw new Error("THESIS_NOT_SUBMITTED");
  }

  // -----------------------------------------------------
  // 3. Thesis cannot already have a committee
  // -----------------------------------------------------

  if (thesis.committee) {
    throw new Error("COMMITTEE_ALREADY_EXISTS");
  }

  // -----------------------------------------------------
  // 4. Validate committee members
  // -----------------------------------------------------

  if (!Array.isArray(members) || members.length < 3) {
    throw new Error("INVALID_COMMITTEE_SIZE");
  }

  const chairMembers = members.filter(
    (member) => member.role === "CHAIR"
  );

  const regularMembers = members.filter(
    (member) => member.role === "MEMBER"
  );

  if (chairMembers.length !== 1) {
    throw new Error("INVALID_CHAIR_COUNT");
  }

  if (regularMembers.length < 2) {
    throw new Error("INVALID_MEMBER_COUNT");
  }

  // -----------------------------------------------------
  // 5. Check duplicate member IDs
  // -----------------------------------------------------

  const memberIds = members.map((member) =>
    Number(member.committeeMemberId)
  );

  const uniqueMemberIds = [...new Set(memberIds)];

  if (uniqueMemberIds.length !== memberIds.length) {
    throw new Error("DUPLICATE_COMMITTEE_MEMBER");
  }

  // -----------------------------------------------------
  // 6. Find committee member profiles
  // -----------------------------------------------------

  const committeeProfiles =
    await prisma.committeeMemberProfile.findMany({
      where: {
        id: {
          in: uniqueMemberIds,
        },
      },
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
    });

  if (committeeProfiles.length !== uniqueMemberIds.length) {
    throw new Error("COMMITTEE_MEMBER_NOT_FOUND");
  }

  // -----------------------------------------------------
  // 7. Check all members are active
  // -----------------------------------------------------

  const inactiveMember = committeeProfiles.find(
    (profile) => !profile.user.isActive
  );

  if (inactiveMember) {
    throw new Error("COMMITTEE_MEMBER_INACTIVE");
  }

  // -----------------------------------------------------
  // 8. Create committee + members
  // -----------------------------------------------------

  const result = await prisma.$transaction(async (tx) => {
    const committee = await tx.committee.create({
      data: {
        thesisId: thesis.id,
        status: "ASSIGNED",
        members: {
          create: members.map((member) => ({
            committeeMemberId: Number(
              member.committeeMemberId
            ),
            role: member.role,
          })),
        },
      },
      include: {
        members: {
          include: {
            member: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return committee;
  });

  return result;
};

const getCommittee = async (thesisId) => {
  const thesis = await prisma.thesis.findUnique({
    where: {
      id: Number(thesisId),
    },
  });

  if (!thesis) {
    throw new Error("THESIS_NOT_FOUND");
  }

  const committee = await prisma.committee.findUnique({
    where: {
      thesisId: Number(thesisId),
    },
    include: {
      members: {
        orderBy: {
          role: "asc",
        },
        include: {
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
        },
      },
    },
  });

  if (!committee) {
    throw new Error("COMMITTEE_NOT_FOUND");
  }

  return committee;
};

const scheduleDefense = async ({ thesisId, defenseDate }) => {
  const committee = await prisma.committee.findUnique({
    where: {
      thesisId: Number(thesisId),
    },
  });

  if (!committee) {
    throw new Error("COMMITTEE_NOT_FOUND");
  }

  if (committee.status !== "ASSIGNED") {
    throw new Error("COMMITTEE_ALREADY_SCHEDULED");
  }

  const date = new Date(defenseDate);

  if (Number.isNaN(date.getTime())) {
    throw new Error("INVALID_DEFENSE_DATE");
  }

  if (date <= new Date()) {
    throw new Error("DEFENSE_DATE_MUST_BE_FUTURE");
  }

  const updatedCommittee = await prisma.committee.update({
    where: {
      id: committee.id,
    },
    data: {
      defenseDate: date,
      status: "SCHEDULED",
    },
    include: {
      members: {
        include: {
          member: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return updatedCommittee;
};

module.exports = {
  assignCommittee,
  getCommittee,
  scheduleDefense,
};