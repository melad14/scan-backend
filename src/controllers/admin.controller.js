const Order = require('../models/Order');
const Technician = require('../models/Technician');
const User = require('../models/User');
const PricingConfig = require('../models/PricingConfig');
const bcrypt = require('bcryptjs');
const notificationService = require('../services/notification.service');

// 1. Get Dashboard Core Stats
exports.getDashboardStats = async (req, res, next) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // 1. Active orders count today
    const ordersToday = await Order.countDocuments({
      createdAt: { $gte: startOfToday, $lte: endOfToday }
    });

    // 2. Revenue calculation (Completed and Report Ready orders total)
    const completedOrders = await Order.find({
      status: { $in: ['completed', 'report_ready'] }
    });
    const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.pricing?.total || 0), 0);

    // 3. Active & Online Technicians
    const activeTechs = await Technician.countDocuments({
      isAvailable: true,
      isActive: true
    });

    // 4. Pending assignments count
    const pendingAssignments = await Order.countDocuments({
      status: 'pending',
      technician: null
    });

    res.status(200).json({
      success: true,
      message: 'تم استرجاع الإحصائيات العامة بنجاح',
      data: {
        ordersToday,
        totalRevenue,
        activeTechs,
        pendingAssignments
      }
    });
  } catch (error) {
    next(error);
  }
};

