// routes/participant.routes.js

const express = require("express");
const router = express.Router();
const Event = require("../models/event.model");
const Participant = require("../models/participant.model");
const User = require("../models/user.model");
const { authenticate, isAdmin } = require("../middleware/auth.middleware");

// Utility function to handle participant cancellation and auto-approve next in line
async function handleParticipantCancellation(eventId, participantId) {
  try {
    // Get the participant who is canceling
    const canceledParticipant = await Participant.findById(participantId);

    // Only proceed if an approved participant is canceling
    if (!canceledParticipant || canceledParticipant.status !== "approved") {
      return false;
    }

    // Update event count
    const event = await Event.findById(eventId);
    const approvedCount = await Participant.countDocuments({
      eventId,
      status: "approved",
    });

    // If capacity now allows for a new participant, find the next in queue
    if (approvedCount < event.capacity) {
      // Find the first person in the waitlist (sorted by queue position)
      const nextInLine = await Participant.findOne({
        eventId,
        status: "pending",
      }).sort({ queuePosition: 1 });

      if (nextInLine) {
        // Auto-approve this participant
        await Participant.findByIdAndUpdate(nextInLine._id, {
          status: "approved",
          queuePosition: 0, // Now approved, so no queue position
        });

        console.log(
          `Auto-approved participant ${nextInLine.name} after cancellation`
        );

        // Update event participant count
        event.participantsCount += 1;
        await event.save();

        return {
          success: true,
          autoApproved: nextInLine,
        };
      }
    }

    return {
      success: false,
      message: "No participants to auto-approve",
    };
  } catch (error) {
    console.error("Error handling participant cancellation:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Register for an event (public)
router.post("/events/:id/register", authenticate, async (req, res) => {
  console.log("User  details are in register:", req.user);
  const { name, email } = req.user;
  console.log("user , email", name, email); 

  try {
    if (!name || !email) {
      return res.status(400).json({ message: "Name and email are required" });
    }

    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if registration is closed
    const now = new Date();
    const closingTime = new Date(event.registrationClosesAt);
    if (now > closingTime) {
      return res
        .status(400)
        .json({ message: "Registration for this event has closed" });
    }

    // Check if user already registered
    const existingParticipant = await Participant.findOne({
      email,
      eventId: req.params.id,
    });

    if (existingParticipant) {
      return res
        .status(400)
        .json({ message: "You have already registered for this event" });
    }

    // Find associated user if exists
    const user = await User.findOne({ email });

    // Determine status and queue position
    const approvedParticipants = await Participant.countDocuments({
      eventId: req.params.id,
      status: "approved",
    });

    let status = "pending";
    if (event.autoApprove && approvedParticipants < event.capacity) {
      status = "approved";
    }

    // Calculate queue position
    const queuePosition =
      status === "approved"
        ? 0
        : (await Participant.countDocuments({
            eventId: req.params.id,
            status: "pending",
          })) + 1;

    // Create new participant
    const newParticipant = new Participant({
      name,
      email,
      status,
      eventId: req.params.id,
      queuePosition,
      userId: user ? user._id : null,
      registeredAt: new Date(),
    });

    await newParticipant.save();

    // Update event participant count if approved
    if (status === "approved") {
      event.participantsCount += 1;
      await event.save();
    }

    // Add the event to the user's registeredEvents array
    if (user) {
      user.registeredEvents.push(event._id);
      await user.save();
    }

    res.status(201).json({
      message:
        status === "approved"
          ? "You have been successfully registered for this event"
          : "Your registration is pending approval",
      participant: newParticipant,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post("/events/:id/withdraw",authenticate, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const participant = await Participant.findOne({
      userId: req.user._id, // Ensure to use the authenticated user's ID
      eventId: req.params.id,
    });

    if (!participant) {
      return res.status(404).json({ message: "Participant not found" });
    }

    // If already withdrawn, just return
    if (participant.status === "withdrawn") {
      return res.json({ message: "You have already withdrawn from this event", participant });
    }

    // If was approved, decrement event count
    if (participant.status === "approved") {
      event.participantsCount = Math.max(0, event.participantsCount - 1);
      await event.save();

      // Handle auto-approval of next in line
      await handleParticipantCancellation(req.params.id, participant._id);
    }

    // Update participant status to withdrawn
    participant.status = "withdrawn";
    participant.queuePosition = -1; // Reset queue position
    await participant.save();

    // Update the user's registeredEvents array
    const user = await User.findById(req.user._id);
    if (user) {
      user.registeredEvents = user.registeredEvents.filter(eventId => !eventId.equals(req.params.id));
      await user.save();
    }

    // Update queue positions for remaining participants
    const pendingParticipants = await Participant.find({
      eventId: req.params.id,
      status: "pending",
    }).sort({ queuePosition: 1 });

    for (let i = 0; i < pendingParticipants.length; i++) {
      pendingParticipants[i].queuePosition = i + 1;
      await pendingParticipants[i].save();
    }

    res.json({ message: "You have successfully withdrawn from the event", participant });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});
// Get all participants for an event (admin only)
router.post("/events/:id/withdraw", async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const participant = await Participant.findOne({
      userId: req.user._id, // Ensure to use the authenticated user's ID
      eventId: req.params.id,
    });

    if (!participant) {
      return res.status(404).json({ message: "Participant not found" });
    }

    // If already withdrawn, just return
    if (participant.status === "withdrawn") {
      return res.json({ message: "You have already withdrawn from this event", participant });
    }

    // If was approved, decrement event count
    if (participant.status === "approved") {
      event.participantsCount = Math.max(0, event.participantsCount - 1);
      await event.save();

      // Handle auto-approval of next in line
      await handleParticipantCancellation(req.params.id, participant._id);
    }

    // Update participant status to withdrawn
    participant.status = "withdrawn";
    participant.queuePosition = -1; // Reset queue position
    await participant.save();

    // Update queue positions for remaining participants
    const pendingParticipants = await Participant.find({
      eventId: req.params.id,
      status: "pending",
    }).sort({ queuePosition: 1 });

    for (let i = 0; i < pendingParticipants.length; i++) {
      pendingParticipants[i].queuePosition = i + 1;
      await pendingParticipants[i].save();
    }

    res.json({ message: "You have successfully withdrawn from the event", participant });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});
// Approve a participant (admin only)
router.post(
  "/admin/events/:eventId/participants/:userId/approve",
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const event = await Event.findById(req.params.eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      const participant = await Participant.findOne({
        _id: req.params.userId,
        eventId: req.params.eventId,
      });

      if (!participant) {
        return res.status(404).json({ message: "Participant not found" });
      }

      // If already approved, just return
      if (participant.status === "approved") {
        return res.json({ participant });
      }

      // Check capacity
      const approvedCount = await Participant.countDocuments({
        eventId: req.params.eventId,
        status: "approved",
      });

      if (approvedCount >= event.capacity) {
        return res.status(400).json({
          message: "Cannot approve: Event has reached maximum capacity",
        });
      }

      // Approve participant
      participant.status = "approved";
      participant.queuePosition = 0;
      await participant.save();

      // Update event participant count
      event.participantsCount += 1;
      await event.save();

      // Update queue positions for remaining participants
      const pendingParticipants = await Participant.find({
        eventId: req.params.eventId,
        status: "pending",
      }).sort({ queuePosition: 1 });

      for (let i = 0; i < pendingParticipants.length; i++) {
        pendingParticipants[i].queuePosition = i + 1;
        await pendingParticipants[i].save();
      }

      res.json({ participant });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// Reject a participant (admin only)
router.post(
  "/admin/events/:eventId/participants/:userId/reject",
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const event = await Event.findById(req.params.eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      const participant = await Participant.findOne({
        _id: req.params.userId,
        eventId: req.params.eventId,
      });

      if (!participant) {
        return res.status(404).json({ message: "Participant not found" });
      }

      // If already rejected, just return
      if (participant.status === "rejected") {
        return res.json({ participant });
      }

      // If was approved, decrement event count
      if (participant.status === "approved") {
        event.participantsCount = Math.max(0, event.participantsCount - 1);
        await event.save();

        // Handle auto-approval of next in line
        await handleParticipantCancellation(
          req.params.eventId,
          participant._id
        );
      }

      // Reject participant
      participant.status = "rejected";
      participant.queuePosition = -1;
      await participant.save();

      // Update queue positions for remaining participants
      const pendingParticipants = await Participant.find({
        eventId: req.params.eventId,
        status: "pending",
      }).sort({ queuePosition: 1 });

      for (let i = 0; i < pendingParticipants.length; i++) {
        pendingParticipants[i].queuePosition = i + 1;
        await pendingParticipants[i].save();
      }

      res.json({ participant });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// Send notifications (admin only)
router.post(
  "/admin/events/:id/notifications",
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const event = await Event.findById(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      const { message, status, userIds } = req.body;

      if (!message || message.trim() === "") {
        return res
          .status(400)
          .json({ message: "Notification message is required" });
      }

      // Build query for participants
      let query = { eventId: req.params.id };

      // Filter by status if provided
      if (status) {
        query.status = status;
      }

      // Filter by specific users if provided
      if (userIds && userIds.length > 0) {
        query._id = { $in: userIds };
      }

      // Get participants to notify
      const participants = await Participant.find(query);

      if (participants.length === 0) {
        return res.status(404).json({
          message: "No participants found matching the criteria",
        });
      }

      res.json({
        message: "Notifications processed successfully",
        recipients: participants.length,
      });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// Get user's registrations
router.get("/user/registrations", authenticate, async (req, res) => {
  try {
    // Find registrations either by userId (if logged in) or by email
    const registrations = await Participant.find({
      $or: [{ userId: req.user.id }, { email: req.user.email }],
    }).populate("eventId");

    res.json({ registrations });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.get(
  "/admin/my-events/participants",
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      // Find events created by the admin
      const events = await Event.find({ createdBy: req.user.id });
      const eventIds = events.map((event) => event._id);

      const participants = await Participant.find({
        eventId: { $in: eventIds },
      })
        .populate("eventId")
        .sort({ createdAt: -1 });

      res.json({ participants });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// Delete a participant and auto-approve next in line (admin only)
router.delete(
  "/admin/events/:eventId/participants/:userId",
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const event = await Event.findById(req.params.eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      const participant = await Participant.findOne({
        _id: req.params.userId,
        eventId: req.params.eventId,
      });

      if (!participant) {
        return res.status(404).json({ message: "Participant not found" });
      }

      // Check if this was an approved participant
      const wasApproved = participant.status === "approved";

      // If was approved, decrement event count
      if (wasApproved) {
        event.participantsCount = Math.max(0, event.participantsCount - 1);
        await event.save();
      }

      // Remove the participant
      await Participant.deleteOne({ _id: participant._id });

      // If this was an approved participant, auto-approve the next in line
      let autoApprovalResult = { success: false };

      if (wasApproved) {
        autoApprovalResult = await handleParticipantCancellation(
          req.params.eventId,
          participant._id
        );
      }

      // Update queue positions for remaining participants
      if (participant.status === "pending") {
        const pendingParticipants = await Participant.find({
          eventId: req.params.eventId,
          status: "pending",
        }).sort({ createdAt: 1 });

        for (let i = 0; i < pendingParticipants.length; i++) {
          pendingParticipants[i].queuePosition = i + 1;
          await pendingParticipants[i].save();
        }
      }

      // Return appropriate response based on auto-approval result
      if (wasApproved && autoApprovalResult.success) {
        return res.json({
          message: "Participant removed and next in line auto-approved",
          autoApproved: autoApprovalResult.autoApproved.name,
        });
      } else {
        return res.json({ message: "Participant removed successfully" });
      }
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);


// get all participants for the user 
router.get("/user/participants", authenticate, async (req, res) => {
  console.log("User details in get participants:", req.user);
  console.log("User ID:", req.user.id); // Log the user ID for debugging
  try {
    const participants = await Participant.find({
      userId: req.user.id,
    }).populate("eventId");

    res.json({ participants });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;