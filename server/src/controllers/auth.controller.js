const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

const register = async (req, res) => res.status(403).json({
  success: false,
  message: "Public registration is disabled. Contact an administrator to create an account.",
});


// LOGIN
const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    // 1. Check required fields
    if (!normalizedEmail || typeof password !== "string" || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // 2. Find user by email
    const user = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
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

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
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

