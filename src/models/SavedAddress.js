const mongoose = require('mongoose');

const savedAddressSchema = new mongoose.Schema(
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
    icon: {
      type: String,
      enum: ['home', 'work', 'hospital', 'family', 'other'],
      default: 'home'
    },
    governorate: { type: String, default: '' },
    district: { type: String, default: '' },
    street: { type: String, default: '' },
    building: { type: String, default: '' },
    houseNumber: { type: String, default: '' },
    road: { type: String, default: '' },
    neighbourhood: { type: String, default: '' },
    suburb: { type: String, default: '' },
    city: { type: String, default: '' },
    postcode: { type: String, default: '' },
    country: { type: String, default: 'مصر' },
    countryCode: { type: String, default: 'eg' },
    floor: { type: Number, default: null },
    hasElevator: { type: Boolean, default: false },
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number] // [lng, lat]
      }
    },
    isDefault: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

savedAddressSchema.index({ userId: 1 });
savedAddressSchema.index({ coordinates: '2dsphere' });

module.exports = mongoose.model('SavedAddress', savedAddressSchema);
