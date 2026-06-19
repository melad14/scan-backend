const rateLimit = require('express-rate-limit');

// Rate limit for OTP generation and authentication endpoints (10 requests per 1 minute)
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    success: false,
    message: 'لقد تجاوزت الحد المسموح به من الطلبات. يرجى المحاولة بعد دقيقة.',
    code: 'AUTH_002',
    statusCode: 429
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

module.exports = {
  authLimiter
};
