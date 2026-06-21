const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Order = require('../models/Order');
const Technician = require('../models/Technician');
const technicianController = require('../controllers/technician.controller');

const testGetActive = async () => {
  try {
    await connectDB();

    const tech = await Technician.findOne({ phone: '01012345678' });
    console.log('Technician ID:', tech._id);

    // Call getActiveOrder
    const req = {
      user: { id: tech._id.toString(), role: 'technician' }
    };

    let responseData = null;
    const res = {
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        responseData = data;
        return this;
      }
    };

    await technicianController.getActiveOrder(req, res);
    console.log('Response Status Code:', res.statusCode);
    console.log('Response Data:', JSON.stringify(responseData, null, 2));

    // Also let's inspect the order document directly
    const orderDirect = await Order.findOne({
      technician: tech._id,
      status: { $in: ['assigned', 'on_way', 'arrived', 'in_progress'] }
    });
    console.log('Order Direct search by ObjectId:', orderDirect ? orderDirect._id : 'Not Found');

    const orderDirectStr = await Order.findOne({
      technician: tech._id.toString(),
      status: { $in: ['assigned', 'on_way', 'arrived', 'in_progress'] }
    });
    console.log('Order Direct search by String ID:', orderDirectStr ? orderDirectStr._id : 'Not Found');

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

testGetActive();
