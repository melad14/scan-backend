const Order = require('../models/Order');
const User = require('../models/User');
const Technician = require('../models/Technician');
const pricingService = require('../services/pricing.service');
const notificationService = require('../services/notification.service');

// Sequential Order Number Generator (e.g., XR-2026-00001)
const generateOrderNumber = async () => {
  const year = new Date().getFullYear();
  const count = await Order.countDocuments({
    createdAt: {
      $gte: new Date(`${year}-01-01`),
      $lte: new Date(`${year}-12-31`)
    }
  });
  const seq = String(count + 1).padStart(5, '0');
  return `XR-${year}-${seq}`;
};

// 1. Create New Order (Patient)
exports.createOrder = async (req, res, next) => {
  try {
    const patientId = req.user.id;
    const {
      serviceCategory,
      serviceIds,
      prescription,
      caseDetails,
      location,
      schedule,
      paymentMethod
    } = req.body;

    const isPrescriptionOnly = serviceCategory === 'prescription_only';

    if (!serviceCategory || (!isPrescriptionOnly && (!serviceIds || serviceIds.length === 0)) || !location || !schedule) {
      return res.status(400).json({
        success: false,
        message: 'بيانات الطلب غير مكتملة',
        code: 'VALIDATION_ERROR',
        statusCode: 400
      });
    }

    // Fetch patient info for snapshot
    const patient = await User.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على المريض',
        code: 'AUTH_003',
        statusCode: 404
      });
    }

    // Server-side Pricing calculation
    let pricingBreakdown = { servicesList: [], servicesTotal: 0, transferFee: 0, emergencyFee: 0, total: 0 };
    if (!isPrescriptionOnly) {
      pricingBreakdown = await pricingService.calculateOrderPrice(
        serviceIds,
        schedule.isEmergency
      );
    } else {
      // Get default transfer fee from settings
      try {
        const SystemSettings = require('../models/SystemSettings');
        const settings = await SystemSettings.findOne();
        if (settings) {
          pricingBreakdown.transferFee = settings.defaultTransferFee;
          pricingBreakdown.total = settings.defaultTransferFee;
        } else {
          pricingBreakdown.transferFee = 150;
          pricingBreakdown.total = 150;
        }
      } catch (err) {
        console.error('Error fetching settings for transfer fee:', err);
        pricingBreakdown.transferFee = 150;
        pricingBreakdown.total = 150;
      }
    }

    // Order number
    const orderNumber = await generateOrderNumber();

    // Create Order
    const order = await Order.create({
      orderNumber,
      patient: patientId,
      patientSnapshot: {
        name: req.body.patientName || patient.name, // can book for another person
        phone: req.body.patientPhone || patient.phone,
        age: req.body.patientAge || patient.age,
        gender: req.body.patientGender || patient.gender
      },
      serviceCategory,
      services: pricingBreakdown.servicesList,
      prescription: {
        images: prescription?.images || [],
        pdf: prescription?.pdf || null
      },
      caseDetails: {
        isBedridden: caseDetails?.isBedridden || false,
        canMove: caseDetails?.canMove !== undefined ? caseDetails.canMove : true,
        locationType: caseDetails?.locationType || 'home',
        weight: caseDetails?.weight || null,
        floor: caseDetails?.floor || null,
        hasElevator: caseDetails?.hasElevator || false,
        notes: caseDetails?.notes || ''
      },
      location: {
        governorate: location.governorate,
        district: location.district,
        street: location.street,
        building: location.building,
        houseNumber: location.houseNumber || '',
        road: location.road || '',
        neighbourhood: location.neighbourhood || '',
        suburb: location.suburb || '',
        city: location.city || '',
        postcode: location.postcode || '',
        country: location.country || '',
        countryCode: location.countryCode || '',
        coordinates: {
          type: 'Point',
          coordinates: location.coordinates || [31.2357, 30.0444] // default Cairo
        }
      },
      schedule: {
        date: schedule.date,
        timeSlot: schedule.timeSlot,
        isEmergency: schedule.isEmergency || false
      },
      pricing: {
        servicesTotal: pricingBreakdown.servicesTotal,
        transferFee: pricingBreakdown.transferFee,
        emergencyFee: pricingBreakdown.emergencyFee,
        discount: 0,
        total: pricingBreakdown.total
      },
      payment: {
        method: paymentMethod || 'cash',
        status: 'pending'
      },
      status: isPrescriptionOnly ? 'pending_review' : 'pending',
      needsPricing: isPrescriptionOnly,
      statusHistory: [
        {
          status: isPrescriptionOnly ? 'pending_review' : 'pending',
          timestamp: new Date(),
          updatedBy: patientId,
          updatedByModel: 'User',
          note: isPrescriptionOnly ? 'تم رفع الروشتة وبانتظار المراجعة والتسعير من الإدارة' : 'تم استلام الطلب وبانتظار المراجعة والقبول'
        }
      ]
    });

    // Notify administrators / nearby technicians (only for regular bookings)
    if (!isPrescriptionOnly) {
      await notificationService.notifyTechniciansNewOrder(order);
    }

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الطلب بنجاح',
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// 2. Get Order History (Patient)
exports.getOrderHistory = async (req, res, next) => {
  try {
    const patientId = req.user.id;
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const status = req.query.status;

    const query = { patient: patientId };
    
    // Status filter
    if (status && status !== 'all') {
      query.status = status;
    }

    const total = await Order.countDocuments(query);
    const pages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Mask report files if not approved
    const filteredOrders = orders.map(order => {
      const orderObj = order.toObject();
      if (!orderObj.isResultsApproved) {
        orderObj.report = {
          images: [],
          pdf: null,
          notes: 'جاري مراجعة وكتابة التقرير النهائي من قبل الإدارة وسوف يظهر هنا فور اعتماده.'
        };
      }
      return orderObj;
    });

    res.status(200).json({
      success: true,
      message: 'تم استرجاع سجل الطلبات بنجاح',
      data: filteredOrders,
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

// 3. Get Single Order Detail
exports.getOrderDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;

    const order = await Order.findById(id)
      .populate('patient', 'name phone')
      .populate('technician', 'name phone photo rating');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود',
        code: 'ORDER_001',
        statusCode: 404
      });
    }

    // Access control check
    if (role === 'patient' && String(order.patient._id || order.patient) !== userId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بمشاهدة هذا الطلب',
        code: 'AUTH_005',
        statusCode: 403
      });
    }

    if (role === 'technician' && order.technician && String(order.technician._id || order.technician) !== userId) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بمشاهدة هذا الطلب',
        code: 'AUTH_005',
        statusCode: 403
      });
    }

    // Mask report files if patient is querying and results are not approved
    const orderData = order.toObject();
    if (role === 'patient' && !orderData.isResultsApproved) {
      orderData.report = {
        images: [],
        pdf: null,
        notes: 'جاري مراجعة وكتابة التقرير النهائي من قبل الإدارة وسوف يظهر هنا فور اعتماده.'
      };
    }

    res.status(200).json({
      success: true,
      message: 'تم استرجاع تفاصيل الطلب بنجاح',
      data: orderData
    });
  } catch (error) {
    next(error);
  }
};

