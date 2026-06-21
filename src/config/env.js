require('dotenv').config();

const requiredEnv = [
  'MONGODB_URI',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET'
];

// Check required variables
const missing = requiredEnv.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error(`CRITICAL ERROR: Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  mongodbUri: process.env.MONGODB_URI,
  
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '30d'
  },
  
  minio: {
    endpoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    bucketPrescriptions: process.env.MINIO_BUCKET_PRESCRIPTIONS || 'prescriptions',
    bucketReports: process.env.MINIO_BUCKET_REPORTS || 'reports'
  },
  
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL
  },
  
  sms: {
    apiKey: process.env.SMS_API_KEY || 'mock',
    senderId: process.env.SMS_SENDER_ID || 'ScanGo'
  },
  
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    verifyServiceSid: process.env.TWILIO_VERIFY_SERVICE_SID
  },
  
  features: {
    realtimeTracking: process.env.REALTIME_TRACKING_ENABLED === 'true',
    whatsapp: process.env.WHATSAPP_ENABLED === 'true',
    electronicPayments: process.env.ELECTRONIC_PAYMENTS_ENABLED === 'true'
  }
};
