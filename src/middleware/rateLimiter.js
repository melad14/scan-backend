const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 requests
  message: {
    success: false,
    message: 'لقد تجاوزت الحد المسموح به من الطلبات لتسجيل الدخول. يرجى المحاولة بعد قليل.',
    code: 'RATE_LIMIT_EXCEEDED',
    statusCode: 429
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // 30 uploads per hour per IP
  message: {
    success: false,
    message: 'لقد تجاوزت الحد المسموح به لرفع الملفات.',
    code: 'RATE_LIMIT_EXCEEDED',
    statusCode: 429
  },
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requests per 15 minutes
  message: {
    success: false,
    message: 'لقد تجاوزت الحد المسموح به للطلبات.',
    code: 'RATE_LIMIT_EXCEEDED',
    statusCode: 429
  },
});

module.exports = {
  authLimiter,
  uploadLimiter,
  generalLimiter
};
