const express = require('express');
const router = express.Router();
const lostReasonControler = require('../../controllers/lostReason/lostReasonController');
const { verifyToken } = require('../../middlewares/authMiddleware');

router.post('/lost-reason', verifyToken, lostReasonControler.createLostReason);
router.get('/lost-reasons', verifyToken, lostReasonControler.getLostReasons);

module.exports = router;