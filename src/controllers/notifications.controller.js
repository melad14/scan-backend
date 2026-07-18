const Notification = require('../models/Notification');

// GET /api/v1/notifications
exports.getNotifications = async (req, res, next) => {
  try {
    const { id, role } = req.user;
    const recipientModel = role === 'patient' ? 'User' : 'Technician';

    const notifications = await Notification.find({
      recipient: id,
      recipientModel
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: notifications.length,
      data: notifications
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/v1/notifications/read-all
exports.readAllNotifications = async (req, res, next) => {
  try {
    const { id, role } = req.user;
    const recipientModel = role === 'patient' ? 'User' : 'Technician';

    await Notification.updateMany(
      { recipient: id, recipientModel, isRead: false },
      { $set: { isRead: true } }
    );

    return res.status(200).json({
      success: true,
      message: 'تم تحديد جميع الإشعارات كمقروءة'
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/v1/notifications/:id/read
exports.readNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { id: userId, role } = req.user;
    const recipientModel = role === 'patient' ? 'User' : 'Technician';

    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipient: userId, recipientModel },
      { $set: { isRead: true } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على الإشعار',
        code: 'NOT_FOUND',
        statusCode: 404
      });
    }

    return res.status(200).json({
      success: true,
      data: notification
    });
  } catch (error) {
    next(error);
  }
};
