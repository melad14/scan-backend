const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const { authLimiter } = require('../middleware/rateLimiter');

// Rate limited public auth routes
router.post('/send-otp', authLimiter, authController.sendOtp);
router.post('/verify-otp', authLimiter, authController.verifyOtp);
router.post('/register', authLimiter, authController.register);
router.post('/technician/login', authLimiter, authController.loginTechnician);
router.post('/admin/login', authLimiter, authController.loginAdmin);

// Token rotation and logout
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', protect, authController.logout);

module.exports = router;
