const Order = require('../models/Order');
const Technician = require('../models/Technician');
const User = require('../models/User');
const PricingConfig = require('../models/PricingConfig');
const Service = require('../models/Service');
const Category = require('../models/Category');
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

// 11. Create a New Service
exports.createService = async (req, res, next) => {
  try {
    const { nameAr, nameEn, category, price, description, sortOrder, instructionsAr, instructionsEn } = req.body;

    if (!nameAr || !nameEn || !category || price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'بيانات الخدمة غير مكتملة',
        code: 'VALIDATION_ERROR',
        statusCode: 400
      });
    }

    let finalSortOrder = Number(sortOrder);
    if (!sortOrder || finalSortOrder === 0) {
      const maxService = await Service.findOne({ category }).sort({ sortOrder: -1 });
      finalSortOrder = maxService ? maxService.sortOrder + 10 : 10;
    }

    const service = await Service.create({
      nameAr,
      nameEn,
      category,
      price: Number(price),
      description: description || '',
      instructionsAr: instructionsAr || '',
      instructionsEn: instructionsEn || '',
      sortOrder: finalSortOrder,
      isActive: true
    });

    res.status(201).json({
      success: true,
      message: 'تم إضافة الخدمة بنجاح',
      data: service
    });
  } catch (error) {
    next(error);
  }
};

// 12. Update Service Details
exports.updateService = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nameAr, nameEn, category, price, description, sortOrder, isActive, instructionsAr, instructionsEn } = req.body;

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'الخدمة غير موجودة',
        code: 'NOT_FOUND',
        statusCode: 404
      });
    }

    if (nameAr !== undefined) service.nameAr = nameAr;
    if (nameEn !== undefined) service.nameEn = nameEn;
    if (category !== undefined) service.category = category;
    if (price !== undefined) service.price = Number(price);
    if (description !== undefined) service.description = description;
    if (instructionsAr !== undefined) service.instructionsAr = instructionsAr;
    if (instructionsEn !== undefined) service.instructionsEn = instructionsEn;
    if (sortOrder !== undefined) service.sortOrder = Number(sortOrder);
    if (isActive !== undefined) service.isActive = isActive;

    await service.save();

    res.status(200).json({
      success: true,
      message: 'تم تحديث الخدمة بنجاح',
      data: service
    });
  } catch (error) {
    next(error);
  }
};

// 13. Delete Service Document
exports.deleteService = async (req, res, next) => {
  try {
    const { id } = req.params;
    const service = await Service.findByIdAndDelete(id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'الخدمة غير موجودة',
        code: 'NOT_FOUND',
        statusCode: 404
      });
    }

    res.status(200).json({
      success: true,
      message: 'تم حذف الخدمة بنجاح'
    });
  } catch (error) {
    next(error);
  }
};

// 14. Get List of All Categories (Admin)
exports.getAllCategories = async (req, res, next) => {
  try {
    const categories = await Category.find().sort({ sortOrder: 1 });
    
    res.status(200).json({
      success: true,
      message: 'تم استرجاع قائمة التصنيفات بنجاح',
      data: categories
    });
  } catch (error) {
    next(error);
  }
};

// 15. Create Category
exports.createCategory = async (req, res, next) => {
  try {
    const { nameAr, nameEn, key, icon, iconBg, iconColor, sortOrder, isActive } = req.body;

    if (!nameAr || !nameEn || !key) {
      return res.status(400).json({
        success: false,
        message: 'بيانات التصنيف غير مكتملة (الاسم والمفتاح مطلوبان)',
        code: 'VALIDATION_ERROR',
        statusCode: 400
      });
    }

    const keyLower = key.toLowerCase().trim();
    const exists = await Category.exists({ key: keyLower });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'مفتاح التصنيف مسجل مسبقاً، يرجى اختيار مفتاح آخر فريد',
        code: 'DUPLICATE_KEY',
        statusCode: 400
      });
    }

    let finalSortOrder = Number(sortOrder);
    if (!sortOrder || finalSortOrder === 0) {
      const maxCat = await Category.findOne().sort({ sortOrder: -1 });
      finalSortOrder = maxCat ? maxCat.sortOrder + 10 : 10;
    }

    const category = await Category.create({
      nameAr,
      nameEn,
      key: keyLower,
      icon: icon || 'category',
      iconBg: iconBg || '#1A1D9E75',
      iconColor: iconColor || '#1D9E75',
      sortOrder: finalSortOrder,
      isActive: isActive !== undefined ? isActive : true
    });

    res.status(201).json({
      success: true,
      message: 'تم إضافة التصنيف بنجاح',
      data: category
    });
  } catch (error) {
    next(error);
  }
};

