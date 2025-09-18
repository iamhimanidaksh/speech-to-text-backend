// backend/index.js

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { createClient } = require("@deepgram/sdk"); // Deepgram SDK
require("dotenv").config();
const mongoose = require("mongoose");
const Transcript = require("./models/transcription.js");

const app = express();

// Enable CORS so frontend (React) can talk to backend
app.use(cors());
app.use(express.json());

// Multer config  store uploaded files in memory (not disk)
const upload = multer({ storage: multer.memoryStorage() });

// Deepgram client uses API key from .env
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

// Test route
app.get("/", (req, res) => {
  res.send("Hello from backend 🔊");
});

// Route: Transcribe audio file
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file uploaded" });
    }

    // Restrict file types → safer & avoids unsupported formats
    const allowedTypes = ["audio/webm", "audio/wav", "audio/mp3", "audio/m4a"];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        error: "Invalid file type. Allowed: webm, wav, mp3, m4a",
      });
    }

    // File buffer in memory
    const buffer = req.file.buffer;

    // Deepgram transcription options
    const options = {
      model: "nova-3", // latest, accurate model
      smart_format: true,
      punctuate: true,
    };

    let transcript = "";

    try {
      // Deepgram API call
      const { result } = await deepgram.listen.prerecorded.transcribeFile(
        buffer,
        options
      );

      transcript =
        result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";

      if (!transcript.trim()) {
        return res
          .status(400)
          .json({ error: "No speech detected or transcription empty." });
      }
    } catch (err) {
      console.error("Deepgram API error:", err);
      return res
        .status(500)
        .json({ error: "Server error during transcription" });
    }

    // Save transcript in MongoDB
    const newDoc = new Transcript({
      filename: req.file.originalname,
      transcript,
    });
    await newDoc.save();

    // Success response
    res.json({ success: true, transcript });
  } catch (err) {
    console.error("General error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Route: Get all transcripts (sorted by latest first)
app.get("/api/transcriptions", async (req, res) => {
  try {
    const all = await Transcript.find().sort({ createdAt: -1 });
    res.json(all);
  } catch (err) {
    console.error("Fetch error:", err);
    res.status(500).json({ error: "Failed to fetch transcripts" });
  }
});

// Route: Delete a transcript by ID
app.delete("/api/transcriptions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Transcript.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ error: "Transcript not found" });
    }

    res.json({ success: true, message: "Transcript deleted" });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: "Failed to delete transcript" });
  }
});

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend running at: http://localhost:${PORT}`);
});
