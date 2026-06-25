const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Technician = require('../models/Technician');
require('dotenv').config({ path: '../../.env' }); // Adjust if needed

const insertTech = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://fadyashraf909_db_user:8sl6AHN8t4c8dPi3@ac-yqp0xsc-shard-00-00.zy6ivlx.mongodb.net:27017,ac-yqp0xsc-shard-00-01.zy6ivlx.mongodb.net:27017,ac-yqp0xsc-shard-00-02.zy6ivlx.mongodb.net:27017/ScanGo?ssl=true&authSource=admin';
    await mongoose.connect(mongoUri);

    const phone = '01000000000';
    const existing = await Technician.findOne({ phone });
    if (existing) {
      console.log('Technician already exists:', existing);
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash('123456', 10);
    const tech = new Technician({
      name: 'فني تجريبي',
      phone,
      passwordHash,
      nationalId: '12345678901234',
      region: 'القاهرة',
    });

    await tech.save();
    console.log('Technician created successfully:');
    console.log('Phone:', phone);
    console.log('Password: 123456');

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

insertTech();
