const Complaint = require('../models/Complaint');
const Order = require('../models/Order');

// 1. Create Complaint
exports.createComplaint = async (req, res, next) => {
  try {
    const { orderId, text } = req.body;
    const senderId = req.user.id;
    const senderModel = req.user.role === 'technician' ? 'Technician' : 'User';

    if (!orderId || !text) {
      return res.status(400).json({
        success: false,
        message: 'بيانات الشكوى غير مكتملة',
        statusCode: 400
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود',
        statusCode: 404
      });
    }

    // Verify ownership
    if (senderModel === 'User' && String(order.patient) !== String(senderId)) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بتقديم شكوى على هذا الطلب',
        statusCode: 403
      });
    }

    if (senderModel === 'Technician' && String(order.technician) !== String(senderId)) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بتقديم شكوى على هذا الطلب',
        statusCode: 403
      });
    }

    const complaint = await Complaint.create({
      orderId,
      sender: senderId,
      senderModel,
      text,
      status: 'pending'
    });

    res.status(201).json({
      success: true,
      message: 'تم تسجيل الشكوى بنجاح وسيتم مراجعتها من قبل الإدارة',
      data: complaint
    });
  } catch (error) {
    next(error);
  }
};

// 2. Get My Complaints
exports.getMyComplaints = async (req, res, next) => {
  try {
    const senderId = req.user.id;
    const senderModel = req.user.role === 'technician' ? 'Technician' : 'User';

    const complaints = await Complaint.find({
      sender: senderId,
      senderModel: senderModel
    })
    .populate({
      path: 'orderId',
      select: 'orderNumber status createdAt'
    })
    .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: 'تم استرجاع قائمة الشكاوى الخاصة بك بنجاح',
      data: complaints
    });
  } catch (error) {
    next(error);
  }
};

// 3. Get Forwarded Complaints (For Technician/Center)
exports.getForwardedComplaints = async (req, res, next) => {
  try {
    const techId = req.user.id;
    if (req.user.role !== 'technician') {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لغير الفنيين بالوصول لهذه الخدمة',
        statusCode: 403
      });
    }

    // Find orders belonging to this technician
    const orders = await Order.find({ technician: techId }).select('_id');
    const orderIds = orders.map(o => o._id);

    // Find complaints on these orders where status is 'forwarded' or 'resolved'
    const complaints = await Complaint.find({
      orderId: { $in: orderIds },
      status: { $in: ['forwarded', 'resolved'] }
    })
    .populate({
      path: 'orderId',
      select: 'orderNumber status createdAt patientName patientPhone'
    })
    .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: 'تم استرجاع الشكاوى المحولة للفني بنجاح',
      data: complaints
    });
  } catch (error) {
    next(error);
  }
};

// 4. Resolve Complaint (For Technician/Center)
exports.resolveComplaint = async (req, res, next) => {
  try {
    const { id } = req.params;
    const techId = req.user.id;

    const complaint = await Complaint.findById(id).populate('orderId');
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'الشكوى غير موجودة',
        statusCode: 404
      });
    }

    // Verify this complaint belongs to this technician's order
    if (String(complaint.orderId.technician) !== String(techId)) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بتعديل هذه الشكوى',
        statusCode: 403
      });
    }

    complaint.status = 'resolved';
    await complaint.save();

    res.status(200).json({
      success: true,
      message: 'تمت تسوية وحل الشكوى بنجاح',
      data: complaint
    });
  } catch (error) {
    next(error);
  }
};
