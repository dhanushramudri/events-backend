// middleware/auth.middleware.js

const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";



exports.authenticate = async (req, res, next) => {
  // console.log("req details in auth middleware");
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authorization required" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findById(decoded.id);
    // console.log("user is ", user);
    if (!user) {
      return res.status(401).json({ message: "User  id not found" });
    }

    // Attach the user object to req.user
    req.user = user; // Now req.user contains the full user object
    next();
    console.log("passing to next middleware");
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

// middleware/auth.middleware.js

exports.isAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (user && user.role === "admin") {
      return next();
    }
    return res
      .status(403)
      .json({ message: "Access denied. Admin role required." });
  } catch (error) {
    return res.status(500).json({ message: "Error checking admin role" });
  }
};

exports.isUser = (req, res, next) => {
  if (req.user) {
    return next();
  }
  return res.status(403).json({ message: "Access denied." });
};
