const mongoose = require('mongoose');

const pricingConfigSchema = new mongoose.Schema(
  {
    transferFeeBase: {
      type: Number,
      required: [true, 'رسوم الانتقال الأساسية مطلوبة'],
      default: 50
    },
    emergencySurcharge: {
      type: Number,
      required: [true, 'رسوم الطوارئ الإضافية مطلوبة'],
      default: 100
    },
    homeServiceFee: {
      type: Number,
      required: [true, 'رسوم الخدمة المنزلية مطلوبة'],
      default: 0
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('PricingConfig', pricingConfigSchema);
