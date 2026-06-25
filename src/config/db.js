const mongoose = require('mongoose');
const env = require('./env');

let mongoServer = null;

const connectDB = async () => {
  const connectionUri = env.mongodbUri;
  
  try {
    console.log(`Attempting to connect to MongoDB at: ${connectionUri}`);
    // Increased timeout for Vercel cold starts
    const conn = await mongoose.connect(connectionUri, {
      serverSelectionTimeoutMS: 15000
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`\n⚠️ Failed to connect to MongoDB: ${error.message}`);
    // We throw the error so that api/index.js catches it and returns 503 instead of falling back to MongoMemoryServer which causes issues on Vercel
    throw error;
  }
};

// Gracefully close connection and stop memory server on exit
const closeDB = async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
    console.log('In-Memory MongoDB Server stopped.');
  }
};

module.exports = connectDB;
// Expose closeDB for cleanup in server or scripts
module.exports.closeDB = closeDB;
