const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    nameAr: {
      type: String,
      required: [true, 'الاسم باللغة العربية مطلوب'],
      trim: true
    },
    nameEn: {
      type: String,
      required: [true, 'الاسم باللغة الإنجليزية مطلوب'],
      trim: true
    },
    key: {
      type: String,
      required: [true, 'مفتاح التصنيف (الترميز) مطلوب'],
      unique: true,
      lowercase: true,
      trim: true
    },
    icon: {
      type: String,
      required: [true, 'اسم الأيقونة مطلوب'],
      default: 'category'
    },
    iconBg: {
      type: String,
      required: [true, 'لون خلفية الأيقونة مطلوب'],
      default: '#1A1D9E75'
    },
    iconColor: {
      type: String,
      required: [true, 'لون الأيقونة مطلوب'],
      default: '#1D9E75'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    sortOrder: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

categorySchema.index({ key: 1 });
categorySchema.index({ sortOrder: 1 });

module.exports = mongoose.model('Category', categorySchema);
