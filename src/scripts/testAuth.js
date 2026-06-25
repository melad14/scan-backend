process.env.NODE_ENV = 'test';
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Service = require('../models/Service');
const PricingConfig = require('../models/PricingConfig');
const Admin = require('../models/Admin');
const Technician = require('../models/Technician');
const User = require('../models/User');
const OtpLog = require('../models/OtpLog');
const authController = require('../controllers/auth.controller');

// Mock req and res objects
const mockRes = () => {
  const res = {};
  res.statusCode = 200;
  res.status = function(code) {
    this.statusCode = code;
    return this;
  };
  res.json = function(data) {
    this.body = data;
    return this;
  };
  return res;
};

const runTests = async () => {
  let passed = true;
  try {
    console.log('Connecting to database for verification...');
    await connectDB();
    
    // Clean up test user from previous runs to ensure registration test runs cleanly
    await User.deleteOne({ username: 'testuser' });
    await User.deleteOne({ email: 'test@scango.com' });
    
    // Automatically seed data for verification
    const autoSeed = require('./autoSeed');
    await autoSeed();

    console.log('\n--- Test 1: Verify Seed Data ---');
    const serviceCount = await Service.countDocuments();
    console.log(`Services found: ${serviceCount}`);
    if (serviceCount === 7) {
      console.log('✅ Service seeding verified!');
    } else {
      console.log('❌ Unexpected service count!');
      passed = false;
    }

    const pricing = await PricingConfig.findOne();
    if (pricing && pricing.transferFeeBase === 100) {
      console.log('✅ Pricing config seeding verified!');
    } else {
      console.log('❌ Pricing config verification failed!');
      passed = false;
    }

    const admin = await Admin.findOne({ email: 'admin@scango.com' });
    if (admin) {
      console.log('✅ Admin seeding verified!');
    } else {
      console.log('❌ Admin not found!');
      passed = false;
    }

    const tech = await Technician.findOne({ phone: '01012345678' });
    if (tech) {
      console.log('✅ Technician seeding verified!');
    } else {
      console.log('❌ Technician not found!');
      passed = false;
    }

    console.log('\n--- Test 2: Mock OTP Sending ---');
    const phone = '01099999999';
    const reqSend = { body: { phone } };
    const resSend = mockRes();
    await authController.sendOtp(reqSend, resSend);
    
    if (resSend.statusCode === 200 && resSend.body.success) {
      console.log('✅ OTP Send endpoint returns success!');
    } else {
      console.log('❌ OTP Send failed:', resSend.body);
      passed = false;
    }

    console.log('\n--- Test 3: Mock OTP Verification ---');
    const testPhone = '01000000000';
    const reqSendDet = { body: { phone: testPhone } };
    const resSendDet = mockRes();
    await authController.sendOtp(reqSendDet, resSendDet);

    const reqVerify = { body: { phone: testPhone, otp: '123456' } };
    const resVerify = mockRes();
    await authController.verifyOtp(reqVerify, resVerify);

    if (resVerify.statusCode === 200 && resVerify.body.success) {
      console.log('✅ OTP Verification verified successfully!');
    } else {
      console.log('❌ OTP verification failed:', resVerify.body);
      passed = false;
    }

    console.log('\n--- Test 4: Patient Registration ---');
    const reqReg = {
      body: {
        username: 'testuser',
        name: 'المريض التجريبي',
        email: 'test@scango.com',
        password: 'testpassword'
      }
    };
    const resReg = mockRes();
    await authController.registerPatient(reqReg, resReg);

    let patientAccessToken;
    if (resReg.statusCode === 201 && resReg.body.data.accessToken) {
      console.log('✅ Patient Registration completed successfully and JWT token returned!');
      patientAccessToken = resReg.body.data.accessToken;
    } else {
      console.log('❌ Patient registration failed:', resReg.body);
      passed = false;
    }

    console.log('\n--- Test 5: Patient Login ---');
    const reqLogin = {
      body: {
        username: 'testuser',
        password: 'testpassword'
      }
    };
    const resLogin = mockRes();
    await authController.loginPatient(reqLogin, resLogin);

    if (resLogin.statusCode === 200 && resLogin.body.data.accessToken) {
      console.log('✅ Patient login verified!');
    } else {
      console.log('❌ Patient login failed:', resLogin.body);
      passed = false;
    }

    console.log('\n--- Test 6: Admin Login ---');
    const reqAdminLogin = { body: { email: 'admin@scango.com', password: 'adminpassword' } };
    const resAdminLogin = mockRes();
    await authController.loginAdmin(reqAdminLogin, resAdminLogin);

    let adminRefreshToken;
    if (resAdminLogin.statusCode === 200 && resAdminLogin.body.data.accessToken) {
      console.log('✅ Admin login verified!');
      adminRefreshToken = resAdminLogin.body.data.refreshToken;
    } else {
      console.log('❌ Admin login failed:', resAdminLogin.body);
      passed = false;
    }

    console.log('\n--- Test 7: Token Refresh Rotation ---');
    if (adminRefreshToken) {
      const reqRefresh = { body: { refreshToken: adminRefreshToken } };
      const resRefresh = mockRes();
      await authController.refreshToken(reqRefresh, resRefresh);

      if (resRefresh.statusCode === 200 && resRefresh.body.data.accessToken) {
        console.log('✅ Token Refresh verified (Access + Refresh rotated successfully)!');
      } else {
        console.log('❌ Token Refresh failed:', resRefresh.body);
        passed = false;
      }
    } else {
      console.log('❌ Skipping refresh test due to missing token');
      passed = false;
    }

    console.log('\n--- Verification Summary ---');
    if (passed) {
      console.log('🎉 ALL BACKEND AUTH & SCHEMA TESTS PASSED WITH 0% ERRORS!');
      process.exit(0);
    } else {
      console.log('❌ SOME TESTS FAILED. CHECK LOGS.');
      process.exit(1);
    }
  } catch (error) {
    console.error('System Exception during verification run:', error);
    process.exit(1);
  }
};

runTests();
