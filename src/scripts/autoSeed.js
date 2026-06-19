const bcrypt = require('bcryptjs');
const Service = require('../models/Service');
const PricingConfig = require('../models/PricingConfig');
const Admin = require('../models/Admin');
const Technician = require('../models/Technician');

const autoSeed = async () => {
  try {
    const serviceCount = await Service.countDocuments();
    if (serviceCount > 0) {
      console.log('Database already has data. Skipping auto-seeding.');
      return;
    }

    console.log('Database is empty. Running auto-seeding...');

    const services = [
      {
        nameAr: 'أشعة على الصدر',
        nameEn: 'Chest X-Ray',
        category: 'xray',
        price: 400,
        sortOrder: 1,
        description: 'تصوير الصدر بالأشعة السينية المنزلية المتنقلة'
      },
      {
        nameAr: 'أشعة على الحوض',
        nameEn: 'Pelvis X-Ray',
        category: 'xray',
        price: 450,
        sortOrder: 2,
        description: 'تصوير الحوض بالأشعة السينية المنزلية المتنقلة'
      },
      {
        nameAr: 'رسم قلب متنقل',
        nameEn: 'ECG / Electrocardiogram',
        category: 'xray',
        price: 300,
        sortOrder: 3,
        description: 'رسم قلب منزلي متنقل مع تقرير فوري'
      },
      {
        nameAr: 'صورة دم كاملة',
        nameEn: 'Complete Blood Count (CBC)',
        category: 'lab',
        price: 200,
        sortOrder: 4,
        description: 'تحليل صورة دم كاملة في المنزل'
      },
      {
        nameAr: 'تحليل سكر صائم',
        nameEn: 'Fasting Blood Sugar (FBS)',
        category: 'lab',
        price: 100,
        sortOrder: 5,
        description: 'تحليل نسبة السكر في الدم صائم'
      },
      {
        nameAr: 'تحليل وظائف كلى',
        nameEn: 'Kidney Function Test',
        category: 'lab',
        price: 250,
        sortOrder: 6,
        description: 'تحليل وظائف الكلى (كرياتينين ويوريا) منزلي'
      },
      {
        nameAr: 'تحليل وظائف كبد',
        nameEn: 'Liver Function Test',
        category: 'lab',
        price: 300,
        sortOrder: 7,
        description: 'تحليل إنزيمات ووظائف الكبد بالمنزل'
      }
    ];

    await Service.insertMany(services);
    console.log(`Auto-seeded ${services.length} services.`);

    await PricingConfig.create({
      transferFeeBase: 100,
      emergencySurcharge: 150,
      homeServiceFee: 50
    });
    console.log('Auto-seeded default pricing config.');

    const adminPasswordHash = await bcrypt.hash('adminpassword', 10);
    await Admin.create({
      name: 'مدير النظام الرئيسي',
      email: 'admin@scango.com',
      passwordHash: adminPasswordHash,
      role: 'super_admin',
      isActive: true
    });
    console.log('Auto-seeded default admin (admin@scango.com / adminpassword).');

    const techPasswordHash = await bcrypt.hash('techpassword', 10);
    await Technician.create({
      name: 'أحمد علي',
      phone: '01012345678',
      passwordHash: techPasswordHash,
      nationalId: '29501010101234',
      photo: 'https://placehold.co/150x150.png',
      rating: 4.8,
      totalRatings: 10,
      completedOrders: 15,
      isAvailable: true,
      isActive: true,
      region: 'Cairo',
      currentLocation: {
        type: 'Point',
        coordinates: [31.2357, 30.0444] // Cairo
      }
    });
    console.log('Auto-seeded default technician (01012345678 / techpassword).');
    console.log('Auto-seeding completed successfully!');
  } catch (error) {
    console.error('Error during auto-seeding:', error.message);
  }
};

module.exports = autoSeed;
