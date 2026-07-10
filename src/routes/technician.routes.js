const express = require('express');
const router = express.Router();
const technicianController = require('../controllers/technician.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

// Protect all technician routes
router.use(protect);
router.use(authorize('technician'));

router.get('/orders/available', technicianController.getAvailableOrders);
router.get('/orders/active', technicianController.getActiveOrder);
router.get('/orders/history', technicianController.getCompletedOrdersHistory);

router.put('/orders/:id/accept', technicianController.acceptOrder);
router.put('/orders/:id/start-trip', technicianController.startTrip);
router.put('/orders/:id/arrived', technicianController.arrivedAtLocation);
router.put('/orders/:id/start-service', technicianController.startService);
router.post('/orders/:id/upload-report', technicianController.uploadReportResults);
router.patch('/orders/:id/price-prescription', technicianController.pricePrescription);

router.put('/location', technicianController.updateLocation);
router.put('/availability', technicianController.toggleAvailability);

module.exports = router;
