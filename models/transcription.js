const mongoose = require('mongoose');

// Mongo schema for transcripts
const transcriptSchema = new mongoose.Schema({
  filename: String,
  transcript: String,
  createdAt: { type: Date, default: Date.now }
});

// Model (represents a collection in MongoDB)
module.exports = mongoose.model('Transcript', transcriptSchema);
