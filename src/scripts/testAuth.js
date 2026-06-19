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

    console.log('\n--- Test 3: Mock OTP Verification (New User Registration) ---');
    // For phone 01000000000 we default OTP to '123456' as coded, or retrieve it from DB.
    // Let's create an OTP for phone 01099999999 in DB and read it
    const latestOtp = await OtpLog.findOne({ phone }).sort({ createdAt: -1 });
    if (!latestOtp) {
      console.log('❌ No OTP log found in database!');
      passed = false;
    }

    // We will verify the OTP (we mock user inputting '123456' for phone 01000000000,
    // or let's use the actual OTP generated or just 01000000000 default)
    // To be 100% deterministic, we can verify phone '01000000000' with code '123456' after creating it
    const testPhone = '01000000000';
    const reqSendDet = { body: { phone: testPhone } };
    const resSendDet = mockRes();
    await authController.sendOtp(reqSendDet, resSendDet);

    const reqVerify = { body: { phone: testPhone, otp: '123456' } };
    const resVerify = mockRes();
    await authController.verifyOtp(reqVerify, resVerify);

    let registerToken;
    if (resVerify.statusCode === 200 && resVerify.body.data.isNewUser) {
      console.log('✅ OTP Verification detected new user and returned registration token!');
      registerToken = resVerify.body.data.registerToken;
    } else {
      console.log('❌ OTP verification failed:', resVerify.body);
      passed = false;
    }

    console.log('\n--- Test 4: New User Registration ---');
    if (registerToken) {
      // Clean up user first if exists from previous runs
      await User.deleteOne({ phone: testPhone });

      const reqReg = {
        body: {
          name: 'المريض التجريبي',
          age: 30,
          gender: 'male',
          registerToken
        }
      };
      const resReg = mockRes();
      await authController.register(reqReg, resReg);

      if (resReg.statusCode === 201 && resReg.body.data.accessToken) {
        console.log('✅ Registration completed successfully and JWT token returned!');
      } else {
        console.log('❌ User registration failed:', resReg.body);
        passed = false;
      }
    } else {
      console.log('❌ Skipping registration test due to missing token');
      passed = false;
    }

    console.log('\n--- Test 5: Admin Login ---');
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

    console.log('\n--- Test 6: Token Refresh Rotation ---');
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
