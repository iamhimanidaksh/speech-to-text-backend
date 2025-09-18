const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { createClient } = require("@deepgram/sdk");
require("dotenv").config();
const mongoose = require("mongoose");
const Transcript = require("./models/transcription.js");

const app = express();

// Allow both localhost and deployed frontend
const corsOptions = {
  origin: [
    "http://localhost:3000", // React dev
    "https://speech-to-text-himani-web.netlify.app", 
  ],
  methods: ["GET", "POST", "DELETE"],
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());

// Multer → keep files in memory
const upload = multer({ storage: multer.memoryStorage() });

// Deepgram client
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

// ================= Test Route =================
app.get("/", (req, res) => {
  res.send("Backend is running and ready");
});

// ================= Transcribe Route =================
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No audio file uploaded" });

    // Allowed audio formats
    const allowedTypes = [
      "audio/webm",
      "audio/webm;codecs=opus",
      "audio/wav",
      "audio/mp3",
      "audio/m4a",
      "audio/ogg",
      "audio/3gpp",
      "audio/mp4",
    ];

    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ error: `Invalid file type: ${req.file.mimetype}` });
    }

    const buffer = req.file.buffer;
    const options = { model: "nova-3", smart_format: true, punctuate: true, language: "en-US" };

    let transcript = "";
    try {
      const { result } = await deepgram.listen.prerecorded.transcribeFile(buffer, options);
      transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";

      if (!transcript.trim()) {
        return res.status(400).json({ error: "⚠️ No speech detected." });
      }
    } catch (err) {
      console.error("Deepgram API error:", err);
      return res.status(500).json({ error: "Error during transcription request." });
    }

    // Save transcript to MongoDB
    const newDoc = new Transcript({ filename: req.file.originalname, transcript });
    await newDoc.save();

    res.json({ success: true, transcript });
  } catch (err) {
    console.error("General error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ================= Get All Transcriptions =================
app.get("/api/transcriptions", async (req, res) => {
  try {
    const all = await Transcript.find().sort({ createdAt: -1 });
    res.json(all);
  } catch (err) {
    console.error("Fetch error:", err);
    res.status(500).json({ error: "Failed to fetch transcripts" });
  }
});

// ================= Delete by ID =================
app.delete("/api/transcriptions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Transcript.findByIdAndDelete(id);

    if (!deleted) return res.status(404).json({ error: "Transcript not found" });

    res.json({ success: true, message: "Transcript deleted" });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: "Failed to delete transcript" });
  }
});

app.delete("/api/transcriptions", async (req, res) => {
    try {
        await Transcript.deleteMany({});
        res.json({ success: true, message: "All transcripts deleted" });
    } catch (err) {
        console.error("All delete error:", err);
        res.status(500).json({ error: "Failed to clear all transcripts" });
    }
});


// ================= MongoDB =================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// ================= Start Server =================
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend running at: http://localhost:${PORT}`);
});
