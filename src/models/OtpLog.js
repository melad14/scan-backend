const mongoose = require('mongoose');

const otpLogSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: [true, 'رقم الهاتف مطلوب'],
      trim: true
    },
    otpHash: {
      type: String,
      required: [true, 'الرمز المشفر مطلوب']
    },
    expiresAt: {
      type: Date,
      required: true
    },
    isUsed: {
      type: Boolean,
      default: false
    },
    attempts: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// TTL Index to automatically delete expired OTPs
otpLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OtpLog', otpLogSchema);
