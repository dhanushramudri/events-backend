const User = require("../models/user.model");
const Event = require("../models/event.model");
const Participant = require("../models/participant.model");
const bcrypt = require("bcryptjs");
const router = require("../routes/event.routes");
const { authenticate } = require("../middleware/auth.middleware");

async function initializeDatabase() {
  try {
    await Participant.deleteMany({});
    await Event.deleteMany({});
    await User.deleteMany({});
    console.log("✅ Deleted existing data");
  } catch (error) {
    console.error("❌ Error deleting existing data:", error);
  }
  try {
    // Check if we already have data
    const userCount = await User.countDocuments();
    if (userCount > 20) {
      console.log("Database already contains data, skipping initialization");
      return;
    }

    console.log("Initializing database with dummy data...");

    // Hash the password for the admin
    const adminPassword = await bcrypt.hash("admin123", 10);

    // Create admin user (override if exists)
    let admin = await User.findOneAndUpdate(
      { email: "admin@gmail.com" },
      {
        name: "Admin User",
        email: "admin@gmail.com",
        password: adminPassword,
        role: "admin",
      },
      { upsert: true, new: true }
    );

    // Hash the password for the regular user
    const userPassword = await bcrypt.hash("password123", 10);

    // Create regular user (override if exists)
    let user = await User.findOneAndUpdate(
      { email: "alice@example.com" },
      {
        name: "Alice",
        email: "alice@example.com",
        password: userPassword,
        role: "user",
      },
      { upsert: true, new: true }
    );

    // Create events
    const events = await Event.insertMany([
      {
        title: "Mongo Conference",
        category: "Conference",
        date: new Date("2025-04-20"),
        registrationClosesAt: new Date("2025-04-18T23:59:59Z"),
        status: "upcoming",
        createdBy: admin._id,
        participantsCount: 0,
        capacity: 1,
        autoApprove: true,
        description: "Annual conference for React developers",
        location: "San Francisco, CA",
      },
    ]);

    // Register participants with queue position logic
    async function addParticipant(event, participantData) {
      const eventDetails = await Event.findById(event._id);

      // Default status to "pending" and no queue position
      let status = "pending";
      let queuePosition = null;

      // If event has available capacity, approve the participant
      if (eventDetails.participantsCount < eventDetails.capacity) {
        console.log("Event has available capacity, approving participant...");

        status = "approved";
        queuePosition = 0; // Not in the queue, directly approved
      } else {
        // Event is full, add to waitlist
        const waitingListCount = await Participant.countDocuments({
          eventId: event._id,
          status: "pending",
        });
        queuePosition = waitingListCount + 1; // Position in the queue, one above the last pending
      }

      const newParticipant = await Participant.create({
        ...participantData,
        eventId: event._id,
        status: participantData.status || status,
        queuePosition,
        registeredAt: new Date(),
      });

      // Update the event's participant count only if the participant is approved
      if (status === "approved") {
        await Event.findByIdAndUpdate(event._id, {
          participantsCount: eventDetails.participantsCount + 1,
        });
      }

      console.log(
        `Participant ${newParticipant.name} added with status ${newParticipant.status} and queue position ${queuePosition}`
      );
      return newParticipant;
    }

    // Example participants for events with unique user IDs
    const participantData1 = {
      name: "Dhanush",
      email: "dhanushpersonal4@gmail.com",
      status: "pending",
      userId: user._id, // Associate with Alice
    };

    const participantData2 = {
      name: "hello",
      email: " hello@example.com",
      status: "pending",
      userId: user._id, // Associate with Alice
    };

    const participantData3 = {
      name: "Bob",
      email: "bob@example.com",
      status: "pending",
      userId: null, // No user associated
    };

    const participantData4 = {
      name: "Charlie",
      email: "charlie@example.com",
      status: "pending",
      userId: null, // No user associated
    };

    const participantData5 = {
      name: "Charan",
      email: "charan91827@gmail.com",
      status: "pending",
      userId: user._id, // Associate with Alice
    };

    const participantData6 = {
      name: "q1",
      email: "q1@gmail.com",
      status: "pending",
      userId: user._id, // Associate with Alice
    };

    const participantData7 = {
      name: "q2",
      email: "eeee21171@gmail.com",
      status: "pending",
      userId: user._id, // Associate with Alice
    };

    // Register participants for Mongo Conference
    // await addParticipant(events[0], participantData1);
    // await addParticipant(events[0], participantData2);
    // await addParticipant(events[0], participantData3);
    // await addParticipant(events[0], participantData4);
    // await addParticipant(events[0], participantData5);
    // await addParticipant(events[0], participantData6);
    // await addParticipant(events[0], participantData7);

    // Add favorite for Alice
    await User.findByIdAndUpdate(user._id, {
      favorites: [events[0]._id],
    });

    console.log("✅ Database initialized with dummy data");
  } catch (error) {
    console.error("❌ Error initializing database:", error);
  }
}

module.exports = { initializeDatabase };

