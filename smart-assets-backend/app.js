const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const videoRoutes = require('./routes/videoRoutes');
const path = require('path');

dotenv.config();
const app = express();

// Create HTTP Server
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
    cors: {
        origin: '*', // Allow all origins (adjust in production)
        methods: ['GET', 'POST'],
    },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use('/processed', express.static(path.join(__dirname, 'uploads', 'processed')));
app.use('/videos', express.static(path.join(__dirname, 'videos'))); // Expose videos folder

// MongoDB Connection
mongoose
    .connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => console.log('MongoDB connected successfully!'))
    .catch((err) => console.error('MongoDB Connection Error:', err));

// Routes
app.use('/api/videos', videoRoutes(io));

// Health Check Endpoint
app.get('/health', (req, res) => {
    res.status(200).send('Server is running!');
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
