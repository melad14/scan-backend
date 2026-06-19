const Service = require('../models/Service');
const PricingConfig = require('../models/PricingConfig');

// 1. Get all active services
exports.getAllServices = async (req, res, next) => {
  try {
    const services = await Service.find({ isActive: true }).sort({ sortOrder: 1 });
    
    res.status(200).json({
      success: true,
      message: 'تم استرجاع الخدمات بنجاح',
      data: services
    });
  } catch (error) {
    next(error);
  }
};

// 2. Get active X-Ray services
exports.getXrayServices = async (req, res, next) => {
  try {
    const services = await Service.find({ category: 'xray', isActive: true }).sort({ sortOrder: 1 });
    
    res.status(200).json({
      success: true,
      message: 'تم استرجاع خدمات الأشعة بنجاح',
      data: services
    });
  } catch (error) {
    next(error);
  }
};

// 3. Get active Lab services
exports.getLabServices = async (req, res, next) => {
  try {
    const services = await Service.find({ category: 'lab', isActive: true }).sort({ sortOrder: 1 });
    
    res.status(200).json({
      success: true,
      message: 'تم استرجاع خدمات التحاليل بنجاح',
      data: services
    });
  } catch (error) {
    next(error);
  }
};

// 4. Get active Surcharge Surcharges Config
exports.getPricingConfig = async (req, res, next) => {
  try {
    const pricing = await PricingConfig.findOne().sort({ createdAt: -1 });
    
    if (!pricing) {
      return res.status(404).json({
        success: false,
        message: 'إعدادات التسعير غير متوفرة',
        code: 'NOT_FOUND',
        statusCode: 404
      });
    }

    res.status(200).json({
      success: true,
      message: 'تم استرجاع أسعار رسوم المنصة بنجاح',
      data: pricing
    });
  } catch (error) {
    next(error);
  }
};