// 4. Cancel Order (Patient)
exports.cancelOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const patientId = req.user.id;
    const { cancelReason } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود',
        code: 'ORDER_001',
        statusCode: 404
      });
    }

    // Access check
    if (String(order.patient) !== String(patientId)) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بإلغاء هذا الطلب',
        code: 'AUTH_005',
        statusCode: 403
      });
    }

    // Cancellation constraint check: Allowed only BEFORE order goes into in_progress
    const nonCancellableStates = ['in_progress', 'completed', 'report_ready'];
    if (nonCancellableStates.includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن إلغاء الطلب بعد بدء تقديمه من قبل الفني',
        code: 'ORDER_003',
        statusCode: 400
      });
    }

    // Cancel order & apply dynamic cancellation fee if team has moved (on_way)
    let note = `تم إلغاء الطلب من قبل المريض. السبب: ${cancelReason || 'إلغاء من قبل المريض'}`;
    if (order.status === 'on_way') {
      order.cancellationFeeApplied = true;
      order.pricing.total = order.pricing.transferFee || 150;
      order.pricing.servicesTotal = 0;
      order.pricing.emergencyFee = 0;
      note = `تم إلغاء الطلب من قبل المريض بعد تحرك المركز. تم تطبيق رسوم إلغاء بقيمة ${order.pricing.total} جنيه. السبب: ${cancelReason || 'إلغاء من قبل المريض'}`;
    }

    order.status = 'cancelled';
    order.cancelReason = cancelReason || 'إلغاء من قبل المريض';
    order.statusHistory.push({
      status: 'cancelled',
      timestamp: new Date(),
      updatedBy: patientId,
      updatedByModel: 'User',
      note: note
    });

    await order.save();

    // Socket broadcast status update
    try {
      const { emitOrderStatus } = require('../socket/socket');
      emitOrderStatus(order._id, 'cancelled');
    } catch (err) {
      console.error('Socket broadcast error:', err.message);
    }

    // Trigger FCM notify to technician if assigned
    if (order.technician) {
      await notificationService.notifyTechnicianOrderCancelled(order);
    }

    res.status(200).json({
      success: true,
      message: 'تم إلغاء الطلب بنجاح',
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// 5. Rate Technician (Patient)
exports.rateOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const patientId = req.user.id;
    const { rating, review } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'يرجى تقديم تقييم صالح بين 1 إلى 5 نجوم',
        code: 'VALIDATION_ERROR',
        statusCode: 400
      });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود',
        code: 'ORDER_001',
        statusCode: 404
      });
    }

    // Access check
    if (String(order.patient) !== String(patientId)) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بتقييم هذا الطلب',
        code: 'AUTH_005',
        statusCode: 403
      });
    }

    // Verification check: Can only rate completed/report_ready orders
    if (order.status !== 'completed' && order.status !== 'report_ready') {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن تقييم الفني قبل إتمام تقديم الخدمة بالكامل',
        code: 'ORDER_002',
        statusCode: 400
      });
    }

    if (!order.technician) {
      return res.status(400).json({
        success: false,
        message: 'لم يتم تعيين فني لهذا الطلب لتقييمه',
        code: 'ORDER_002',
        statusCode: 400
      });
    }

    // Save rating to Order
    order.technicianRating = rating;
    order.technicianReview = review || '';
    await order.save();

    // Recalculate and update Technician average rating in DB
    const tech = await Technician.findById(order.technician);
    if (tech) {
      const totalRatings = tech.totalRatings + 1;
      const currentRatingTotal = tech.rating * tech.totalRatings;
      const newRating = (currentRatingTotal + rating) / totalRatings;

      tech.rating = parseFloat(newRating.toFixed(2));
      tech.totalRatings = totalRatings;
      await tech.save();
    }

    res.status(200).json({
      success: true,
      message: 'تم تسجيل التقييم بنجاح. شكراً لك!',
      data: order
    });
  } catch (error) {
    next(error);
  }
};
