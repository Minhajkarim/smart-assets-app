const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");
const videoRoutes = require("./routes/videoRoutes");
const path = require("path");
const Video = require("./models/Video"); // Import Video model to save the processed path

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Create HTTP server for Express
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "https://psd.smartassets.ae/"], // Replace with your frontend domains
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  },
});

// Middleware
app.use(
  cors({
    origin: ["http://localhost:3000", "https://psd.smartassets.ae/"], // Replace with your frontend domains
    credentials: true,
  })
);
app.use(express.json());

// Serve static files
app.use("/uploads", express.static(path.resolve(__dirname, "uploads")));
app.use(
  "/processed",
  express.static(path.resolve(__dirname, "uploads", "processed"))
);
app.use("/videos", express.static(path.resolve(__dirname, "videos"))); // Expose videos folder

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected successfully!"))
  .catch((err) => {
    console.error("MongoDB Connection Error:", err);
    process.exit(1); // Exit if MongoDB connection fails
  });

// Routes
app.use("/api/videos", videoRoutes(io));

// Health Check Endpoint
app.get("/health", (req, res) => {
  res.status(200).send("Server is running!");
});

// Socket.IO Listeners
io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Listen for frame data and simulate object detection (for testing)
  socket.on("frameData", (data) => {
    console.log("Frame data received:", data);

    // Emit a simulated object detection result (replace with actual logic)
    socket.emit("objectDetection", {
      objects: [{ label: "Person", x: 100, y: 150, width: 50, height: 100 }],
    });
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
