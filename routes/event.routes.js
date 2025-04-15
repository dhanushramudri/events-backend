// routes/event.routes.js

const express = require("express");
const router = express.Router();
const Event = require("../models/event.model");
const User = require("../models/user.model");
const Participant = require("../models/participant.model");
const { authenticate, isAdmin } = require("../middleware/auth.middleware");

// Get all events (public)
router.get("/", async (req, res) => {
  try {
    let query = {};

    // Apply filters
    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.category) {
      query.category = req.query.category;
    }

    let events = await Event.find(query).sort({ date: 1 });

    // Apply limit if provided
    if (req.query.limit) {
      events = events.slice(0, parseInt(req.query.limit));
    }
    // console.log("events", events);
    res.json({ events });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get a single event (public)

// Admin routes for events
router.get("/admin/events", authenticate, isAdmin, async (req, res) => {
  try {
    let query = {};

    // Apply filters
    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.category) {
      query.category = req.query.category;
    }

    let events = await Event.find(query)
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    // Apply limit if provided
    if (req.query.limit) {
      events = events.slice(0, parseInt(req.query.limit));
    }

    res.json({ events });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Create event (admin only)
router.post("/admin/events", authenticate, isAdmin, async (req, res) => {
  console.log("Creating event with data:", req.body);
  try {
    const newEvent = new Event({
      ...req.body,
      createdBy: req.user.id,
    });

    await newEvent.save();

    res.status(201).json({ event: newEvent });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Update event (admin only)
// Update event (admin only)
// Update event (admin only)
router.put("/admin/events/:id", authenticate, async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    res.json({ event });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Delete event (admin only)
router.delete("/admin/events/:id", authenticate, isAdmin, async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Also delete all participants for this event
    await Participant.deleteMany({ eventId: req.params.id });

    res.json({ message: "Event deleted", event });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Toggle auto-approve for event (admin only)
router.post(
  "/admin/events/:id/toggle-auto-approve",
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const event = await Event.findById(req.params.id);

      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      event.autoApprove = !event.autoApprove;
      await event.save();

      res.json({
        event,
        message: `Auto-approval is now ${
          event.autoApprove ? "enabled" : "disabled"
        }`,
      });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// Get user favorites
router.get("/favorites", authenticate, async (req, res) => {
  console.log("Fetching user favorites...");
  // console.log("User ID:", req.user.id);
  try {
    console.log("Fetching user favorites...");
    const user = await User.findById(req.user.id).populate("favorites");
    res.json({ favorites: user.favorites });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});
router.get("/:id", async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate(
      "createdBy",
      "name email"
    );

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    res.json({ event });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});
// User favorites
router.post("/favorites/:id", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if already favorited
    if (user.favorites.includes(req.params.id)) {
      // Remove from favorites
      user.favorites = user.favorites.filter(
        (favId) => favId.toString() !== req.params.id
      );
      await user.save();
      return res.json({
        message: "Event removed from favorites",
        isFavorite: false,
      });
    } else {
      // Add to favorites
      user.favorites.push(req.params.id);
      await user.save();
      return res.json({
        message: "Event added to favorites",
        isFavorite: true,
      });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Register for an Event (user only)
router.post("/register/:id", authenticate, async (req, res) => {
  // console.log("Registering for event with ID:", req.params.id);
  // console.log("User ID:", req.user.id);
  // console.log("User name:", req.user.name);
  // console.log("User email:", req.user.email);
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if the event is already full
    if (event.capacity <= event.participants.length) {
      return res.status(400).json({ message: "Event is full" });
    }

    // Check if the user is already registered
    const existingRegistration = await Participant.findOne({
      eventId: req.params.id,
      userId: req.user.id,
    });
    if (existingRegistration) {
      return res.status(400).json({ message: "User already registered" });
    }

    // Register the user for the event
    const newParticipant = new Participant({
      eventId: req.params.id,
      userId: req.user.id,
      name: req.user.name,
      email: req.user.email,
    });

    await newParticipant.save();

    // Update the event's participant count
    event.participants.push(newParticipant._id);
    await event.save();

    res.json({
      message: "Registration successful",
      participant: newParticipant,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Unregister from an Event (user only)
router.post("/unregister/:id", authenticate, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if the user is registered for the event
    const registration = await Participant.findOne({
      eventId: req.params.id,
      userId: req.user.id,
    });
    if (!registration) {
      return res
        .status(400)
        .json({ message: "User not registered for this event" });
    }

    // Remove the participant from the event's participants list
    await Participant.findByIdAndDelete(registration._id);

    // Update the event's participant list
    event.participants = event.participants.filter(
      (participantId) =>
        participantId.toString() !== registration._id.toString()
    );
    await event.save();

    res.json({ message: "Unregistration successful" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Update Event Registration Information (user only)
router.put("/update-registration/:eventId", authenticate, async (req, res) => {
  try {
    const { name, email } = req.body;

    const event = await Event.findById(req.params.eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const participant = await Participant.findOne({
      eventId: req.params.eventId,
      userId: req.user.id,
    });

    if (!participant) {
      return res
        .status(404)
        .json({ message: "User not registered for this event" });
    }

    // Update participant registration details
    if (name) participant.name = name;
    if (email) participant.email = email;

    await participant.save();

    res.json({
      message: "Registration updated successfully",
      participant,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get All Participants for an Event (admin only)
router.get(
  "/admin/events/:id/participants",
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const event = await Event.findById(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      const participants = await Participant.find({ eventId: req.params.id })
        .populate("userId", "name email")
        .exec();

      res.json({ participants });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);
// Join waitlist for an event (user only)
router.post("/:id/waitlist", authenticate, async (req, res) => {
  // console.log("req.user in waitlist", req.user); // Log the user object for debugging
  try {
    // console.log("req.user", req.body); 
    const event = await Event.findById(req.params.id);
    const events = await Event.find({});
    console.log(" event:", event); // Log all events for debugging

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if already registered


    const existing = await Participant.findOne({
      eventId: event._id,
      userId: req.user.id,
    });
const participants = await Participant.find({});
    console.log("participants", participants); // Log all participants for debugging
    // console.log("existing", existing); // Log the existing registration for debugging

    if (existing) {
      return res
        .status(400)
        .json({ message: "Already registered or in waitlist" });
    }

    // Add to waitlist
    const waitlistEntry = new Participant({
      eventId: event._id,
      userId: req.user.id,
      name: req.user.name,
      email: req.user.email,
      status: "waitlisted",
    });
try {
  await waitlistEntry.save();
  console.log("Waitlist entry saved:", waitlistEntry); // Log the saved waitlist entry for debugging
  
} catch (error) {
  console.log("Error saving waitlist entry:", error); // Log any errors during save
  
}

    // Optionally, store waitlist references in the event document if needed
    // event.waitlist.push(waitlistEntry._id);
    // await event.save();

    res.json({ message: "Added to waitlist", participant: waitlistEntry });
  } catch (error) {
    console.error("Waitlist error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
