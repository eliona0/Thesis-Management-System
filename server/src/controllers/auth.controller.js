const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

const register = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      studentNumber,
      studyProgramId,
    } = req.body;

    // 1. Check required fields
    if (
      !firstName ||
      !lastName ||
      !email ||
      !password ||
      !studentNumber ||
      !studyProgramId
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // 2. Check if email already exists
    const existingEmail = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: "Email already exists",
      });
    }

    // 3. Check if student number already exists
    const existingStudent = await prisma.studentProfile.findUnique({
      where: {
        studentNumber,
      },
    });

    if (existingStudent) {
      return res.status(409).json({
        success: false,
        message: "Student number already exists",
      });
    }

    // 4. Find STUDENT role
    const studentRole = await prisma.role.findUnique({
      where: {
        name: "STUDENT",
      },
    });

    if (!studentRole) {
      return res.status(500).json({
        success: false,
        message: "STUDENT role does not exist",
      });
    }

    // 5. Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // 6. Create user + student profile
    const user = await prisma.user.create({
      data: {
        roleId: studentRole.id,
        studyProgramId: Number(studyProgramId),
        firstName,
        lastName,
        email,
        passwordHash,
        studentProfile: {
          create: {
            studentNumber,
          },
        },
      },
      include: {
        role: true,
        studentProfile: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Student registered successfully",
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role.name,
        studentNumber: user.studentProfile.studentNumber,
      },
    });
  } catch (error) {
    console.error("Register error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong during registration",
    });
  }
};


// LOGIN
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Check required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // 2. Find user by email
    const user = await prisma.user.findUnique({
      where: {
        email,
      },
      include: {
        role: true,
        studentProfile: true,
      },
    });

    // 3. Check if user exists
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // 4. Compare password
    const isPasswordValid = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // 5. Create JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role.name,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );

    // 6. Send response
    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role.name,
        studentNumber: user.studentProfile
          ? user.studentProfile.studentNumber
          : null,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong during login",
    });
  }
};


const me = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: req.user.userId,
      },
      include: {
        role: true,
        studentProfile: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role.name,
        studentNumber: user.studentProfile
          ? user.studentProfile.studentNumber
          : null,
      },
    });
  } catch (error) {
    console.error("Get current user error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};


module.exports = {
  register,
  login,
  me,
};

