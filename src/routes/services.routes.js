const express = require('express');
const router = express.Router();
const servicesController = require('../controllers/services.controller');

router.get('/', servicesController.getAllServices);
router.get('/xray', servicesController.getXrayServices);
router.get('/lab', servicesController.getLabServices);
router.get('/pricing', servicesController.getPricingConfig);

module.exports = router;
