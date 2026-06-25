const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'الاسم مطلوب'],
      trim: true
    },
    username: {
      type: String,
      required: [true, 'اسم المستخدم مطلوب'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل'],
      match: [/^[a-zA-Z0-9_]+$/, 'اسم المستخدم يجب أن يحتوي على حروف وأرقام وشرطة سفلية فقط']
    },
    email: {
      type: String,
      required: [true, 'البريد الإلكتروني مطلوب'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'صيغة البريد الإلكتروني غير صحيحة']
    },
    passwordHash: {
      type: String,
      required: [true, 'كلمة المرور مطلوبة']
    },
    // Optional profile fields
    phone: {
      type: String,
      trim: true,
      default: null
    },
    age: {
      type: Number
    },
    gender: {
      type: String,
      enum: ['male', 'female']
    },
    fcmToken: {
      type: String,
      default: null
    },
    isVerified: {
      type: Boolean,
      default: true // Email/username accounts are auto-verified
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('User', userSchema);
