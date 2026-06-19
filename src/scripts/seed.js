const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const Service = require('../models/Service');
const PricingConfig = require('../models/PricingConfig');
const Admin = require('../models/Admin');
const Technician = require('../models/Technician');

const seedData = async () => {
  try {
    // Connect to DB
    await connectDB();

    console.log('Clearing existing database collections...');
    await Service.deleteMany({});
    await PricingConfig.deleteMany({});
    await Admin.deleteMany({});
    await Technician.deleteMany({});

    console.log('Seeding default Services...');
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
    console.log(`Successfully seeded ${services.length} services.`);

    console.log('Seeding default Pricing Configuration...');
    const pricingConfig = await PricingConfig.create({
      transferFeeBase: 100,
      emergencySurcharge: 150,
      homeServiceFee: 50
    });
    console.log('Successfully seeded pricing config:', pricingConfig);

    console.log('Seeding Admin account...');
    const adminPasswordHash = await bcrypt.hash('adminpassword', 10);
    const admin = await Admin.create({
      name: 'مدير النظام الرئيسي',
      email: 'admin@scango.com',
      passwordHash: adminPasswordHash,
      role: 'super_admin',
      isActive: true
    });
    console.log('Successfully seeded admin:', admin.email);

    console.log('Seeding Technician account...');
    const techPasswordHash = await bcrypt.hash('techpassword', 10);
    const tech = await Technician.create({
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
    console.log('Successfully seeded technician:', tech.phone);

    console.log('Database Seeding Completed Successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding Failed:', error);
    process.exit(1);
  }
};

seedData();
