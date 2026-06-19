const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    patientSnapshot: {
      name: String,
      age: Number,
      gender: String,
      phone: String
    },
    serviceCategory: {
      type: String,
      enum: ['xray', 'lab'],
      required: true
    },
    services: [
      {
        serviceId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Service'
        },
        nameAr: String,
        nameEn: String,
        price: Number
      }
    ],
    prescription: {
      images: [String],
      pdf: String
    },
    caseDetails: {
      isBedridden: { type: Boolean, default: false },
      canMove: { type: Boolean, default: true },
      locationType: { type: String, enum: ['home', 'hospital', 'clinic'], default: 'home' },
      weight: Number,
      floor: Number,
      hasElevator: { type: Boolean, default: false },
      notes: String
    },
    location: {
      governorate: String,
      district: String,
      street: String,
      building: String,
      coordinates: {
        type: {
          type: String,
          enum: ['Point'],
          default: 'Point'
        },
        coordinates: {
          type: [Number] // [lng, lat]
        }
      }
    },
    schedule: {
      date: Date,
      timeSlot: {
        type: String,
        enum: ['morning_9_12', 'afternoon_12_3', 'evening_3_6']
      },
      isEmergency: { type: Boolean, default: false }
    },
    pricing: {
      servicesTotal: Number,
      transferFee: Number,
      emergencyFee: Number,
      discount: { type: Number, default: 0 },
      total: Number
    },
    payment: {
      method: {
        type: String,
        enum: ['cash', 'vodafone_cash', 'instapay', 'card'],
        default: 'cash'
      },
      status: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending'
      },
      transactionId: String,
      paidAt: Date
    },
    status: {
      type: String,
      enum: [
        'pending',
        'accepted',
        'assigned',
        'on_way',
        'arrived',
        'in_progress',
        'completed',
        'report_ready',
        'cancelled'
      ],
      default: 'pending'
    },
    statusHistory: [
      {
        status: String,
        timestamp: { type: Date, default: Date.now },
        updatedBy: mongoose.Schema.Types.ObjectId,
        updatedByModel: {
          type: String,
          enum: ['User', 'Technician', 'Admin']
        },
        note: String
      }
    ],
    technician: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Technician',
      default: null
    },
    report: {
      images: [String],
      pdf: String,
      uploadedAt: Date,
      notes: String
    },
    technicianRating: { type: Number, min: 1, max: 5 },
    technicianReview: String,
    cancelReason: String
  },
  {
    timestamps: true
  }
);

// Indexes
orderSchema.index({ patient: 1, createdAt: -1 });
orderSchema.index({ patient: 1, status: 1 });
orderSchema.index({ technician: 1, status: 1 });
orderSchema.index({ technician: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 }, { unique: true });
orderSchema.index({ 'location.coordinates': '2dsphere' });

module.exports = mongoose.model('Order', orderSchema);
