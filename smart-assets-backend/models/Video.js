const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
    filename: { type: String, required: true },
    uploadPath: { type: String, required: true },
    processedPath: { type: String, required: false },
    status: { type: String, enum: ['uploaded', 'processing', 'processed'], default: 'uploaded' },
    uploadedAt: { type: Date, default: Date.now },
    processedAt: { type: Date },
    detectedObjects: { type: Array, default: [] }, // Store detected objects, if applicable
});

module.exports = mongoose.model('Video', videoSchema);