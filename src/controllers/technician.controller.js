const Order = require('../models/Order');
const Technician = require('../models/Technician');
const notificationService = require('../services/notification.service');

// Status machine validation helper
const isValidTransition = (currentStatus, newStatus) => {
  const allowedTransitions = {
    pending: ['accepted', 'assigned', 'cancelled'],
    accepted: ['assigned', 'cancelled'],
    assigned: ['on_way', 'cancelled'],
    on_way: ['arrived', 'cancelled'],
    arrived: ['in_progress', 'cancelled'],
    in_progress: ['completed', 'cancelled'],
    completed: ['report_ready'],
    report_ready: [],
    cancelled: []
  };

  return allowedTransitions[currentStatus] && allowedTransitions[currentStatus].includes(newStatus);
};

// Helper to update status and push to history log
const updateOrderStatus = async (order, newStatus, updaterId, note) => {
  if (!isValidTransition(order.status, newStatus)) {
    const error = new Error(`انتقال غير صالح للحالة من ${order.status} إلى ${newStatus}`);
    error.statusCode = 400;
    error.code = 'ORDER_002';
    throw error;
  }

  order.status = newStatus;
  order.statusHistory.push({
    status: newStatus,
    timestamp: new Date(),
    updatedBy: updaterId,
    updatedByModel: 'Technician',
  });

  const savedOrder = await order.save();
  
  // Socket broadcast status update
  try {
    const { emitOrderStatus } = require('../socket/socket');
    emitOrderStatus(savedOrder._id, newStatus);
  } catch (err) {
    console.error('Socket broadcast error:', err.message);
  }

  return savedOrder;
};

// 1. Get Available Orders (Pending and unassigned in region)
exports.getAvailableOrders = async (req, res, next) => {
  try {
    const techId = req.user.id;
    const tech = await Technician.findById(techId);

    if (!tech) {
      return res.status(404).json({
        success: false,
        message: 'الفني غير موجود',
        code: 'AUTH_003',
        statusCode: 404
      });
    }

    // Find orders with status 'pending' or 'accepted' and no technician assigned in tech's region
    // If region matches, or just general pending orders
    const query = {
      status: { $in: ['pending', 'accepted'] },
      technician: null,
      'location.district': tech.region // Filter by technician's active region
    };

    // If no district matches region, fallback to generic regional search
    const orders = await Order.find({
      status: { $in: ['pending', 'accepted'] },
      technician: null
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: 'تم استرجاع الطلبات المتاحة بنجاح',
      data: orders
    });
  } catch (error) {
    next(error);
  }
};

// 2. Get Active Order (Assigned or in progress)
exports.getActiveOrder = async (req, res, next) => {
  try {
    const techId = req.user.id;

    const activeOrder = await Order.findOne({
      technician: techId,
      status: { $in: ['assigned', 'on_way', 'arrived', 'in_progress'] }
    }).populate('patient', 'name phone');

    res.status(200).json({
      success: true,
      message: 'تم استرجاع الطلب النشط للفني',
      data: activeOrder || null
    });
  } catch (error) {
    next(error);
  }
};

// 3. Get Completed Orders History
exports.getCompletedOrdersHistory = async (req, res, next) => {
  try {
    const techId = req.user.id;
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);

    const query = {
      technician: techId,
      status: { $in: ['completed', 'report_ready'] }
    };

    const total = await Order.countDocuments(query);
    const pages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;

    const orders = await Order.find(query)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      message: 'تم استرجاع سجل العمليات المنجزة بنجاح',
      data: orders,
      pagination: {
        page,
        limit,
        total,
        pages
      }
    });
  } catch (error) {
    next(error);
  }
};

