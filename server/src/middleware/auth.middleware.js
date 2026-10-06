const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

const authenticate = async (req, res, next) => {
  let decoded;
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authorization header is required",
      });
    }

    const parts = authHeader.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({
        success: false,
        message: "Invalid authorization format",
      });
    }

    const token = parts[1];

    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }

  if (!Number.isSafeInteger(decoded?.userId) || decoded.userId <= 0) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, isActive: true, role: { select: { name: true } } },
    });
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: "Account is unavailable" });
    }
    req.user = { userId: user.id, role: user.role.name };
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  authenticate,
};
