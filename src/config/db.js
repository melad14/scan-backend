const mongoose = require('mongoose');
const env = require('./env');

let mongoServer = null;

const connectDB = async () => {
  const connectionUri = env.mongodbUri;
  
  try {
    console.log(`Attempting to connect to MongoDB at: ${connectionUri}`);
    // Try to connect with a short timeout to fail fast if MongoDB is not running
    const conn = await mongoose.connect(connectionUri, {
      serverSelectionTimeoutMS: 3000 // 3 seconds timeout
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.warn(`\n⚠️ Failed to connect to MongoDB at ${connectionUri}: ${error.message}`);
    console.warn('🔄 "Do Everything Yourself" Mode active: Launching an In-Memory MongoDB Server...');

    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      mongoServer = await MongoMemoryServer.create();
      const inMemoryUri = mongoServer.getUri();
      
      console.log(`In-Memory MongoDB Server started successfully.`);
      console.log(`Connecting to In-Memory DB: ${inMemoryUri}`);
      
      const conn = await mongoose.connect(inMemoryUri);
      console.log(`MongoDB (In-Memory) Connected: ${conn.connection.host}`);
      
      // Override the env config so other scripts can access the in-memory URI if needed
      env.mongodbUri = inMemoryUri;
    } catch (inMemError) {
      console.error(`CRITICAL ERROR: Failed to start In-Memory MongoDB: ${inMemError.message}`);
      process.exit(1);
    }
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
