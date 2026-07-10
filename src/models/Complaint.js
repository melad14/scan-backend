const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'senderModel'
    },
    senderModel: {
      type: String,
      required: true,
      enum: ['User', 'Technician']
    },
    text: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'forwarded', 'resolved'],
      default: 'pending'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Complaint', complaintSchema);
