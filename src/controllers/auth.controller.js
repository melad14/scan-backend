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

// ────────────────────────────────────────────────────────────────────────────
// PATIENT AUTH — Username & Password
// ────────────────────────────────────────────────────────────────────────────

// 1. Register Patient (Username + Name + Email + Password + Phone + Age + Gender)
exports.registerPatient = async (req, res, next) => {
  try {
    const { username, name, email, password, phone, age, gender } = req.body;

    // Validation
    if (!username || !name || !email || !password || !phone || !age || !gender) {
      return res.status(400).json({
        success: false,
        message: 'جميع الحقول مطلوبة: اسم المستخدم، الاسم، البريد الإلكتروني، رقم الهاتف، العمر، الجنس، وكلمة المرور',
        code: 'VALIDATION_ERROR',
        statusCode: 400
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
        code: 'VALIDATION_ERROR',
        statusCode: 400
      });
    }

    if (!['male', 'female'].includes(gender)) {
      return res.status(400).json({
        success: false,
        message: 'الجنس يجب أن يكون male أو female',
        code: 'VALIDATION_ERROR',
        statusCode: 400
      });
    }

    // Check username uniqueness
    const existingUsername = await User.findOne({ username: username.toLowerCase().trim() });
    if (existingUsername) {
      return res.status(400).json({
        success: false,
        message: 'اسم المستخدم مستخدم بالفعل، يرجى اختيار اسم آخر',
        code: 'DUPLICATE_KEY',
        statusCode: 400
      });
    }

    // Check email uniqueness
    const existingEmail = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني مسجل بالفعل',
        code: 'DUPLICATE_KEY',
        statusCode: 400
      });
    }

    // Check phone uniqueness
    const existingPhone = await User.findOne({ phone: phone.trim() });
    if (existingPhone) {
      return res.status(400).json({
        success: false,
        message: 'رقم الهاتف مسجل بالفعل',
        code: 'DUPLICATE_KEY',
        statusCode: 400
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create new patient
    const user = await User.create({
      username: username.toLowerCase().trim(),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      age: parseInt(age, 10),
      gender,
      passwordHash,
      isVerified: true,
      isActive: true
    });

    // Auto-create default 'self' SavedPatient profile
    try {
      const SavedPatient = require('../models/SavedPatient');
      await SavedPatient.create({
        userId: user._id,
        label: 'أنا',
        name: user.name,
        phone: user.phone || '',
        age: user.age || 0,
        gender: user.gender || 'male',
        relationship: 'self',
        isDefault: true
      });
    } catch (err) {
      console.error('Error auto-creating default SavedPatient:', err);
    }

    const tokens = generateTokens(user._id, 'patient');

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الحساب وتسجيل الدخول بنجاح',
      data: {
        user: {
          id: user._id,
          username: user.username,
          name: user.name,
          email: user.email,
          phone: user.phone,
          age: user.age,
          gender: user.gender
        },
        ...tokens
      }
    });
  } catch (error) {
    // Handle mongoose validation errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      let fieldArabic = 'البريد الإلكتروني';
      if (field === 'username') fieldArabic = 'اسم المستخدم';
      if (field === 'phone') fieldArabic = 'رقم الهاتف';
      return res.status(400).json({
        success: false,
        message: `${fieldArabic} مستخدم بالفعل`,
        code: 'DUPLICATE_KEY',
        statusCode: 400
      });
    }
    next(error);
  }
};

// 2. Login Patient (Username + Password)
exports.loginPatient = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'اسم المستخدم وكلمة المرور مطلوبان',
        code: 'VALIDATION_ERROR',
        statusCode: 400
      });
    }

    // Find user by username (or email — flexible login)
    const isEmail = username.includes('@');
    const query = isEmail
      ? { email: username.toLowerCase().trim(), isActive: true }
      : { username: username.toLowerCase().trim(), isActive: true };

    const user = await User.findOne(query);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'اسم المستخدم أو كلمة المرور غير صحيحة',
        code: 'AUTH_003',
        statusCode: 401
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'اسم المستخدم أو كلمة المرور غير صحيحة',
        code: 'AUTH_003',
        statusCode: 401
      });
    }

    const tokens = generateTokens(user._id, 'patient');

    res.status(200).json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح',
      data: {
        user: {
          id: user._id,
          username: user.username,
          name: user.name,
          email: user.email,
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

// ────────────────────────────────────────────────────────────────────────────
// OTP AUTH — Kept for Technician SMS flows (future use)
// ────────────────────────────────────────────────────────────────────────────

// 3. Send OTP (kept for technician or future patient phone verification)
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

      await OtpLog.create({
        phone,
        otpHash: 'twilio_verify_sent',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      });

      console.log(`[SMS OTP TWILIO] Sent verification to phone: ${twilioPhone}`);
    } else {
      let otp = '123456';
      if (phone !== '01000000000') {
        otp = String(Math.floor(100000 + Math.random() * 900000));
      }

      const otpHash = await bcrypt.hash(otp, 10);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      await OtpLog.create({ phone, otpHash, expiresAt });

      console.log(`[SMS OTP MOCK] Phone: ${phone} -> OTP: ${otp}`);

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

// 4. Verify OTP
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

      if (otpLog.attempts >= 5) {
        return res.status(429).json({
          success: false,
          message: 'تجاوزت الحد الأقصى للمحاولات. يرجى طلب رمز جديد.',
          code: 'AUTH_002',
          statusCode: 429
        });
      }

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

      otpLog.isUsed = true;
      await otpLog.save();
    }

    res.status(200).json({
      success: true,
      message: 'تم التحقق من الرمز بنجاح'
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

// ────────────────────────────────────────────────────────────────────────────
// TECHNICIAN AUTH
// ────────────────────────────────────────────────────────────────────────────

// 5. Technician Login (Phone + Password)
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

// ────────────────────────────────────────────────────────────────────────────
// ADMIN AUTH
// ────────────────────────────────────────────────────────────────────────────

// 6. Admin Login (Email + Password)
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

// ────────────────────────────────────────────────────────────────────────────
// SHARED — Token Rotation & Logout
// ────────────────────────────────────────────────────────────────────────────

// 7. Refresh Token (Rotates both Access & Refresh tokens)
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

// 8. Logout (Clears FCM Token)
exports.logout = async (req, res, next) => {
  try {
    const { id, role } = req.user;

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

// 9. Update FCM Token
exports.updateFcmToken = async (req, res, next) => {
  try {
    const { id, role } = req.user;
    const { fcmToken } = req.body;

    if (!fcmToken) {
      return res.status(400).json({
        success: false,
        message: 'رمز الإشعارات مطلوب',
        code: 'VALIDATION_ERROR',
        statusCode: 400
      });
    }

    if (role === 'patient') {
      await User.findByIdAndUpdate(id, { $set: { fcmToken } });
    } else if (role === 'technician') {
      await Technician.findByIdAndUpdate(id, { $set: { fcmToken } });
    }

    res.status(200).json({
      success: true,
      message: 'تم تحديث رمز الإشعارات بنجاح'
    });
  } catch (error) {
    next(error);
  }
};
