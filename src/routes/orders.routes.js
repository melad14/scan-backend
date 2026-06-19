const express = require('express');
const router = Router = express.Router();
const ordersController = require('../controllers/orders.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

// Protect all routes
router.use(protect);

// Patient routes
router.post('/', authorize('patient'), ordersController.createOrder);
router.get('/history', authorize('patient'), ordersController.getOrderHistory);
router.put('/:id/cancel', authorize('patient'), ordersController.cancelOrder);
router.post('/:id/rate', authorize('patient'), ordersController.rateOrder);

// Shared / Detail route
router.get('/:id', ordersController.getOrderDetail);

module.exports = router;
