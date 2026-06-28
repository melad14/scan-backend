const Notification = require('../models/Notification');
const User = require('../models/User');
const Technician = require('../models/Technician');
const { fcmAvailable, admin } = require('../config/firebase');

// Send generic notification and store in database
const sendNotification = async ({
  recipientId,
  recipientModel,
  type,
  titleAr,
  bodyAr,
  orderId,
  fcmToken
}) => {
  try {
    // 1. Save to Database
    await Notification.create({
      recipient: recipientId,
      recipientModel,
      type,
      titleAr,
      bodyAr,
      orderId,
      isRead: false
    });

    // 2. Send Firebase Push Notification
    if (fcmAvailable && fcmToken) {
      const message = {
        token: fcmToken,
        notification: {
          title: titleAr,
          body: bodyAr
        },
        data: {
          type,
          orderId: String(orderId)
        }
      };
      
      await admin.messaging().send(message);
      console.log(`[FCM PUSH SUCCESS] Sent push notification to ${recipientModel} (${recipientId})`);
    } else {
      console.log(`\n[FCM SIMULATION LOG]
      Recipient: ${recipientModel} (${recipientId})
      Title (AR): ${titleAr}
      Body (AR): ${bodyAr}
      Type: ${type}
      OrderId: ${orderId}
      FCM Token: ${fcmToken ? 'Provided' : 'Not Set (Patient/Tech offline)'}\n`);
    }
  } catch (error) {
    console.error('Error sending notification:', error.message);
  }
};

// 1. Notify technicians that a new order is available
exports.notifyTechniciansNewOrder = async (order) => {
  try {
    const district = (order.location.district || 'Cairo').trim();
    const technicians = await Technician.find({
      region: { $regex: new RegExp('^' + district.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i') },
      isActive: true,
      isAvailable: true
    });

    for (const tech of technicians) {
      await sendNotification({
        recipientId: tech._id,
        recipientModel: 'Technician',
        type: 'new_order', // Generic trigger key
        titleAr: 'طلب خدمة جديد متاح',
        bodyAr: `هناك طلب جديد في منطقتك برقم ${order.orderNumber}، اضغط للتفاصيل`,
        orderId: order._id,
        fcmToken: tech.fcmToken
      });
    }
  } catch (error) {
    console.error('Error notifying technicians:', error.message);
  }
};

// 2. Notify patient that a technician accepted their order
exports.notifyPatientTechAssigned = async (order) => {
  try {
    const patient = await User.findById(order.patient);
    if (!patient) return;

    await sendNotification({
      recipientId: patient._id,
      recipientModel: 'User',
      type: 'tech_assigned',
      titleAr: 'تم قبول طلبك',
      bodyAr: `تم تعيين الفني للطلب رقم ${order.orderNumber} وجاري التجهيز للزيارة.`,
      orderId: order._id,
      fcmToken: patient.fcmToken
    });
  } catch (error) {
    console.error('Error notifying patient:', error.message);
  }
};

// 3. Notify patient that technician is on the way
exports.notifyPatientTechOnWay = async (order) => {
  try {
    const patient = await User.findById(order.patient);
    if (!patient) return;

    await sendNotification({
      recipientId: patient._id,
      recipientModel: 'User',
      type: 'tech_on_way',
      titleAr: 'الفني في الطريق',
      bodyAr: `الفني في طريقه إليك الآن للطلب رقم ${order.orderNumber}. يرجى التواجد بالمنزل.`,
      orderId: order._id,
      fcmToken: patient.fcmToken
    });
  } catch (error) {
    console.error('Error notifying patient:', error.message);
  }
};

// 4. Notify patient that technician arrived
exports.notifyPatientTechArrived = async (order) => {
  try {
    const patient = await User.findById(order.patient);
    if (!patient) return;

    await sendNotification({
      recipientId: patient._id,
      recipientModel: 'User',
      type: 'tech_arrived',
      titleAr: 'وصل الفني',
      bodyAr: `لقد وصل الفني إلى موقعك للطلب رقم ${order.orderNumber}.`,
      orderId: order._id,
      fcmToken: patient.fcmToken
    });
  } catch (error) {
    console.error('Error notifying patient:', error.message);
  }
};

// 5. Notify patient that report is ready
exports.notifyPatientReportReady = async (order) => {
  try {
    const patient = await User.findById(order.patient);
    if (!patient) return;

    await sendNotification({
      recipientId: patient._id,
      recipientModel: 'User',
      type: 'report_ready',
      titleAr: 'نتيجتك جاهزة',
      bodyAr: `التقرير الطبي وصور الأشعة للطلب رقم ${order.orderNumber} جاهزة للمشاهدة والتحميل.`,
      orderId: order._id,
      fcmToken: patient.fcmToken
    });
  } catch (error) {
    console.error('Error notifying patient:', error.message);
  }
};

// 6. Notify technician that patient cancelled the order
exports.notifyTechnicianOrderCancelled = async (order) => {
  try {
    if (!order.technician) return;
    const tech = await Technician.findById(order.technician);
    if (!tech) return;

    await sendNotification({
      recipientId: tech._id,
      recipientModel: 'Technician',
      type: 'order_cancelled',
      titleAr: 'تم إلغاء الطلب',
      bodyAr: `تم إلغاء الطلب رقم ${order.orderNumber} من قبل المريض.`,
      orderId: order._id,
      fcmToken: tech.fcmToken
    });
  } catch (error) {
    console.error('Error notifying technician:', error.message);
  }
};
