const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const { authenticate } = require("../middleware/auth.middleware");

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const bcrypt = require("bcryptjs"); // Ensure bcrypt is required
// Hardcoded admin credentials
const ADMIN_EMAIL = "admin@gmail.com";
const ADMIN_PASSWORD = "admin123";

// Login Route (single for both admin and user)

// Ensure jwt is required

router.post("/login", async (req, res) => {
  
  console.log("Login request received:", req.body);

  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    console.log("User found in database:", user);

    // Check if user exists
    if (!user) {
      return res.status(401).json({
        message: "No user found with this email. Invalid credentials",
      });
    }

    // Compare entered password with stored hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    console.log("Password match result:", isMatch);

    // If password doesn't match, return an error
    if (!isMatch) {
      return res.status(401).json({
        message: "Password is not matched. Invalid credentials",
      });
    }

    // Dynamically set role to admin if hardcoded email and password match
    let role = "user"; // Default role is 'user'
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      role = "admin"; // Override role if credentials match the admin
    }

    // Update role if it’s not already set correctly
    if (user.role !== role) {
      user.role = role;
      await user.save(); // Save updated user with the correct role
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET, // Make sure JWT_SECRET is defined somewhere in your config
      { expiresIn: "24h" } // Token expires in 24 hours
    );

    // Respond with the token and user data
    res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Register User (admin will not be registered here)
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (email === ADMIN_EMAIL) {
      return res
        .status(403)
        .json({ message: "Cannot register with reserved admin email" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const user = new User({
      name,
      email,
      password,
      role: "user",
    });

    await user.save();

    const token = jwt.sign(
      { id: user._id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.status(201).json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get Authenticated User Info
router.get("/me", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
