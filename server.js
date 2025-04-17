const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require("./routes/auth.routes");
const eventRoutes = require("./routes/event.routes");
const participantRoutes = require("./routes/participant.routes");
const userRoutes = require("./routes/user.routes");
const analyticsRoutes = require("./routes/analytics.routes");

// Import DB initialization script
const { initializeDatabase } = require("./config/db.init");

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI 

// CORS Options to allow credentials and specific origins
const allowedOrigins = [
  "http://localhost:5173",
  "https://events-frontend-chi.vercel.app",
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error("Not allowed by CORS"));
    }
  },
  methods: "GET,POST,PUT,DELETE",
  allowedHeaders: "Content-Type, Authorization",
  credentials: true,
};

// Middleware
app.use(cors(corsOptions)); // Use the defined CORS options
app.use(bodyParser.json());

// Connect to MongoDB
try {
  mongoose
    .connect(MONGODB_URI)
    .then(() => {
      console.log("✅ Connected to MongoDB");
      // Initialize database with dummy data if needed
      if (process.env.NODE_ENV !== "production") {
        initializeDatabase();
      }
    })
    .catch((err) => {
      console.error("❌ MongoDB connection error:", err);
      process.exit(1);
    });
} catch (error) {
  console.error("❌ Error connecting to MongoDB:", error);
  process.exit(1);
}

app.get("/", (req, res) => {
  res.send("Hello from the backend!");
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api", participantRoutes); // Contains nested routes for participants
app.use("/api/users", userRoutes);
app.use("/api/analytics", analyticsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});

// Start server
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

module.exports = app;
