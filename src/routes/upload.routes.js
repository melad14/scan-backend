const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/upload.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

// Upload prescription (Patient only)
router.post(
  '/prescription',
  protect,
  authorize('patient'),
  upload.single('prescription'),
  uploadController.uploadPrescription
);

// Upload report images (Technician only)
router.post(
  '/report-images',
  protect,
  authorize('technician'),
  upload.array('reportImage', 10), // Allow up to 10 images at once
  uploadController.uploadReportImages
);

// Upload report PDF (Technician only)
router.post(
  '/report-pdf',
  protect,
  authorize('technician'),
  upload.single('reportPdf'),
  uploadController.uploadReportPdf
);

module.exports = router;
