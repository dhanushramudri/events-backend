// routes/analytics.routes.js

const express = require("express");
const router = express.Router();
const Event = require("../models/event.model");
const Participant = require("../models/participant.model");
const { authenticate, isAdmin } = require("../middleware/auth.middleware");

// Get analytics data (admin only)
router.get("/admin", authenticate, isAdmin, async (req, res) => {
  try {
    // Get basic counts
    const totalEvents = await Event.countDocuments();
    const totalParticipants = await Participant.countDocuments();
    console.log("total participants", totalParticipants);
    const upcomingEvents = await Event.countDocuments({ status: "upcoming" });
    const ongoingEvents = await Event.countDocuments({ status: "ongoing" });

    // Get capacity utilization
    const events = await Event.find();
    const capacityUtilization = await Promise.all(
      events.map(async (event) => {
        const approvedCount = await Participant.countDocuments({
          eventId: event._id,
          status: "approved",
        });

        return {
          eventId: event._id,
          title: event.title,
          capacity: event.capacity,
          approved: approvedCount,
          percentage:
            event.capacity > 0 ? (approvedCount / event.capacity) * 100 : 0,
        };
      })
    );

    // Generate participant trend data (last 31 days)
    const participantsTrend = [];
    const today = new Date();

    for (let i = 30; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const startOfDay = new Date(date.setHours(0, 0, 0, 0));
      const endOfDay = new Date(date.setHours(23, 59, 59, 999));

      const count = await Participant.countDocuments({
        registeredAt: { $gte: startOfDay, $lte: endOfDay },
      });

      participantsTrend.push({
        date: startOfDay.toISOString().split("T")[0],
        count,
      });
    }

    // Events by category
    const eventsByCategory = await Event.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $project: { category: "$_id", count: 1, _id: 0 } },
    ]);

    // Add "Other" category with 0 count if no other categories exist
    if (eventsByCategory.length === 0) {
      eventsByCategory.push({ category: "Other", count: 0 });
    }

    // Registration status metrics
    const approved = await Participant.countDocuments({ status: "approved" });
    const pending = await Participant.countDocuments({ status: "pending" });
    const rejected = await Participant.countDocuments({ status: "rejected" });

    const registrationStatus = { approved, pending, rejected };

    res.json({
      totalEvents,
      totalParticipants,
      upcomingEvents,
      ongoingEvents,
      participantsTrend,
      eventsByCategory,
      capacityUtilization,
      registrationStatus,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