// 16. Update Category Details
exports.updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nameAr, nameEn, key, icon, iconBg, iconColor, sortOrder, isActive } = req.body;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'التصنيف غير موجود',
        code: 'NOT_FOUND',
        statusCode: 404
      });
    }

    if (key !== undefined) {
      const keyLower = key.toLowerCase().trim();
      if (keyLower !== category.key) {
        const exists = await Category.exists({ key: keyLower, _id: { $ne: id } });
        if (exists) {
          return res.status(400).json({
            success: false,
            message: 'مفتاح التصنيف مسجل مسبقاً لموقع آخر',
            code: 'DUPLICATE_KEY',
            statusCode: 400
          });
        }
        
        // Also update any services that are using the old category key!
        await Service.updateMany({ category: category.key }, { category: keyLower });
        category.key = keyLower;
      }
    }

    if (nameAr !== undefined) category.nameAr = nameAr;
    if (nameEn !== undefined) category.nameEn = nameEn;
    if (icon !== undefined) category.icon = icon;
    if (iconBg !== undefined) category.iconBg = iconBg;
    if (iconColor !== undefined) category.iconColor = iconColor;
    if (sortOrder !== undefined) category.sortOrder = Number(sortOrder);
    if (isActive !== undefined) category.isActive = isActive;

    await category.save();

    res.status(200).json({
      success: true,
      message: 'تم تحديث التصنيف بنجاح',
      data: category
    });
  } catch (error) {
    next(error);
  }
};

// 17. Delete Category
exports.deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'التصنيف غير موجود',
        code: 'NOT_FOUND',
        statusCode: 404
      });
    }

    // Check if there are active services in this category
    const servicesCount = await Service.countDocuments({ category: category.key });
    if (servicesCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'لا يمكن حذف التصنيف لوجود خدمات نشطة مرتبطة به حالياً. يرجى حذف الخدمات أو نقلها أولاً.',
        code: 'DELETE_DENIED',
        statusCode: 400
      });
    }

    await Category.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'تم حذف التصنيف بنجاح'
    });
  } catch (error) {
    next(error);
  }
};

// 18. Reorder Categories
exports.reorderCategories = async (req, res, next) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({
        success: false,
        message: 'قائمة المعرفات مطلوبة لإعادة الترتيب',
        code: 'VALIDATION_ERROR',
        statusCode: 400
      });
    }

    for (let i = 0; i < orderedIds.length; i++) {
      await Category.findByIdAndUpdate(orderedIds[i], { sortOrder: (i + 1) * 10 });
    }

    res.status(200).json({
      success: true,
      message: 'تم إعادة ترتيب التصنيفات بنجاح'
    });
  } catch (error) {
    next(error);
  }
};

// 19. Reorder Services
exports.reorderServices = async (req, res, next) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({
        success: false,
        message: 'قائمة المعرفات مطلوبة لإعادة الترتيب',
        code: 'VALIDATION_ERROR',
        statusCode: 400
      });
    }

    for (let i = 0; i < orderedIds.length; i++) {
      await Service.findByIdAndUpdate(orderedIds[i], { sortOrder: (i + 1) * 10 });
    }

    res.status(200).json({
      success: true,
      message: 'تم إعادة ترتيب الخدمات بنجاح'
    });
  } catch (error) {
    next(error);
  }
};

