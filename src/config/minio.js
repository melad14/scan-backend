const Minio = require('minio');
const env = require('./env');

let minioClient = null;
let useLocalFallback = false;

// If config is set to mock, or if endpoint is not localhost and not configured, use fallback
if (env.minio.endpoint === 'mock' || !env.minio.accessKey || env.minio.accessKey === 'your_key') {
  console.log('🔄 MinIO configured to use local filesystem fallback.');
  useLocalFallback = true;
} else {
  try {
    minioClient = new Minio.Client({
      endPoint: env.minio.endpoint,
      port: env.minio.port,
      useSSL: false,
      accessKey: env.minio.accessKey,
      secretKey: env.minio.secretKey
    });
    console.log('MinIO Client Initialized.');
  } catch (error) {
    console.warn('⚠️ MinIO initialization failed. Falling back to local filesystem:', error.message);
    useLocalFallback = true;
  }
}

module.exports = {
  minioClient,
  useLocalFallback,
  buckets: {
    prescriptions: env.minio.bucketPrescriptions,
    reports: env.minio.bucketReports
  }
};
