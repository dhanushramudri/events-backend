
const mongoose = require("mongoose");

const participantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected", "waitlisted","withdrawn"], // Add 'waitlisted' here
    default: "pending",
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    required: true,
  },
  registeredAt: {
    type: Date,
    default: Date.now,
  },
  queuePosition: {
    type: Number,
    default: 0,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User ",
    default: null,
  },
});

// Add unique compound index for email + eventId to prevent duplicate registrations
participantSchema.index({ email: 1, eventId: 1 }, { unique: true });

const Participant = mongoose.model("Participant", participantSchema);

module.exports = Participant;