// 2. Get All Orders (With Filters and Pagination)
exports.getOrdersList = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const status = req.query.status;
    const search = req.query.search; // Order number or patient name/phone

    const query = {};

    // Status filter
    if (status && status !== 'all') {
      query.status = status;
    }

    // Search filter
    if (search) {
      // Check if matches order number format
      if (search.toUpperCase().startsWith('XR-')) {
        query.orderNumber = { $regex: search, $options: 'i' };
      } else {
        // Search in patient snapshot details
        query.$or = [
          { 'patientSnapshot.name': { $regex: search, $options: 'i' } },
          { 'patientSnapshot.phone': { $regex: search, $options: 'i' } }
        ];
      }
    }

    const total = await Order.countDocuments(query);
    const pages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;

    const orders = await Order.find(query)
      .populate('technician', 'name phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      message: 'تم استرجاع قائمة الطلبات بنجاح',
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

// 3. Assign Technician Manually (Admin)
exports.assignTechnician = async (req, res, next) => {
  try {
    const { id } = req.params; // Order ID
    const { technicianId } = req.body;
    const adminId = req.user.id;

    if (!technicianId) {
      return res.status(400).json({
        success: false,
        message: 'يرجى تحديد الفني المراد تعيينه',
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

    // Ensure technician exists and is active
    const tech = await Technician.findById(technicianId);
    if (!tech || !tech.isActive) {
      return res.status(404).json({
        success: false,
        message: 'الفني المحدد غير موجود أو غير نشط',
        code: 'AUTH_003',
        statusCode: 404
      });
    }

    // Assign
    order.technician = technicianId;
    order.status = 'assigned';
    order.statusHistory.push({
      status: 'assigned',
      timestamp: new Date(),
      updatedBy: adminId,
      updatedByModel: 'Admin',
      note: `تم تعيين الفني ${tech.name} للطلب بواسطة الإدارة`
    });

    await order.save();

    // Socket broadcast status update
    try {
      const { emitOrderStatus } = require('../socket/socket');
      emitOrderStatus(order._id, 'assigned');
    } catch (err) {
      console.error('Socket broadcast error:', err.message);
    }

    // Trigger FCM to technician
    await notificationService.notifyTechnicianNewOrder(order);
    // Trigger FCM to patient
    await notificationService.notifyPatientTechAssigned(order);

    res.status(200).json({
      success: true,
      message: 'تم تعيين الفني للطلب بنجاح',
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// 4. Force Update Status Manually (Support/Admin overriding)
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;
    const adminId = req.user.id;

    const allowedStatuses = [
      'pending',
      'accepted',
      'assigned',
      'on_way',
      'arrived',
      'in_progress',
      'completed',
      'report_ready',
      'cancelled'
    ];

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'حالة الطلب غير صالحة',
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

    order.status = status;
    order.statusHistory.push({
      status,
      timestamp: new Date(),
      updatedBy: adminId,
      updatedByModel: 'Admin',
      note: note || `تحديث يدوي للحالة إلى ${status} بواسطة الإدارة`
    });

    await order.save();

    // Socket broadcast status update
    try {
      const { emitOrderStatus } = require('../socket/socket');
      emitOrderStatus(order._id, status);
    } catch (err) {
      console.error('Socket broadcast error:', err.message);
    }

    res.status(200).json({
      success: true,
      message: 'تم تحديث حالة الطلب يدوياً بنجاح',
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// 5. Get List of All Technicians
exports.getAllTechnicians = async (req, res, next) => {
  try {
    const techs = await Technician.find().sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      message: 'تم استرجاع قائمة الفنيين بنجاح',
      data: techs
    });
  } catch (error) {
    next(error);
  }
};

// 6. Add New Technician
exports.addTechnician = async (req, res, next) => {
  try {
    const { name, phone, password, nationalId, region } = req.body;

    if (!name || !phone || !password || !nationalId || !region) {
      return res.status(400).json({
        success: false,
        message: 'بيانات الفني غير مكتملة',
        code: 'VALIDATION_ERROR',
        statusCode: 400
      });
    }

    const exists = await Technician.exists({ phone });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'رقم هاتف الفني مسجل مسبقاً',
        code: 'DUPLICATE_KEY',
        statusCode: 400
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const tech = await Technician.create({
      name,
      phone,
      passwordHash,
      nationalId,
      region,
      photo: req.body.photo || 'https://placehold.co/150x150.png',
      isActive: true,
      isAvailable: true
    });

    res.status(201).json({
      success: true,
      message: 'تم إضافة الفني بنجاح',
      data: {
        id: tech._id,
        name: tech.name,
        phone: tech.phone,
        region: tech.region
      }
    });
  } catch (error) {
    next(error);
  }
};

// 7. Edit Technician Details
exports.editTechnician = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, phone, region, nationalId, photo } = req.body;

    const tech = await Technician.findById(id);
    if (!tech) {
      return res.status(404).json({
        success: false,
        message: 'الفني غير موجود',
        code: 'AUTH_003',
        statusCode: 404
      });
    }

    // Update fields
    if (name) tech.name = name;
    if (phone) tech.phone = phone;
    if (region) tech.region = region;
    if (nationalId) tech.nationalId = nationalId;
    if (photo) tech.photo = photo;

    // Handle password update if passed
    if (req.body.password) {
      tech.passwordHash = await bcrypt.hash(req.body.password, 10);
    }

    await tech.save();

    res.status(200).json({
      success: true,
      message: 'تم تحديث بيانات الفني بنجاح',
      data: tech
    });
  } catch (error) {
    next(error);
  }
};

// 8. Block / Unblock Technician
exports.toggleTechnicianActive = async (req, res, next) => {
  try {
    const { id } = req.params;

    const tech = await Technician.findById(id);
    if (!tech) {
      return res.status(404).json({
        success: false,
        message: 'الفني غير موجود',
        code: 'AUTH_003',
        statusCode: 404
      });
    }

    tech.isActive = !tech.isActive;
    await tech.save();

    res.status(200).json({
      success: true,
      message: tech.isActive ? 'تم تنشيط الفني بنجاح' : 'تم حظر الفني وإيقاف حسابه بنجاح',
      data: {
        isActive: tech.isActive
      }
    });
  } catch (error) {
    next(error);
  }
};

// 9. Get Patients directory
exports.getAllPatients = async (req, res, next) => {
  try {
    const search = req.query.search;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const patients = await User.find(query).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: 'تم استرجاع قائمة المرضى بنجاح',
      data: patients
    });
  } catch (error) {
    next(error);
  }
};

// 10. Update Platform Pricing Config
exports.editPricingConfig = async (req, res, next) => {
  try {
    const { transferFeeBase, emergencySurcharge, homeServiceFee } = req.body;
    const adminId = req.user.id;

    let pricing = await PricingConfig.findOne().sort({ createdAt: -1 });
    
    if (!pricing) {
      pricing = new PricingConfig();
    }

    if (transferFeeBase !== undefined) pricing.transferFeeBase = transferFeeBase;
    if (emergencySurcharge !== undefined) pricing.emergencySurcharge = emergencySurcharge;
    if (homeServiceFee !== undefined) pricing.homeServiceFee = homeServiceFee;
    pricing.updatedBy = adminId;

    await pricing.save();

    res.status(200).json({
      success: true,
      message: 'تم تحديث رسوم المنصة بنجاح',
      data: pricing
    });
  } catch (error) {
    next(error);
  }
};
