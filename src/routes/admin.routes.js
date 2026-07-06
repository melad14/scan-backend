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

// Service Catalog Management
router.post('/services', adminController.createService);
router.put('/services/reorder', adminController.reorderServices);
router.put('/services/:id', adminController.updateService);
router.delete('/services/:id', adminController.deleteService);

// Service Category Management
router.get('/categories', adminController.getAllCategories);
router.post('/categories', adminController.createCategory);
router.put('/categories/reorder', adminController.reorderCategories);
router.put('/categories/:id', adminController.updateCategory);
router.delete('/categories/:id', adminController.deleteCategory);

module.exports = router;
