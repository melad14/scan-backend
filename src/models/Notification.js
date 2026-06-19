const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'recipientModel'
    },
    recipientModel: {
      type: String,
      required: true,
      enum: ['User', 'Technician']
    },
    type: {
      type: String,
      enum: [
        'order_accepted',
        'tech_assigned',
        'tech_on_way',
        'tech_arrived',
        'report_ready',
        'order_cancelled'
      ],
      required: true
    },
    titleAr: {
      type: String,
      required: true
    },
    bodyAr: {
      type: String,
      required: true
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true
    },
    isRead: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Notification', notificationSchema);
