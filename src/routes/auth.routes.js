const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const { authLimiter } = require('../middleware/rateLimiter');

// ─── Patient Auth (Username + Password) ──────────────────────────────────────
router.post('/patient/register', authLimiter, authController.registerPatient);
router.post('/patient/login', authLimiter, authController.loginPatient);

// ─── Technician Auth (Phone + Password) ──────────────────────────────────────
router.post('/technician/login', authLimiter, authController.loginTechnician);

// ─── Admin Auth (Email + Password) ───────────────────────────────────────────
router.post('/admin/login', authLimiter, authController.loginAdmin);

// ─── OTP (Kept for future use / tech SMS flows) ───────────────────────────────
router.post('/send-otp', authLimiter, authController.sendOtp);
router.post('/verify-otp', authLimiter, authController.verifyOtp);

// ─── Token Rotation & Logout ─────────────────────────────────────────────────
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', protect, authController.logout);
router.put('/fcm-token', protect, authController.updateFcmToken);

module.exports = router;
