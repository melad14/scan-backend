const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { minioClient, useLocalFallback, buckets } = require('../config/minio');
const env = require('../config/env');

// Ensure local upload directory exists for fallback (with fallback to /tmp if read-only filesystem)
let localUploadDir = path.join(__dirname, '../../public/uploads');
try {
  if (!fs.existsSync(localUploadDir)) {
    fs.mkdirSync(localUploadDir, { recursive: true });
  }
} catch (err) {
  console.warn(`⚠️ Unable to create local upload directory at ${localUploadDir}, falling back to /tmp/uploads:`, err.message);
  localUploadDir = '/tmp/uploads';
  try {
    if (!fs.existsSync(localUploadDir)) {
      fs.mkdirSync(localUploadDir, { recursive: true });
    }
  } catch (tmpErr) {
    console.error('CRITICAL: Unable to write to /tmp directory:', tmpErr.message);
  }
}

/**
 * Uploads a file buffer to MinIO or writes it to local filesystem fallback.
 * @param {Object} file Multer file object
 * @param {string} bucketType 'prescriptions' or 'reports'
 * @returns {Promise<string>} Public URL of the uploaded file
 */
exports.uploadFile = async (file, bucketType) => {
  const bucketName = buckets[bucketType] || 'general';
  const fileExt = path.extname(file.originalname);
  const randomName = crypto.randomBytes(16).toString('hex');
  const fileName = `${bucketType}/${randomName}${fileExt}`;

  // 1. Local Fallback Mode
  if (useLocalFallback) {
    const subFolder = path.join(localUploadDir, bucketType);
    if (!fs.existsSync(subFolder)) {
      fs.mkdirSync(subFolder, { recursive: true });
    }

    const localFilePath = path.join(localUploadDir, fileName);
    fs.writeFileSync(localFilePath, file.buffer);
    
    // Return relative URL for static serving
    const publicUrl = `http://localhost:${env.port}/uploads/${fileName}`;
    console.log(`[LOCAL UPLOAD fallback] File saved: ${localFilePath} -> URL: ${publicUrl}`);
    return publicUrl;
  }

  // 2. MinIO Mode
  try {
    // Ensure bucket exists
    const bucketExists = await minioClient.bucketExists(bucketName);
    if (!bucketExists) {
      await minioClient.makeBucket(bucketName);
      console.log(`Created MinIO bucket: ${bucketName}`);
    }

    // Upload object
    await minioClient.putObject(
      bucketName,
      fileName,
      file.buffer,
      file.size,
      { 'Content-Type': file.mimetype }
    );

    // Generate presigned URL valid for 1 year (365 days = 31536000 seconds)
    const presignedUrl = await minioClient.presignedGetObject(
      bucketName,
      fileName,
      365 * 24 * 60 * 60
    );

    console.log(`[MinIO UPLOAD] File uploaded successfully. Presigned URL generated.`);
    return presignedUrl;
  } catch (error) {
    console.error('MinIO upload error, attempting local fallback:', error.message);
    
    // Save to local as emergency fallback
    const subFolder = path.join(localUploadDir, bucketType);
    if (!fs.existsSync(subFolder)) {
      fs.mkdirSync(subFolder, { recursive: true });
    }
    const localFilePath = path.join(localUploadDir, fileName);
    fs.writeFileSync(localFilePath, file.buffer);
    
    return `http://localhost:${env.port}/uploads/${fileName}`;
  }
};
