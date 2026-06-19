const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

// Protect and authorize only super_admin / admin roles
router.use(protect);
router.use(authorize('admin', 'super_admin'));

router.get('/dashboard', adminController.getDashboardStats);
router.get('/orders', adminController.getOrdersList);
router.put('/orders/:id/assign', adminController.assignTechnician);
router.put('/orders/:id/status', adminController.updateOrderStatus);

router.get('/technicians', adminController.getAllTechnicians);
router.post('/technicians', adminController.addTechnician);
router.put('/technicians/:id', adminController.editTechnician);
router.put('/technicians/:id/toggle-active', adminController.toggleTechnicianActive);

router.get('/patients', adminController.getAllPatients);
router.put('/pricing', adminController.editPricingConfig);

module.exports = router;
