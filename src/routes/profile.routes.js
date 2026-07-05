const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile.controller');
const { protect } = require('../middleware/auth.middleware');

// All profile routes require authentication
router.use(protect);

// GET  /api/v1/profile — Fetch own profile (patient or technician)
router.get('/', profileController.getProfile);

// PUT  /api/v1/profile — Update own profile (whitelisted fields only)
router.put('/', profileController.updateProfile);

module.exports = router;