// 4. Accept Order
exports.acceptOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const techId = req.user.id;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود',
        code: 'ORDER_001',
        statusCode: 404
      });
    }

    if (order.technician) {
      return res.status(400).json({
        success: false,
        message: 'هذا الطلب تم تعيينه بالفعل لفني آخر',
        code: 'ORDER_002',
        statusCode: 400
      });
    }

    // Check if tech already has an active order
    const hasActive = await Order.exists({
      technician: techId,
      status: { $in: ['assigned', 'on_way', 'arrived', 'in_progress'] }
    });

    if (hasActive) {
      return res.status(400).json({
        success: false,
        message: 'لا يمكنك قبول طلب جديد قبل إنهاء الطلب النشط الحالي لديك',
        code: 'ORDER_002',
        statusCode: 400
      });
    }

    // Assign and transition status
    order.technician = techId;
    await updateOrderStatus(order, 'assigned', techId, 'تم قبول الطلب وجاري التحضير من قبل الفني');

    // Notify patient
    await notificationService.notifyPatientTechAssigned(order);

    res.status(200).json({
      success: true,
      message: 'تم قبول الطلب بنجاح وتعيينه لك',
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// 5. Start Trip (En route)
exports.startTrip = async (req, res, next) => {
  try {
    const { id } = req.params;
    const techId = req.user.id;

    const order = await Order.findById(id);
    if (!order || String(order.technician) !== String(techId)) {
      return res.status(400).json({
        success: false,
        message: 'الطلب غير صالح أو لم يتم تعيينه لك',
        code: 'ORDER_001',
        statusCode: 400
      });
    }

    await updateOrderStatus(order, 'on_way', techId, 'الفني في الطريق إليك الآن');

    // Notify patient
    await notificationService.notifyPatientTechOnWay(order);

    res.status(200).json({
      success: true,
      message: 'تم تحديث حالة الطلب: في الطريق',
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// 6. Arrived at location
exports.arrivedAtLocation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const techId = req.user.id;

    const order = await Order.findById(id);
    if (!order || String(order.technician) !== String(techId)) {
      return res.status(400).json({
        success: false,
        message: 'الطلب غير صالح أو لم يتم تعيينه لك',
        code: 'ORDER_001',
        statusCode: 400
      });
    }

    await updateOrderStatus(order, 'arrived', techId, 'لقد وصل الفني إلى موقعك الجغرافي');

    // Notify patient
    await notificationService.notifyPatientTechArrived(order);

    res.status(200).json({
      success: true,
      message: 'تم تحديث حالة الطلب: وصل الفني',
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// 7. Start Service (In progress)
exports.startService = async (req, res, next) => {
  try {
    const { id } = req.params;
    const techId = req.user.id;

    const order = await Order.findById(id);
    if (!order || String(order.technician) !== String(techId)) {
      return res.status(400).json({
        success: false,
        message: 'الطلب غير صالح أو لم يتم تعيينه لك',
        code: 'ORDER_001',
        statusCode: 400
      });
    }

    await updateOrderStatus(order, 'in_progress', techId, 'جاري تنفيذ الخدمة الطبية الآن');

    res.status(200).json({
      success: true,
      message: 'تم تحديث حالة الطلب: جاري التنفيذ',
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// 8. Upload results and reports
exports.uploadReportResults = async (req, res, next) => {
  try {
    const { id } = req.params;
    const techId = req.user.id;
    const { images, pdf, notes, paymentStatus, paymentMethod } = req.body;

    const order = await Order.findById(id);
    if (!order || String(order.technician) !== String(techId)) {
      return res.status(400).json({
        success: false,
        message: 'الطلب غير صالح أو لم يتم تعيينه لك',
        code: 'ORDER_001',
        statusCode: 400
      });
    }

    // Set report details
    order.report = {
      images: images || [],
      pdf: pdf || null,
      uploadedAt: new Date(),
      notes: notes || ''
    };

    // Update payment details if provided
    order.payment = order.payment || {};
    if (paymentStatus) {
      order.payment.status = paymentStatus;
    }
    if (paymentMethod) {
      order.payment.method = paymentMethod;
    }

    // Transition state from in_progress -> completed
    await updateOrderStatus(order, 'completed', techId, 'تم إنهاء تقديم الخدمة الطبية وجاري تجهيز التقرير النهائي');

    // Immediately transition to report_ready since report is uploaded
    await updateOrderStatus(order, 'report_ready', techId, 'التقرير الطبي وصور الأشعة جاهزة الآن للمشاهدة والتحميل');

    // Increment completed orders count for technician
    await Technician.findByIdAndUpdate(techId, { $inc: { completedOrders: 1 } });

    // Notify patient
    await notificationService.notifyPatientReportReady(order);

    res.status(200).json({
      success: true,
      message: 'تم رفع النتائج وإكمال الطلب بنجاح',
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// 9. Update Technician GPS Position
exports.updateLocation = async (req, res, next) => {
  try {
    const techId = req.user.id;
    const { lat, lng } = req.body;

    if (lat === undefined || lng === undefined) {
      return res.status(400).json({
        success: false,
        message: 'إحداثيات الموقع مطلوبة',
        code: 'VALIDATION_ERROR',
        statusCode: 400
      });
    }

    await Technician.findByIdAndUpdate(techId, {
      $set: {
        currentLocation: {
          type: 'Point',
          coordinates: [lng, lat]
        }
      }
    });

    res.status(200).json({
      success: true,
      message: 'تم تحديث الموقع الجغرافي للفني بنجاح'
    });
  } catch (error) {
    next(error);
  }
};

// 10. Toggle On/Off Duty
exports.toggleAvailability = async (req, res, next) => {
  try {
    const techId = req.user.id;
    const tech = await Technician.findById(techId);

    if (!tech) {
      return res.status(404).json({
        success: false,
        message: 'الفني غير موجود',
        code: 'AUTH_003',
        statusCode: 404
      });
    }

    tech.isAvailable = !tech.isAvailable;
    await tech.save();

    res.status(200).json({
      success: true,
      message: tech.isAvailable ? 'حالة العمل: متاح لاستقبال الطلبات' : 'حالة العمل: خارج الخدمة حالياً',
      data: {
        isAvailable: tech.isAvailable
      }
    });
  } catch (error) {
    next(error);
  }
};
