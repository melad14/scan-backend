const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Order = require('../models/Order');
const Technician = require('../models/Technician');
const User = require('../models/User');

const checkDB = async () => {
  try {
    console.log('Connecting to database...');
    await connectDB();

    console.log('\n--- Technicians in DB ---');
    const techs = await Technician.find({});
    techs.forEach(t => {
      console.log(`ID: ${t._id} | Name: ${t.name} | Phone: ${t.phone} | Region: ${t.region} | Available: ${t.isAvailable} | Active: ${t.isActive}`);
    });

    console.log('\n--- Orders in DB ---');
    const orders = await Order.find({});
    if (orders.length === 0) {
      console.log('No orders found.');
    } else {
      orders.forEach(o => {
        console.log(`OrderNum: ${o.orderNumber} | ID: ${o._id} | Status: ${o.status} | Tech Assigned: ${o.technician} | Patient: ${o.patientSnapshot?.name} (${o.patientSnapshot?.phone}) | Region: ${o.location?.district}`);
      });
    }

    process.exit(0);
  } catch (err) {
    console.error('Error checking DB:', err);
    process.exit(1);
  }
};

checkDB();
