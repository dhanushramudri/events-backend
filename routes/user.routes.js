// routes/user.routes.js

const express = require("express");
const router = express.Router();
const User = require("../models/user.model");
const Participant = require("../models/participant.model");
const { authenticate, isAdmin } = require("../middleware/auth.middleware");

// Get all users (admin only)
router.get("/admin", authenticate, isAdmin, async (req, res) => {
  try {
    // Get all users first
    const allUsers = await User.find().select("-password");

    // Get unique participants who might not have user accounts
    const uniqueParticipants = await Participant.aggregate([
      // Group by email to get unique participants
      {
        $group: {
          _id: "$email",
          name: { $first: "$name" },
          email: { $first: "$email" },
          registrations: { $sum: 1 },
        },
      },
      // Project to shape the output
      {
        $project: {
          _id: 0,
          email: "$_id",
          name: 1,
          registrations: 1,
          role: { $literal: "participant" },
        },
      },
    ]);

    // Combine users with participant data
    const combinedUsers = allUsers.map((user) => {
      // Find matching participant data if any
      const participantData = uniqueParticipants.find(
        (p) => p.email === user.email
      );
      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        registrations: participantData ? participantData.registrations : 0,
      };
    });

    // Add participants who don't have user accounts
    const nonUserParticipants = uniqueParticipants.filter(
      (participant) =>
        !allUsers.some((user) => user.email === participant.email)
    );

    const users = [...combinedUsers, ...nonUserParticipants];

    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get a single user (admin only)
router.get("/admin/:id", authenticate, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get participant data
    const participations = await Participant.find({
      $or: [{ userId: user._id }, { email: user.email }],
    }).populate("eventId");

    res.json({
      user: {
        ...user.toObject(),
        participations,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Update user profile
router.put("/profile", authenticate, async (req, res) => {
  try {
    const { name, email } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update user
    if (name) user.name = name;
    if (email) user.email = email;

    await user.save();

    // Also update participant records if email changed
    if (email && email !== req.user.email) {
      await Participant.updateMany({ userId: req.user.id }, { email });
    }

    res.json({
      message: "Profile updated successfully",
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

// Add event to favorites (user only)
router.post("/favorites/add/:eventId", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const eventId = req.params.eventId;

    // Check if the event is already in the favorites list
    if (user.favorites.includes(eventId)) {
      return res.status(400).json({ message: "Event is already in favorites" });
    }

    user.favorites.push(eventId);
    await user.save();

    res.json({ message: "Event added to favorites" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Remove event from favorites (user only)
router.post("/favorites/remove/:eventId", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const eventId = req.params.eventId;

    // Check if the event exists in the favorites list
    const index = user.favorites.indexOf(eventId);
    if (index === -1) {
      return res.status(400).json({ message: "Event is not in favorites" });
    }

    // Remove the event from favorites
    user.favorites.splice(index, 1);
    await user.save();

    res.json({ message: "Event removed from favorites" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Check if the event is in favorites (user only)
router.get("/favorites/check/:eventId", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const eventId = req.params.eventId;

    // Check if the event is in the user's favorites
    const isFavorite = user.favorites.includes(eventId);

    res.json({ isFavorite });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});


// Contact admin route
// Contact admin route
router.post("/contact-admin", authenticate, async (req, res) => {
  const { subject, message } = req.body;

  if (!subject || !message) {
    return res.status(400).json({ message: "Subject and message are required." });
  }

  try {
    // Find the admin user (assuming there's only one admin)
    const adminUser  = await User.findOne({ role: "admin" });
    console.log("adminUser  before message:", adminUser );

    if (!adminUser ) {
      return res.status(404).json({ message: "Admin user not found." });
    }

    // Create a message object
    const newMessage = {
      subject,
      content: message,
      sender: req.user._id, 
      createdAt: new Date(),
      email: req.user.email, // Add the sender's email to the message
      name: req.user.name, // Add the sender's name to the message
    };

    // Push the new message into the admin's clientMessages array
    adminUser .clientMessages.push(newMessage);

    // Save the admin user
    await adminUser.save();

    // Fetch the admin user again to verify the message was added
    const updatedAdminUser  = await User.findOne({ role: "admin" });
    console.log("Updated adminUser  after message:", updatedAdminUser );

    console.log("adminUser  after message:", updatedAdminUser.clientMessages);

    res.json({ message: "Your message has been sent to the admin." , updatedAdminUser });
  } catch (error) {
    console.error("Error in contact-admin route:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});



module.exports = router;
