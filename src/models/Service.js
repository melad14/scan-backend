const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    nameAr: {
      type: String,
      required: [true, 'الاسم باللغة العربية مطلوب']
    },
    nameEn: {
      type: String,
      required: [true, 'الاسم باللغة الإنجليزية مطلوب']
    },
    category: {
      type: String,
      required: [true, 'نوع الخدمة مطلوب']
    },
    price: {
      type: Number,
      required: [true, 'السعر مطلوب']
    },
    isActive: {
      type: Boolean,
      default: true
    },
    sortOrder: {
      type: Number,
      default: 0
    },
    description: {
      type: String,
      default: ''
    },
    instructionsAr: {
      type: String,
      default: ''
    },
    instructionsEn: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Service', serviceSchema);
