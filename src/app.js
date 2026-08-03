const path = require('path');
const express = require('express');
const { generalLimiter } = require('./middleware/rateLimiter');
const cors = require('cors');
const helmet = require('helmet');
const errorHandler = require('./middleware/errorHandler');
const connectDB = require('./config/db');

const app = express();

// Trust reverse proxy (required for Vercel & express-rate-limit)
app.set('trust proxy', 1);

const allowedOrigins = [
  'https://scango-dashboard.vercel.app',
  'http://localhost:5173', // Vite default port
  process.env.DASHBOARD_URL
].filter(Boolean);

// Standard middlewares
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, postman, curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed by policy'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(generalLimiter);

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

// DB Connection middleware is removed; handled in server.js/api entry

// Route files imports
const authRoutes = require('./routes/auth.routes');
const orderRoutes = require('./routes/orders.routes');
const serviceRoutes = require('./routes/services.routes');
const techRoutes = require('./routes/technician.routes');
const adminRoutes = require('./routes/admin.routes');
const uploadRoutes = require('./routes/upload.routes');
const profileRoutes = require('./routes/profile.routes');
const savedPatientRoutes = require('./routes/savedPatient.routes');
const savedAddressRoutes = require('./routes/savedAddress.routes');
const categoryRoutes = require('./routes/category.routes');
const complaintsRoutes = require('./routes/complaints.routes');
const notificationsRoutes = require('./routes/notifications.routes');

// Mount routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/services', serviceRoutes);
app.use('/api/v1/technician', techRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/profile', profileRoutes);
app.use('/api/v1/patients/saved', savedPatientRoutes);
app.use('/api/v1/addresses/saved', savedAddressRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/complaints', complaintsRoutes);
app.use('/api/v1/notifications', notificationsRoutes);

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
