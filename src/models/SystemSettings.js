const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema(
  {
    defaultTransferFee: {
      type: Number,
      default: 150
    },
    emergencyExtraFee: {
      type: Number,
      default: 150
    },
    cancellationPolicyAr: {
      type: String,
      default: 'لقد تحرك فريق المركز بالفعل نحو موقعك. عند الإلغاء الآن سيتم فرض رسوم الانتقال وقدرها [FEE] جنيه.'
    },
    cancellationPolicyEn: {
      type: String,
      default: 'The medical team has already started their trip to your location. Cancelling now will incur a transfer fee of [FEE] EGP.'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
