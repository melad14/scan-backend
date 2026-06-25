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
