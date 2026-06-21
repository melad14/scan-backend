const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const User = require('../models/User');
const Technician = require('../models/Technician');
const Admin = require('../models/Admin');
const OtpLog = require('../models/OtpLog');

let twilioClient;
if (env.twilio.accountSid && env.twilio.authToken && env.twilio.accountSid !== 'mock') {
  twilioClient = require('twilio')(env.twilio.accountSid, env.twilio.authToken);
}

const formatPhoneForTwilio = (phone) => {
  let clean = phone.replace(/\s+/g, '').replace(/[-()]/g, '');
  if (clean.startsWith('+')) {
    return clean;
  }
  if (clean.startsWith('00')) {
    return '+' + clean.slice(2);
  }
  if (clean.startsWith('20')) {
    return '+' + clean;
  }
  if (clean.startsWith('0')) {
    return '+20' + clean.slice(1);
  }
  return '+20' + clean;
};

// Helper to generate access and refresh tokens
const generateTokens = (id, role) => {
  const accessToken = jwt.sign({ id, role }, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiry
  });
  const refreshToken = jwt.sign({ id, role }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiry
  });
  return { accessToken, refreshToken };
};

// 1. Send OTP to Patient
exports.sendOtp = async (req, res, next) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'رقم الهاتف مطلوب',
        code: 'VALIDATION_ERROR',
        statusCode: 400
      });
    }

    const isMockPhone = phone === '01000000000' || env.nodeEnv === 'test';
    const useTwilio = twilioClient && !isMockPhone;

    if (useTwilio) {
      const twilioPhone = formatPhoneForTwilio(phone);
      await twilioClient.verify.v2.services(env.twilio.verifyServiceSid)
        .verifications
        .create({ to: twilioPhone, channel: 'sms' });

      // Save OtpLog as an audit/tracker
      await OtpLog.create({
        phone,
        otpHash: 'twilio_verify_sent',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes validation window
      });

      console.log(`[SMS OTP TWILIO] Sent verification to phone: ${twilioPhone}`);
    } else {
      // Generate 6-digit OTP
      // For testing/mock purposes, if phone is 01000000000 we can make OTP 123456
      let otp = '123456';
      if (phone !== '01000000000') {
        otp = String(Math.floor(100000 + Math.random() * 900000));
      }

      // Hash the OTP
      const otpHash = await bcrypt.hash(otp, 10);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      // Save OtpLog
      await OtpLog.create({
        phone,
        otpHash,
        expiresAt
      });

      // Mock SMS provider or log it
      console.log(`[SMS OTP MOCK] Phone: ${phone} -> OTP: ${otp}`);
      
      // In production, trigger SMS gateway here if apiKey !== 'mock'
      if (env.sms.apiKey !== 'mock') {
        // call SMS API provider
      }
    }

    res.status(200).json({
      success: true,
      message: 'تم إرسال رمز التحقق بنجاح'
    });
  } catch (error) {
    console.error('Error in sendOtp:', error);
    if (next) {
      next(error);
    } else {
      res.status(500).json({
        success: false,
        message: 'حدث خطأ أثناء إرسال رمز التحقق',
        error: error.message
      });
    }
  }
};

// 2. Verify OTP
exports.verifyOtp = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: 'رقم الهاتف والرمز مطلوبان',
        code: 'VALIDATION_ERROR',
        statusCode: 400
      });
    }

    const isMockPhone = phone === '01000000000' || env.nodeEnv === 'test';
    const useTwilio = twilioClient && !isMockPhone;

    if (useTwilio) {
      try {
        const twilioPhone = formatPhoneForTwilio(phone);
        const verification = await twilioClient.verify.v2.services(env.twilio.verifyServiceSid)
          .verificationChecks
          .create({ to: twilioPhone, code: otp });

        if (verification.status !== 'approved') {
          return res.status(400).json({
            success: false,
            message: 'رمز التحقق غير صحيح',
            code: 'AUTH_001',
            statusCode: 400
          });
        }

        // Mark the tracker record in local DB as used if found
        await OtpLog.findOneAndUpdate(
          { phone, otpHash: 'twilio_verify_sent', isUsed: false },
          { isUsed: true }
        ).sort({ createdAt: -1 });

      } catch (err) {
        console.error('Twilio verification check error:', err);
        return res.status(400).json({
          success: false,
          message: 'رمز التحقق غير صالح أو انتهت صلاحيته',
          code: 'AUTH_001',
          statusCode: 400
        });
      }
    } else {
      // Find the latest active OTP log for this phone number
      const otpLog = await OtpLog.findOne({
        phone,
        isUsed: false,
        expiresAt: { $gt: new Date() }
      }).sort({ createdAt: -1 });

      if (!otpLog) {
        return res.status(400).json({
          success: false,
          message: 'رمز التحقق غير صالح أو انتهت صلاحيته',
          code: 'AUTH_001',
          statusCode: 400
        });
      }

      // Check attempts limit
      if (otpLog.attempts >= 5) {
        return res.status(429).json({
          success: false,
          message: 'تجاوزت الحد الأقصى للمحاولات. يرجى طلب رمز جديد.',
          code: 'AUTH_002',
          statusCode: 429
        });
      }

      // Compare hash
      const isMatch = await bcrypt.compare(otp, otpLog.otpHash);
      if (!isMatch) {
        otpLog.attempts += 1;
        await otpLog.save();
        return res.status(400).json({
          success: false,
          message: 'رمز التحقق غير صحيح',
          code: 'AUTH_001',
          statusCode: 400
        });
      }

      // OTP is correct! Mark it as used
      otpLog.isUsed = true;
      await otpLog.save();
    }

    // Check if user (patient) exists
    const user = await User.findOne({ phone, isActive: true });

    if (!user) {
      // If user does not exist, return a registration token
      // This token validates that they verified their phone number
      const registerToken = jwt.sign(
        { phone, action: 'register' },
        env.jwt.accessSecret,
        { expiresIn: '10m' }
      );

      return res.status(200).json({
        success: true,
        message: 'تم التحقق من الرمز بنجاح. يرجى إكمال التسجيل.',
        data: {
          isNewUser: true,
          registerToken,
          phone
        }
      });
    }

    // User exists, issue full access and refresh tokens
    const tokens = generateTokens(user._id, 'patient');

    res.status(200).json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح',
      data: {
        isNewUser: false,
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          age: user.age,
          gender: user.gender
        },
        ...tokens
      }
    });
  } catch (error) {
    console.error('Error in verifyOtp:', error);
    if (next) {
      next(error);
    } else {
      res.status(500).json({
        success: false,
        message: 'حدث خطأ أثناء التحقق من الرمز',
        error: error.message
      });
    }
  }
};

