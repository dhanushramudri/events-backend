const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    required: true,
    trim: true,
  },
  date: {
    type: Date,
    required: true,
  },
  registrationClosesAt: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ["upcoming", "ongoing", "completed", "cancelled"],
    default: "upcoming",
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  participantsCount: {
    type: Number,
    default: 0,
  },
  capacity: {
    type: Number,
    required: true,
    default: 50,
  },
  autoApprove: {
    type: Boolean,
    default: false,
  },
  description: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  image: {
    // Added the image field
    type: String,
    required: false, // Optional; set to true if required
  },
});

// Update the updatedAt field on save
eventSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const Event = mongoose.model("Event", eventSchema);

module.exports = Event;
