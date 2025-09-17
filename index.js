// backend/index.js

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@deepgram/sdk'); // Deepgram SDK
require('dotenv').config();
const mongoose = require('mongoose');
const Transcript = require('./models/transcription.js');


const app = express();
app.use(cors()); // allow requests from your frontend in dev
app.use(express.json());

// 1) Configure multer to store uploaded file in memory
const upload = multer({ storage: multer.memoryStorage() });

// 2) Create Deepgram client (uses API key from .env)
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

// 3) Simple test route
app.get('/', (req, res) => {
  res.send('Hello from backend 🔊');
});


app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });

    const allowedTypes = ["audio/webm", "audio/wav", "audio/mp3"];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ error: 'Invalid file type. Only webm, wav, mp3 allowed.' });
    }


    const buffer = req.file.buffer;

    // send to Deepgram
     let transcript = ""; // declare outside try so accessible later
    const options = { model: 'nova-3', smart_format: true, punctuate: true };

    try {
      const { result } = await deepgram.listen.prerecorded.transcribeFile(buffer, options);

      transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";

      if (!transcript) {
        return res.status(500).json({ error: 'Transcription failed, no text returned.' });
      }
    } catch (err) {
      console.error('Deepgram API error:', err);
      return res.status(500).json({ error: 'Server error during transcription' });
    }


    // Save to MongoDB
    const newDoc = new Transcript({
      filename: req.file.originalname,
      transcript
    });
    await newDoc.save();

    res.json({ success: true, transcript });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// get all transcripts (latest first)
app.get('/api/transcriptions', async (req, res) => {
  try {
    const all = await Transcript.find().sort({ createdAt: -1 });
    res.json(all);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transcripts' });
  }
});

// Delete a transcript by ID
app.delete('/api/transcriptions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Transcript.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: 'Transcript not found' });

    res.json({ success: true, message: 'Transcript deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete transcript' });
  }
});





// connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));


// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
