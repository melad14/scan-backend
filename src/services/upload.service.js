const crypto = require('crypto');
const path = require('path');

/**
 * MOCK Upload Service
 * Returns a placeholder URL without writing anything to disk.
 * TODO: Replace with real cloud storage (MinIO / Firebase / S3) before production deploy.
 *
 * @param {Object} file Multer file object
 * @param {string} bucketType 'prescriptions' or 'reports'
 * @returns {Promise<string>} Placeholder URL
 */
exports.uploadFile = async (file, bucketType) => {
  const fileExt = path.extname(file.originalname);
  const randomName = crypto.randomBytes(16).toString('hex');
  const fileName = `${randomName}${fileExt}`;

  // Generate a mock URL — nothing is saved
  const mockUrl = `https://placeholder.scango.mock/uploads/${bucketType}/${fileName}`;

  console.log(`[MOCK UPLOAD] Simulated upload for ${file.originalname} (${(file.size / 1024).toFixed(1)} KB) -> ${mockUrl}`);
  return mockUrl;
};
