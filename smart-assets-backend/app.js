const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http'); // Required for Socket.IO
const { Server } = require('socket.io'); // Import Socket.IO
const videoRoutes = require('./routes/videoRoutes');
const path = require('path');

dotenv.config();
const app = express();

// Create HTTP Server
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
    cors: {
        origin: '*', // Allow requests from all origins (adjust as needed)
        methods: ['GET', 'POST'],
    },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads')); // Serve static files from "uploads" folder

// Serve static files from "processed" inside the "uploads" folder
app.use('/processed', express.static(path.join(__dirname, 'uploads', 'processed')));

// MongoDB Connection
mongoose
    .connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => console.log('MongoDB connected successfully!'))
    .catch((err) => console.error('MongoDB Connection Error:', err));

// Routes (pass `io` to routes so they can emit events)
app.use('/api/videos', videoRoutes(io));

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
