const mongoose = require('mongoose');
const env = require('./env');

let mongoServer = null;

let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    console.log(`Attempting to connect to MongoDB at: ${env.mongodbUri}`);
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 15000,
    };
    cached.promise = mongoose.connect(env.mongodbUri, opts).then((mongoose) => {
      console.log(`MongoDB Connected`);
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    console.error(`\n⚠️ Failed to connect to MongoDB: ${error.message}`);
    throw error;
  }
  
  return cached.conn;
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
