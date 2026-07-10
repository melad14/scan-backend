const bcrypt = require('bcryptjs');
const Service = require('../models/Service');
const Category = require('../models/Category');
const PricingConfig = require('../models/PricingConfig');
const Admin = require('../models/Admin');
const Technician = require('../models/Technician');

const autoSeed = async () => {
  try {
    // 1. Seed Categories if empty or missing
    const categoriesToSeed = [
      {
        nameAr: 'أشعة سينية',
        nameEn: 'X-Ray',
        key: 'xray',
        icon: 'monitor_heart',
        iconBg: '#1A1D9E75',
        iconColor: '#1D9E75',
        sortOrder: 1,
        isActive: true
      },
      {
        nameAr: 'إيكو قلب',
        nameEn: 'Echo',
        key: 'echo',
        icon: 'favorite',
        iconBg: '#E6F0FA',
        iconColor: '#2B7EC2',
        sortOrder: 2,
        isActive: true
      },
      {
        nameAr: 'رسم قلب',
        nameEn: 'ECG',
        key: 'ecg',
        icon: 'show_chart',
        iconBg: '#FEF3E2',
        iconColor: '#D97B0A',
        sortOrder: 3,
        isActive: true
      },
      {
        nameAr: 'تحاليل طبية',
        nameEn: 'Lab Tests',
        key: 'lab',
        icon: 'science',
        iconBg: '#EFF6E8',
        iconColor: '#4D8C2C',
        sortOrder: 4,
        isActive: true
      },
      {
        nameAr: 'موجات صوتية',
        nameEn: 'Ultrasound / Sonar',
        key: 'sonar',
        icon: 'bubble_chart',
        iconBg: '#E8F5E9',
        iconColor: '#2E7D32',
        sortOrder: 5,
        isActive: true
      },
      {
        nameAr: 'هولتر',
        nameEn: 'Holter',
        key: 'holter',
        icon: 'watch',
        iconBg: '#F3E5F5',
        iconColor: '#7B1FA2',
        sortOrder: 6,
        isActive: true
      }
    ];

    for (const cat of categoriesToSeed) {
      const exists = await Category.findOne({ key: cat.key });
      if (!exists) {
        await Category.create(cat);
        console.log(`Seeded category ${cat.key} successfully.`);
      }
    }

    // 2. Seed Services if missing
    const servicesToSeed = [
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
        category: 'ecg',
        price: 300,
        sortOrder: 3,
        description: 'رسم قلب منزلي متنقل مع تقرير فوري'
      },
      {
        nameAr: 'فحص إيكو على القلب منزلي',
        nameEn: 'Home Echocardiography (Echo)',
        category: 'echo',
        price: 800,
        sortOrder: 4,
        description: 'فحص الموجات الصوتية على القلب (الإيكو) منزلياً مع تقرير مفصل'
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
      },
      {
        nameAr: 'موجات صوتية على البطن والحوض',
        nameEn: 'Abdominal & Pelvic Ultrasound',
        category: 'sonar',
        price: 600,
        sortOrder: 1,
        description: 'فحص موجات صوتية (سونار) منزلي للبطن والحوض مع تقرير فوري'
      },
      {
        nameAr: 'موجات صوتية على الغدة الدرقية',
        nameEn: 'Thyroid Ultrasound',
        category: 'sonar',
        price: 500,
        sortOrder: 2,
        description: 'فحص موجات صوتية (سونار) منزلي للغدة الدرقية'
      },
      {
        nameAr: 'رسم قلب مستمر 24 ساعة (هولتر)',
        nameEn: '24-Hour Holter Monitoring',
        category: 'holter',
        price: 900,
        sortOrder: 1,
        description: 'تركيب جهاز هولتر منزلي لقياس رسم القلب المستمر لمدة 24 ساعة'
      },
      {
        nameAr: 'رسم قلب مستمر 48 ساعة (هولتر)',
        nameEn: '48-Hour Holter Monitoring',
        category: 'holter',
        price: 1300,
        sortOrder: 2,
        description: 'تركيب جهاز هولتر منزلي لقياس رسم القلب المستمر لمدة 48 ساعة'
      }
    ];

    for (const service of servicesToSeed) {
      const exists = await Service.findOne({ nameAr: service.nameAr });
      if (!exists) {
        await Service.create(service);
        console.log(`Seeded service ${service.nameAr} successfully.`);
      }
    }

    // 3. Seed default pricing config if empty
    const pricingCount = await PricingConfig.countDocuments();
    if (pricingCount === 0) {
      await PricingConfig.create({
        transferFeeBase: 100,
        emergencySurcharge: 150,
        homeServiceFee: 50
      });
      console.log('Auto-seeded default pricing config.');
    }

    // 4. Seed default system settings if empty
    const SystemSettings = require('../models/SystemSettings');
    const settingsCount = await SystemSettings.countDocuments();
    if (settingsCount === 0) {
      await SystemSettings.create({
        defaultTransferFee: 150,
        cancellationPolicy: 'لقد تحرك فريق المركز بالفعل نحو موقعك. عند الإلغاء الآن سيتم فرض رسوم الانتقال وقدرها [FEE] جنيه.'
      });
      console.log('Auto-seeded default system settings.');
    }

    // 5. Seed default admin if empty
    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
      const adminPasswordHash = await bcrypt.hash('adminpassword', 10);
      await Admin.create({
        name: 'مدير النظام الرئيسي',
        email: 'admin@scango.com',
        passwordHash: adminPasswordHash,
        role: 'super_admin',
        isActive: true
      });
      console.log('Auto-seeded default admin (admin@scango.com / adminpassword).');
    }

    // 6. Seed default technician if empty
    const techCount = await Technician.countDocuments();
    if (techCount === 0) {
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
    }

    console.log('Auto-seeding completed successfully!');
  } catch (error) {
    console.error('Error during auto-seeding:', error.message);
  }
};

module.exports = autoSeed;