// 3. Register Patient (uses registration token to verify phone ownership)
exports.register = async (req, res, next) => {
  try {
    const { name, age, gender, registerToken } = req.body;

    if (!name || !registerToken) {
      return res.status(400).json({
        success: false,
        message: 'الاسم ورمز التسجيل مطلوبان',
        code: 'VALIDATION_ERROR',
        statusCode: 400
      });
    }

    // Verify registration token
    let decoded;
    try {
      decoded = jwt.verify(registerToken, env.jwt.accessSecret);
      if (decoded.action !== 'register') {
        throw new Error();
      }
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: 'رمز التسجيل غير صالح أو منتهي الصلاحية',
        code: 'AUTH_001',
        statusCode: 400
      });
    }

    const phone = decoded.phone;

    // Check if user already exists
    let user = await User.findOne({ phone });
    if (user) {
      return res.status(400).json({
        success: false,
        message: 'المستخدم مسجل بالفعل',
        code: 'DUPLICATE_KEY',
        statusCode: 400
      });
    }

    // Create new patient
    user = await User.create({
      name,
      phone,
      age,
      gender,
      isVerified: true,
      isActive: true
    });

    const tokens = generateTokens(user._id, 'patient');

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الحساب وتسجيل الدخول بنجاح',
      data: {
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          age: user.age,
          gender: user.gender
        },
        ...tokens
      }
    });
  } catch (error) {
    next(error);
  }
};

// 4. Technician Login (Phone + Password)
exports.loginTechnician = async (req, res, next) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'رقم الهاتف وكلمة المرور مطلوبان',
        code: 'VALIDATION_ERROR',
        statusCode: 400
      });
    }

    const tech = await Technician.findOne({ phone, isActive: true });
    if (!tech) {
      return res.status(401).json({
        success: false,
        message: 'رقم الهاتف أو كلمة المرور غير صحيحة',
        code: 'AUTH_003',
        statusCode: 401
      });
    }

    const isMatch = await bcrypt.compare(password, tech.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'رقم الهاتف أو كلمة المرور غير صحيحة',
        code: 'AUTH_003',
        statusCode: 401
      });
    }

    const tokens = generateTokens(tech._id, 'technician');

    res.status(200).json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح',
      data: {
        technician: {
          id: tech._id,
          name: tech.name,
          phone: tech.phone,
          region: tech.region,
          rating: tech.rating
        },
        ...tokens
      }
    });
  } catch (error) {
    next(error);
  }
};

// 5. Admin Login (Email + Password)
exports.loginAdmin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني وكلمة المرور مطلوبان',
        code: 'VALIDATION_ERROR',
        statusCode: 400
      });
    }

    const admin = await Admin.findOne({ email, isActive: true });
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
        code: 'AUTH_003',
        statusCode: 401
      });
    }

    const isMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
        code: 'AUTH_003',
        statusCode: 401
      });
    }

    const tokens = generateTokens(admin._id, admin.role);

    res.status(200).json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح',
      data: {
        admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role
        },
        ...tokens
      }
    });
  } catch (error) {
    next(error);
  }
};

// 6. Refresh Token (Rotates both Access & Refresh tokens)
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'رمز التحديث مطلوب',
        code: 'VALIDATION_ERROR',
        statusCode: 400
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, env.jwt.refreshSecret);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'رمز التحديث غير صالح أو منتهي الصلاحية',
        code: 'AUTH_004',
        statusCode: 401
      });
    }

    // Check if user still active
    let dbUser;
    if (decoded.role === 'patient') {
      dbUser = await User.findById(decoded.id);
    } else if (decoded.role === 'technician') {
      dbUser = await Technician.findById(decoded.id);
    } else {
      dbUser = await Admin.findById(decoded.id);
    }

    if (!dbUser || !dbUser.isActive) {
      return res.status(401).json({
        success: false,
        message: 'الحساب غير موجود أو غير نشط',
        code: 'AUTH_003',
        statusCode: 401
      });
    }

    // Generate new token pair (refresh token rotation)
    const tokens = generateTokens(dbUser._id, decoded.role);

    res.status(200).json({
      success: true,
      message: 'تم تحديث الرموز بنجاح',
      data: {
        ...tokens
      }
    });
  } catch (error) {
    next(error);
  }
};

// 7. Logout (Clears FCM Token)
exports.logout = async (req, res, next) => {
  try {
    const { id, role } = req.user;

    // Clear FCM token depending on the user type
    if (role === 'patient') {
      await User.findByIdAndUpdate(id, { $set: { fcmToken: null } });
    } else if (role === 'technician') {
      await Technician.findByIdAndUpdate(id, { $set: { fcmToken: null } });
    }

    res.status(200).json({
      success: true,
      message: 'تم تسجيل الخروج بنجاح'
    });
  } catch (error) {
    next(error);
  }
};
