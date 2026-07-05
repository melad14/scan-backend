const path = require('path');
const express = require('express');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');
const connectDB = require('./config/db');
const autoSeed = require('./scripts/autoSeed');

const app = express();

// Trust reverse proxy (required for Vercel & express-rate-limit)
app.set('trust proxy', 1);

// Standard middlewares
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, postman, curl)
    if (!origin) return callback(null, true);

    // Echo back the requesting origin to prevent CORS blocking local environments or mobile apps
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Simple healthcheck route (no DB needed)
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: `Server is running on port ${env.port} in ${env.nodeEnv} mode`,
    timestamp: new Date()
  });
});

// DB Connection middleware - MUST be before all routes
app.use(async (req, res, next) => {
  try {
    await connectDB();
    await autoSeed();
  } catch (err) {
    console.error('Database connection error:', err);
    return res.status(503).json({
      success: false,
      message: 'تأخر في الاستجابة من الخادم، يرجى المحاولة مرة أخرى لاحقاً',
      errorDetails: err.message,
      code: 'DB_CONNECTION_ERROR'
    });
  }
  next();
});

// Route files imports
const authRoutes = require('./routes/auth.routes');
const orderRoutes = require('./routes/orders.routes');
const serviceRoutes = require('./routes/services.routes');
const techRoutes = require('./routes/technician.routes');
const adminRoutes = require('./routes/admin.routes');
const uploadRoutes = require('./routes/upload.routes');
const profileRoutes = require('./routes/profile.routes');

// Mount routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/services', serviceRoutes);
app.use('/api/v1/technician', techRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/profile', profileRoutes);

// Catch-all route for unmatched paths (404)
app.use((req, res, next) => {
  const error = new Error('لم يتم العثور على المسار المطلوب');
  error.statusCode = 404;
  error.code = 'NOT_FOUND';
  next(error);
});

// Centralized error handler
app.use(errorHandler);

module.exports = app;
