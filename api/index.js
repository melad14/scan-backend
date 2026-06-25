const app = require('../src/app');
const connectDB = require('../src/config/db');
const autoSeed = require('../src/scripts/autoSeed');

let dbConnected = false;

// Middleware to ensure DB connection and auto-seeding
app.use(async (req, res, next) => {
  if (!dbConnected) {
    try {
      await connectDB();
      await autoSeed();
      dbConnected = true;
    } catch (err) {
      console.error('Database connection error in Vercel function:', err);
      return res.status(503).json({
        success: false,
        message: 'تأخر في الاستجابة من الخادم، يرجى المحاولة مرة أخرى لاحقاً',
        errorDetails: err.message,
        code: 'DB_CONNECTION_ERROR'
      });
    }
  }
  next();
});

module.exports = app;
