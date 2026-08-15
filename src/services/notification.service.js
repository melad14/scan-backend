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
      const isTechnician = recipientModel === 'Technician';
      const channelId = isTechnician ? 'drray_tech_high_importance' : 'drray_high_importance';

      const message = {
        token: fcmToken,
        notification: {
          title: titleAr,
          body: bodyAr
        },
        data: {
          type,
          orderId: String(orderId),
          title: titleAr,
          body: bodyAr
        },
        android: {
          notification: {
            channelId,
            priority: 'max',
            sound: 'default',
            defaultVibrateTimings: true,
            defaultLightSettings: true,
          },
          priority: 'high'
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
    let technicians = await Technician.find({
      region: { $regex: new RegExp('^' + district.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i') },
      isActive: true,
      isAvailable: true
    });

    if (technicians.length === 0) {
      console.log(`[FCM FALLBACK] No technicians found in district "${district}". Fetching all active & available technicians.`);
      technicians = await Technician.find({
        isActive: true,
        isAvailable: true
      });
    }

    if (technicians.length === 0) return;

    const titleAr = 'طلب خدمة جديد متاح';
    const bodyAr = `هناك طلب جديد متاح برقم ${order.orderNumber}، اضغط للتفاصيل`;
    const type = 'new_order';

    // 1. Batch Save to Database
    const notificationDocs = technicians.map(tech => ({
      recipient: tech._id,
      recipientModel: 'Technician',
      type,
      titleAr,
      bodyAr,
      orderId: order._id,
      isRead: false
    }));
    await Notification.insertMany(notificationDocs);

    // 2. Batch Send FCM (Multicast)
    if (fcmAvailable) {
      const fcmTokens = technicians
        .map(tech => tech.fcmToken)
        .filter(token => token && typeof token === 'string'); // ensure valid tokens

      if (fcmTokens.length > 0) {
        const message = {
          tokens: fcmTokens,
          notification: {
            title: titleAr,
            body: bodyAr
          },
          data: {
            type,
            orderId: String(order._id),
            title: titleAr,
            body: bodyAr
          },
          android: {
            notification: {
              channelId: 'drray_tech_high_importance',
              priority: 'max',
              sound: 'default',
              defaultVibrateTimings: true,
              defaultLightSettings: true,
            },
            priority: 'high'
          }
        };

        try {
          // Use sendMulticast for batching (works in most admin SDK versions)
          const response = await admin.messaging().sendMulticast(message);
          console.log(`[FCM MULTICAST SUCCESS] Sent ${response.successCount} messages, ${response.failureCount} failed.`);
        } catch (fcmError) {
          console.error('[FCM MULTICAST ERROR]', fcmError.message);
        }
      }
    } else {
      console.log(`[FCM SIMULATION LOG] Batch sent to ${technicians.length} technicians.`);
    }

  } catch (error) {
    console.error('Error notifying technicians:', error.message);
  }
};

// 1b. Notify single assigned technician about new order
exports.notifyTechnicianNewOrder = async (order) => {
  try {
    if (!order.technician) return;
    const tech = await Technician.findById(order.technician);
    if (!tech) return;

    await sendNotification({
      recipientId: tech._id,
      recipientModel: 'Technician',
      type: 'new_order',
      titleAr: 'تم تعيين طلب جديد لك',
      bodyAr: `تم تعيين طلب جديد لك برقم ${order.orderNumber} من قبل الإدارة.`,
      orderId: order._id,
      fcmToken: tech.fcmToken
    });
  } catch (error) {
    console.error('Error notifying technician of new order:', error.message);
  }
};

// 1c. Notify patient that their prescription-only order was priced & accepted
exports.notifyPatientOrderAccepted = async (order) => {
  try {
    const patient = await User.findById(order.patient);
    if (!patient) return;

    await sendNotification({
      recipientId: patient._id,
      recipientModel: 'User',
      type: 'order_accepted',
      titleAr: 'تم تسعير طلبك وقبوله',
      bodyAr: `تم تسعير الفحوصات لطلبك برقم ${order.orderNumber} من قبل الإدارة. يرجى مراجعة التفاصيل.`,
      orderId: order._id,
      fcmToken: patient.fcmToken
    });
  } catch (error) {
    console.error('Error notifying patient of accepted order:', error.message);
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

// 7. Notify patient when technician sets arrival time
exports.notifyPatientArrivalTimeSet = async (order, arrivalTime) => {
  try {
    const patient = await User.findById(order.patient);
    if (!patient) return;

    await sendNotification({
      recipientId: patient._id,
      recipientModel: 'User',
      type: 'arrival_time_set',
      titleAr: 'تم تحديد موعد الفني',
      bodyAr: `سيصل الفني إليك الساعة ${arrivalTime}`,
      orderId: order._id,
      fcmToken: patient.fcmToken
    });
  } catch (error) {
    console.error('Error notifying patient arrival time:', error.message);
  }
};

// 8. Notify technician when order is assigned by admin
exports.notifyTechnicianOrderAssigned = async (order) => {
  try {
    if (!order.technician) return;
    const tech = await Technician.findById(order.technician);
    if (!tech) return;

    await sendNotification({
      recipientId: tech._id,
      recipientModel: 'Technician',
      type: 'order_assigned',
      titleAr: 'تم تعيين طلب جديد لك',
      bodyAr: `تم تعيين الطلب رقم ${order.orderNumber} لك من قبل الإدارة.`,
      orderId: order._id,
      fcmToken: tech.fcmToken
    });
  } catch (error) {
    console.error('Error notifying technician of assigned order:', error.message);
  }
};

// 9. Notify technician when patient submits a complaint
exports.notifyTechnicianNewComplaint = async (order) => {
  try {
    if (!order.technician) return;
    const tech = await Technician.findById(order.technician);
    if (!tech) return;

    await sendNotification({
      recipientId: tech._id,
      recipientModel: 'Technician',
      type: 'new_complaint',
      titleAr: 'شكوى جديدة على الطلب',
      bodyAr: `تم تقديم شكوى جديدة بخصوص الطلب رقم ${order.orderNumber}.`,
      orderId: order._id,
      fcmToken: tech.fcmToken
    });
  } catch (error) {
    console.error('Error notifying technician of complaint:', error.message);
  }
};
