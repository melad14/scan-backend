const multer = require('multer');

// Store files in memory to easily pipe to MinIO or Local Disk
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedImageMimeTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  const allowedPdfMimeTypes = ['application/pdf'];

  const field = file.fieldname;

  if (field === 'prescription') {
    // Prescriptions can be image or PDF
    if (allowedImageMimeTypes.includes(file.mimetype) || allowedPdfMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const error = new Error('الروشتة يجب أن تكون صورة (JPEG, PNG) أو ملف PDF');
      error.statusCode = 400;
      error.code = 'UPLOAD_001';
      cb(error, false);
    }
  } else if (field === 'reportImage' || field === 'report-image') {
    // Report images must be images only
    if (allowedImageMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const error = new Error('التقرير يجب أن يكون صورة فقط (JPEG, PNG)');
      error.statusCode = 400;
      error.code = 'UPLOAD_001';
      cb(error, false);
    }
  } else if (field === 'reportPdf' || field === 'report-pdf') {
    // Report PDF must be PDF only
    if (allowedPdfMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const error = new Error('الملف المرفوع يجب أن يكون بصيغة PDF');
      error.statusCode = 400;
      error.code = 'UPLOAD_001';
      cb(error, false);
    }
  } else {
    // Default allowed
    cb(null, true);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // Max 50MB (checks global limit, we'll enforce specific limits in controller if needed)
  }
});

module.exports = upload;
