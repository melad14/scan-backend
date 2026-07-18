const express = require('express');
const router = express.Router();
const notificationsController = require('../controllers/notifications.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);

router.get('/', notificationsController.getNotifications);
router.put('/read-all', notificationsController.readAllNotifications);
router.put('/:id/read', notificationsController.readNotification);

module.exports = router;
