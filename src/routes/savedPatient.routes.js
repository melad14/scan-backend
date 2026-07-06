const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const savedPatientController = require('../controllers/savedPatient.controller');

// All saved patients routes require user authentication
router.use(protect);

router.get('/', savedPatientController.listSavedPatients);
router.post('/', savedPatientController.createSavedPatient);
router.put('/:id', savedPatientController.updateSavedPatient);
router.delete('/:id', savedPatientController.deleteSavedPatient);
router.put('/:id/default', savedPatientController.setDefaultPatient);

module.exports = router;
