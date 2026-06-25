let app;
let connectDB;
let autoSeed;

try {
  app = require('../src/app');
  connectDB = require('../src/config/db');
  autoSeed = require('../src/scripts/autoSeed');
} catch (initError) {
  // If initialization fails (e.g. missing env vars), return a meaningful error
  const express = require('express');
  const fallbackApp = express();
  fallbackApp.use((req, res) => {
    res.status(503).json({
      success: false,
      message: 'فشل تهيئة السيرفر',
      errorDetails: initError.message,
      code: 'SERVER_INIT_ERROR'
    });
  });
  module.exports = fallbackApp;
  // Stop execution here
  return;
}

// DEBUG ENDPOINT - shows exact connection error (remove in production)
app.get('/debug', async (req, res) => {
  try {
    await connectDB();
    res.json({ success: true, message: 'DB Connected OK', uri: process.env.MONGODB_URI ? process.env.MONGODB_URI.replace(/:([^@]+)@/, ':***@') : 'NOT SET' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, uri: process.env.MONGODB_URI ? process.env.MONGODB_URI.replace(/:([^@]+)@/, ':***@') : 'NOT SET' });
  }
});

// Middleware to ensure DB connection and auto-seeding on every request (Vercel serverless pattern)
app.use(async (req, res, next) => {
  try {
    await connectDB();
    await autoSeed();
  } catch (err) {
    console.error('Database connection error in Vercel function:', err);
    return res.status(503).json({
      success: false,
      message: 'تأخر في الاستجابة من الخادم، يرجى المحاولة مرة أخرى لاحقاً',
      errorDetails: err.message,
      code: 'DB_CONNECTION_ERROR'
    });
  }
  next();
});

module.exports = app;
