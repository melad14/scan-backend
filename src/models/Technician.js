const mongoose = require('mongoose');

const technicianSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'اسم الفني مطلوب']
    },
    phone: {
      type: String,
      required: [true, 'رقم هاتف الفني مطلوب'],
      unique: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: [true, 'كلمة المرور مطلوبة']
    },
    nationalId: {
      type: String,
      required: [true, 'الرقم القومي مطلوب']
    },
    photo: {
      type: String,
      default: null
    },
    rating: {
      type: Number,
      default: 0
    },
    totalRatings: {
      type: Number,
      default: 0
    },
    completedOrders: {
      type: Number,
      default: 0
    },
    isAvailable: {
      type: Boolean,
      default: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    region: {
      type: String,
      required: [true, 'منطقة العمل مطلوبة']
    },
    currentLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [lng, lat]
        default: [31.2357, 30.0444] // default Cairo
      }
    },
    fcmToken: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Geo index
technicianSchema.index({ currentLocation: '2dsphere' });

module.exports = mongoose.model('Technician', technicianSchema);
