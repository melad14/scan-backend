const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'الاسم مطلوب']
    },
    phone: {
      type: String,
      required: [true, 'رقم الهاتف مطلوب'],
      unique: true,
      trim: true
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
      default: false
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