// 20. Price Prescription Only Order
exports.pricePrescription = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { serviceIds, customPrice, transferFee, notes } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود',
        statusCode: 404
      });
    }

    // Fetch details for services
    const servicesList = [];
    let calculatedTotal = 0;

    if (serviceIds && serviceIds.length > 0) {
      for (const sId of serviceIds) {
        const dbService = await Service.findById(sId);
        if (dbService) {
          servicesList.push({
            serviceId: dbService._id,
            nameAr: dbService.nameAr,
            nameEn: dbService.nameEn,
            price: dbService.price
          });
          calculatedTotal += dbService.price;
        }
      }
    }

    order.services = servicesList;
    order.pricing.servicesTotal = calculatedTotal;
    order.pricing.transferFee = transferFee !== undefined ? transferFee : order.pricing.transferFee;
    order.pricing.total = customPrice !== undefined ? customPrice : (calculatedTotal + order.pricing.transferFee);
    order.needsPricing = false;
    order.status = 'accepted';
    if (notes) {
      order.caseDetails.notes = notes;
    }

    order.statusHistory.push({
      status: 'accepted',
      timestamp: new Date(),
      updatedBy: req.user.id,
      updatedByModel: 'Admin',
      note: 'تم تسعير الروشتة وتأكيد الطلب من قبل الإدارة'
    });

    await order.save();

    // Send notification to patient
    try {
      await notificationService.notifyPatientOrderAccepted(order);
    } catch (err) {
      console.error('Failed to notify patient of accepted order:', err);
    }

    res.status(200).json({
      success: true,
      message: 'تم تسعير الروشتة وتأكيد الطلب بنجاح',
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// 21. Approve Scan Results
exports.approveResults = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { approve } = req.body; // boolean

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود',
        statusCode: 404
      });
    }

    order.isResultsApproved = approve !== undefined ? approve : true;
    await order.save();

    if (order.isResultsApproved) {
      // Trigger FCM notify to patient that reports/results are ready
      try {
        await notificationService.notifyPatientReportReady(order);
      } catch (err) {
        console.error('Failed to send report ready notification:', err);
      }
    }

    res.status(200).json({
      success: true,
      message: order.isResultsApproved ? 'تم نشر نتائج الفحص للمريض بنجاح' : 'تم حجب نتائج الفحص بنجاح',
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// 22. Update Order Payment
exports.updateOrderPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { paymentStatus, paymentMethod } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود',
        statusCode: 404
      });
    }

    if (paymentStatus) {
      order.payment.status = paymentStatus;
      if (paymentStatus === 'paid') {
        order.payment.paidAt = new Date();
      }
    }
    if (paymentMethod) {
      order.payment.method = paymentMethod;
    }

    await order.save();

    res.status(200).json({
      success: true,
      message: 'تم تحديث تفاصيل الدفع بنجاح',
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// 23. Get Complaints List
exports.getComplaintsList = async (req, res, next) => {
  try {
    const Complaint = require('../models/Complaint');
    const { status, role } = req.query;
    const query = {};

    if (status) {
      query.status = status;
    }
    if (role) {
      query.senderModel = role === 'patient' ? 'User' : 'Technician';
    }

    const complaints = await Complaint.find(query)
      .populate({
        path: 'orderId',
        select: 'orderNumber status patientSnapshot services pricing'
      })
      .populate({
        path: 'sender',
        select: 'name phone email'
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: 'تم استرجاع قائمة الشكاوى بنجاح',
      data: complaints
    });
  } catch (error) {
    next(error);
  }
};

// 24. Update Complaint Status
exports.updateComplaintStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const Complaint = require('../models/Complaint');
    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'الشكوى غير موجودة',
        statusCode: 404
      });
    }

    complaint.status = status;
    await complaint.save();

    res.status(200).json({
      success: true,
      message: 'تم تحديث حالة الشكوى بنجاح',
      data: complaint
    });
  } catch (error) {
    next(error);
  }
};

// 25. Get System Settings
exports.getSystemSettings = async (req, res, next) => {
  try {
    const SystemSettings = require('../models/SystemSettings');
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create({
        defaultTransferFee: 150,
        emergencyExtraFee: 150,
        cancellationPolicyAr: 'لقد تحرك فريق المركز بالفعل نحو موقعك. عند الإلغاء الآن سيتم فرض رسوم الانتقال وقدرها [FEE] جنيه.',
        cancellationPolicyEn: 'The medical team has already started their trip to your location. Cancelling now will incur a transfer fee of [FEE] EGP.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'تم استرجاع الإعدادات بنجاح',
      data: settings
    });
  } catch (error) {
    next(error);
  }
};

// 26. Update System Settings
exports.updateSystemSettings = async (req, res, next) => {
  try {
    const { defaultTransferFee, emergencyExtraFee, cancellationPolicyAr, cancellationPolicyEn } = req.body;
    const SystemSettings = require('../models/SystemSettings');
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = new SystemSettings({});
    }

    if (defaultTransferFee !== undefined) settings.defaultTransferFee = defaultTransferFee;
    if (emergencyExtraFee !== undefined) settings.emergencyExtraFee = emergencyExtraFee;
    if (cancellationPolicyAr !== undefined) settings.cancellationPolicyAr = cancellationPolicyAr;
    if (cancellationPolicyEn !== undefined) settings.cancellationPolicyEn = cancellationPolicyEn;

    await settings.save();

    res.status(200).json({
      success: true,
      message: 'تم تحديث الإعدادات بنجاح',
      data: settings
    });
  } catch (error) {
    next(error);
  }
};

