const mongoose = require('mongoose');

const savedPatientSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    label: {
      type: String,
      required: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    age: {
      type: Number,
      required: true
    },
    gender: {
      type: String,
      enum: ['male', 'female'],
      required: true
    },
    relationship: {
      type: String,
      enum: ['self', 'spouse', 'parent', 'child', 'sibling', 'other'],
      default: 'other'
    },
    caseDefaults: {
      isBedridden: { type: Boolean, default: false },
      canMove: { type: Boolean, default: true },
      weight: { type: Number, default: null },
      notes: { type: String, default: '' }
    },
    isDefault: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

// Indexes
savedPatientSchema.index({ userId: 1 });
savedPatientSchema.index({ userId: 1, isDefault: 1 });

module.exports = mongoose.model('SavedPatient', savedPatientSchema);
