const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const savedAddressController = require('../controllers/savedAddress.controller');

// All saved addresses routes require user authentication
router.use(protect);

router.get('/', savedAddressController.listSavedAddresses);
router.post('/', savedAddressController.createSavedAddress);
router.put('/:id', savedAddressController.updateSavedAddress);
router.delete('/:id', savedAddressController.deleteSavedAddress);
router.put('/:id/default', savedAddressController.setDefaultAddress);

module.exports = router;
