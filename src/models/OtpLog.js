const mongoose = require('mongoose');

const otpLogSchema = new mongoose.Schema(
  {
    identifier: {
      type: String,
      trim: true
    },
    code: {
      type: String,
      trim: true
    },
    type: {
      type: String,
      default: 'email_verification'
    },
    phone: {
      type: String,
      trim: true
    },
    otpHash: {
      type: String
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
otpLogSchema.index({ identifier: 1, type: 1 });

module.exports = mongoose.model('OtpLog', otpLogSchema);
