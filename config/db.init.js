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
    console.log("hello")

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
    capacity: 200,
    autoApprove: true,
    description: "Annual conference for MongoDB developers",
    location: "San Francisco, CA",
  },
  {
    title: "Node.js Workshop",
    category: "Workshop",
    date: new Date("2023-11-15"),
    registrationClosesAt: new Date("2023-11-14T23:59:59Z"),
    status: "upcoming",
    createdBy: admin._id,
    participantsCount: 0,
    capacity: 50,
    autoApprove: false,
    description: "Learn advanced Node.js techniques in this hands-on workshop.",
    location: "New York, NY",
  },
  {
    title: "React Meetup",
    category: "Meetup",
    date: new Date("2024-01-30"),
    registrationClosesAt: new Date("2024-01-25T23:59:59Z"),
    status: "upcoming",
    createdBy: admin._id,
    participantsCount: 0,
    capacity: 100,
    autoApprove: true,
    description: "Monthly ReactJS enthusiasts' meetup with networking and talks.",
    location: "Los Angeles, CA",
  },
  {
    title: "AI and Machine Learning Summit",
    category: "Summit",
    date: new Date("2025-09-10"),
    registrationClosesAt: new Date("2025-09-05T23:59:59Z"),
    status: "upcoming",
    createdBy: admin._id,
    participantsCount: 0,
    capacity: 500,
    autoApprove: false,
    description:
      "Dive deep into the world of AI and ML with leading experts from around the globe.",
    location: "Boston, MA",
  },
  {
    title: "Cybersecurity Trends 2024",
    category: "Conference",
    date: new Date("2024-05-12"),
    registrationClosesAt: new Date("2024-05-10T23:59:59Z"),
    status: "upcoming",
    createdBy: admin._id,
    participantsCount: 0,
    capacity: 300,
    autoApprove: false,
    description: "Stay updated on cutting-edge trends in the field of cybersecurity.",
    location: "Seattle, WA",
  },
  {
    title: "Startup Pitch Night",
    category: "Networking",
    date: new Date("2023-12-10"),
    registrationClosesAt: new Date("2023-12-08T23:59:59Z"),
    status: "upcoming",
    createdBy: admin._id,
    participantsCount: 0,
    capacity: 100,
    autoApprove: true,
    description:
      "An evening for networking and pitching startup ideas to investors.",
    location: "Austin, TX",
  },
  {
    title: "Python Beginner's Bootcamp",
    category: "Bootcamp",
    date: new Date("2023-11-20"),
    registrationClosesAt: new Date("2023-11-19T23:59:59Z"),
    status: "upcoming",
    createdBy: admin._id,
    participantsCount: 0,
    capacity: 30,
    autoApprove: false,
    description:
      "Hands-on coding bootcamp for beginners to learn Python programming.",
    location: "Chicago, IL",
  },
  {
    title: "Blockchain 101",
    category: "Workshop",
    date: new Date("2024-03-18"),
    registrationClosesAt: new Date("2024-03-16T23:59:59Z"),
    status: "upcoming",
    createdBy: admin._id,
    participantsCount: 0,
    capacity: 80,
    autoApprove: true,
    description:
      "Introduction to Blockchain technology and how it transforms industries.",
    location: "Miami, FL",
  },
  {
    title: "Serverless Architecture Hackathon",
    category: "Hackathon",
    date: new Date("2025-02-25"),
    registrationClosesAt: new Date("2025-02-23T23:59:59Z"),
    status: "upcoming",
    createdBy: admin._id,
    participantsCount: 0,
    capacity: 150,
    autoApprove: false,
    description:
      "Explore serverless technologies by building innovative projects during this hackathon.",
    location: "Pittsburgh, PA",
  },
  {
    title: "Web Development Trends in 2025",
    category: "Webinar",
    date: new Date("2025-08-05"),
    registrationClosesAt: new Date("2025-08-03T23:59:59Z"),
    status: "upcoming",
    createdBy: admin._id,
    participantsCount: 0,
    capacity: 1000,
    autoApprove: true,
    description:
      "A global webinar discussing the emerging trends in web development for the year 2025.",
    location: "Virtual Online",
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

