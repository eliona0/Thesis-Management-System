    const prisma = require("../config/prisma");

    const createMentorRequest = async ({ studentId, mentorId, message }) => {
    const mentor = await prisma.mentorProfile.findUnique({
        where: {
        id: Number(mentorId),
        },
    });

    if (!mentor) {
        throw new Error("MENTOR_NOT_FOUND");
    }

    if (!mentor.isAvailable) {
        throw new Error("MENTOR_NOT_AVAILABLE");
    }

    const existingRequest = await prisma.mentorRequest.findFirst({
        where: {
        studentId,
        mentorId: Number(mentorId),
        status: "PENDING",
        },
    });

    if (existingRequest) {
        throw new Error("PENDING_REQUEST_EXISTS");
    }

    const request = await prisma.mentorRequest.create({
        data: {
        studentId,
        mentorId: Number(mentorId),
        message: message || null,
        },
        include: {
        mentor: {
            include: {
            user: {
                select: {
                firstName: true,
                lastName: true,
                email: true,
                },
            },
            },
        },
        },
    });

    return request;
    };

    const getMentorRequests = async (mentorUserId) => {
    const mentorProfile = await prisma.mentorProfile.findUnique({
        where: {
        userId: mentorUserId,
        },
    });

    if (!mentorProfile) {
        throw new Error("MENTOR_PROFILE_NOT_FOUND");
    }

    const requests = await prisma.mentorRequest.findMany({
        where: {
        mentorId: mentorProfile.id,
        },
        orderBy: {
        requestDate: "desc",
        },
        include: {
        student: {
            select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            studentProfile: {
                select: {
                studentNumber: true,
                },
            },
            studyProgram: {
                select: {
                name: true,
                },
            },
            },
        },
        },
    });

    return requests;
    };

    const acceptMentorRequest = async ({ mentorUserId, requestId }) => {
    const mentorProfile = await prisma.mentorProfile.findUnique({
        where: {
        userId: mentorUserId,
        },
    });

    if (!mentorProfile) {
        throw new Error("MENTOR_PROFILE_NOT_FOUND");
    }

    const request = await prisma.mentorRequest.findUnique({
        where: {
        id: requestId,
        },
    });

    if (!request) {
        throw new Error("REQUEST_NOT_FOUND");
    }

    if (request.mentorId !== mentorProfile.id) {
        throw new Error("UNAUTHORIZED_REQUEST");
    }

    if (request.status !== "PENDING") {
        throw new Error("REQUEST_NOT_PENDING");
    }

    const existingThesis = await prisma.thesis.findFirst({
        where: {
        studentId: request.studentId,
        status: {
            in: [
            "PENDING",
            "APPROVED",
            "IN_PROGRESS",
            "SUBMITTED",
            "UNDER_EVALUATION",
            ],
        },
        },
    });

    if (existingThesis) {
        throw new Error("STUDENT_ALREADY_HAS_THESIS");
    }

    const result = await prisma.$transaction(async (tx) => {
        const updatedRequest = await tx.mentorRequest.update({
        where: {
            id: requestId,
        },
        data: {
            status: "ACCEPTED",
            responseDate: new Date(),
        },
        });

        const thesis = await tx.thesis.create({
        data: {
            studentId: request.studentId,
            mentorId: mentorProfile.userId,
            title: "Untitled Thesis",
            status: "PENDING",
        },
        });

        return {
        updatedRequest,
        thesis,
        };
    });

    const updatedRequest = await prisma.mentorRequest.findUnique({
        where: {
        id: requestId,
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
            include: {
            user: {
                select: {
                firstName: true,
                lastName: true,
                email: true,
                },
            },
            },
        },
        },
    });

    return {
        ...updatedRequest,
        thesis: result.thesis,
    };
    };

    const rejectMentorRequest = async ({ mentorUserId, requestId }) => {
    const mentorProfile = await prisma.mentorProfile.findUnique({
        where: {
        userId: mentorUserId,
        },
    });

    if (!mentorProfile) {
        throw new Error("MENTOR_PROFILE_NOT_FOUND");
    }

    const request = await prisma.mentorRequest.findUnique({
        where: {
        id: requestId,
        },
    });

    if (!request) {
        throw new Error("REQUEST_NOT_FOUND");
    }

    if (request.mentorId !== mentorProfile.id) {
        throw new Error("UNAUTHORIZED_REQUEST");
    }

    if (request.status !== "PENDING") {
        throw new Error("REQUEST_NOT_PENDING");
    }

    const updatedRequest = await prisma.mentorRequest.update({
        where: {
        id: requestId,
        },
        data: {
        status: "REJECTED",
        responseDate: new Date(),
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
        },
    });

    return updatedRequest;
    };

    module.exports = {
    createMentorRequest,
    getMentorRequests,
    acceptMentorRequest,
    rejectMentorRequest,
    };