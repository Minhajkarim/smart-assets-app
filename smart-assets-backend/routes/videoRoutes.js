const express = require("express");
const multer = require("multer");
const { PythonShell } = require("python-shell");
const path = require("path");
const fs = require("fs");
const Video = require("../models/Video"); // Import the Video model

module.exports = (io) => {
  const router = express.Router();

  // Set up Multer for file uploads
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, "../uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    },
  });
  const upload = multer({ storage });

  // Upload and process video
  router.post("/upload", upload.single("video"), async (req, res) => {
    try {
      if (!req.file || !req.file.path) {
        return res
          .status(400)
          .send({ error: "No file uploaded or invalid file." });
      }

      const videoPath = path.resolve(req.file.path);
      const filename = req.file.filename;
      const fileExtension = path.extname(filename);
      const baseFilename = path.basename(filename, fileExtension);
      const processedFilename = `${baseFilename}-output.mp4`;

      console.log("Uploaded video path:", videoPath);

      // Create a new video document in MongoDB with status "uploaded"
      const video = new Video({
        filename,
        uploadPath: videoPath.replace(/\\/g, "/"),
        status: "uploaded",
      });

      await video.save();

      // Emit the initial upload status to the client
      io.emit("processingUpdate", {
        progress: 0,
        message: "Processing started.",
      });

      // Set up Python script options
      const options = {
        mode: "text",
        pythonOptions: ["-u"],
        scriptPath: path.join(__dirname, ".."),
        args: [videoPath],
      };

      const pyshell = new PythonShell("processVideo.py", options);
      let detectedObjects = [];

      // Handle messages from the Python script
      pyshell.on("message", (message) => {
        console.log("Python script message:", message);
        try {
          const update = JSON.parse(message);

          if (update.progress) {
            io.emit("processingUpdate", update);
          }
          if (update.detectedObjects) {
            detectedObjects = update.detectedObjects; // Collect detected objects
          }
        } catch (err) {
          console.error("Failed to parse progress update:", err);
        }
      });

      // Handle errors from the Python script
      pyshell.on("stderr", (stderr) => {
        console.error("Python script error output:", stderr);
      });

      // End of Python script execution
      pyshell.end(async (err) => {
        if (err) {
          console.error("Error during video processing:", err);
          io.emit("processingUpdate", {
            progress: 100,
            message: "Processing failed.",
          });

          // Update video status in the database
          video.status = "processing_failed";
          await video.save();

          return res.status(500).send({ error: "Video processing failed!" });
        }

        console.log("Python script finished successfully.");

        try {
          // Ensure the videos folder exists
          const videosDir = path.join(__dirname, "../videos");
          if (!fs.existsSync(videosDir)) {
            fs.mkdirSync(videosDir, { recursive: true });
          }

          // Path to the processed video file
          const processedVideoPath = path.join(videosDir, processedFilename);
          const publicProcessedPath = `/videos/${processedFilename}`; // Relative URL for the processed video

          // Update video document in MongoDB
          video.status = "processed";
          video.processedPath = publicProcessedPath;
          video.processedAt = new Date();
          video.detectedObjects = detectedObjects;
          await video.save();

          io.emit("processingUpdate", {
            progress: 100,
            message: "Processing completed!",
          });

          res.status(200).send({
            message: "Video uploaded and processed successfully!",
            videoId: video._id, // Return video ID
            processedVideo: publicProcessedPath,
            detectedObjects,
          });
        } catch (parseError) {
          console.error("Failed to parse Python script output:", parseError);
          io.emit("processingUpdate", {
            progress: 100,
            message: "Processing failed: Invalid output.",
          });

          video.status = "processing_failed";
          await video.save();

          res.status(500).send({ error: "Invalid output from Python script." });
        }
      });
    } catch (error) {
      console.error("Error:", error);
      io.emit("processingUpdate", {
        progress: 100,
        message: "An error occurred during processing.",
      });
      res
        .status(500)
        .send({ error: "An error occurred during video processing." });
    }
  });

  // Fetch video details by ID
  router.get("/:id", async (req, res) => {
    try {
      const video = await Video.findById(req.params.id);
      if (!video) {
        return res.status(404).send({ error: "Video not found." });
      }
      res.status(200).send(video);
    } catch (error) {
      console.error("Error fetching video details:", error);
      res.status(500).send({ error: "Error fetching video details." });
    }
  });

  // Serve processed video files with Range support
  router.get("/videos/:filename", (req, res) => {
    const filePath = path.join(__dirname, "..", "videos", req.params.filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).send({ error: "File not found." });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      const chunkSize = end - start + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": "video/mp4",
        "Access-Control-Allow-Origin": "*",
        "Cross-Origin-Resource-Policy": "cross-origin",
      };

      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        "Content-Length": fileSize,
        "Content-Type": "video/mp4",
        "Access-Control-Allow-Origin": "*",
        "Cross-Origin-Resource-Policy": "cross-origin",
      };

      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  });

  // Fetch all processed videos
  router.get("/", async (req, res) => {
    try {
      const videos = await Video.find({ status: "processed" }); // Fetch only processed videos
      res.status(200).send(videos);
    } catch (error) {
      console.error("Error fetching processed videos:", error);
      res.status(500).send({ error: "Error fetching processed videos." });
    }
  });

  return router;
};
