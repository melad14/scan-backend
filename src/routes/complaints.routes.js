const express = require('express');
const router = express.Router();
const complaintsController = require('../controllers/complaints.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);

router.post('/', complaintsController.createComplaint);
router.get('/my', complaintsController.getMyComplaints);
router.get('/forwarded', complaintsController.getForwardedComplaints);
router.patch('/:id/resolve', complaintsController.resolveComplaint);

module.exports = router;
