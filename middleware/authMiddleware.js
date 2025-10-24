import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: "Access token required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");
    
    if (!user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    return res.status(403).json({ error: "Invalid or expired token" });
  }
};

// Authorization middleware - user can only access their own data
export const authorizeUser = (req, res, next) => {
  const requestedUserId = req.params.id;
  const currentUserId = req.user._id.toString();

  if (requestedUserId !== currentUserId) {
    return res.status(403).json({ error: "Access denied. You can only access your own data" });
  }

  next();
};