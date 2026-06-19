const Service = require('../models/Service');
const PricingConfig = require('../models/PricingConfig');

/**
 * Calculates order price breakdown server-side based on actual DB config.
 * @param {Array<string>} serviceIds Array of Service IDs
 * @param {boolean} isEmergency Whether order is marked as emergency
 * @returns {Promise<Object>} Object containing servicesTotal, transferFee, emergencyFee, discount, total, and services details
 */
exports.calculateOrderPrice = async (serviceIds, isEmergency = false) => {
  if (!serviceIds || serviceIds.length === 0) {
    throw new Error('يرجى تحديد خدمة واحدة على الأقل');
  }

  // Fetch services from DB
  const services = await Service.find({ _id: { $in: serviceIds }, isActive: true });
  
  if (services.length !== serviceIds.length) {
    throw new Error('بعض الخدمات المحددة غير صالحة أو غير نشطة');
  }

  // Fetch latest pricing config
  let pricingConfig = await PricingConfig.findOne().sort({ createdAt: -1 });
  if (!pricingConfig) {
    // Default fallback if not seeded
    pricingConfig = {
      transferFeeBase: 100,
      emergencySurcharge: 150,
      homeServiceFee: 50
    };
  }

  const servicesTotal = services.reduce((sum, s) => sum + s.price, 0);
  const transferFee = pricingConfig.transferFeeBase;
  const emergencyFee = isEmergency ? pricingConfig.emergencySurcharge : 0;
  const total = servicesTotal + transferFee + emergencyFee;

  const serviceSnapshots = services.map(s => ({
    serviceId: s._id,
    nameAr: s.nameAr,
    nameEn: s.nameEn,
    price: s.price
  }));

  return {
    servicesTotal,
    transferFee,
    emergencyFee,
    discount: 0,
    total,
    servicesList: serviceSnapshots
  };
};
