const express = require('express');
const router = express.Router();
const lostReasonController = require('../../controllers/deals/lostReasonController');
const { verifyToken } = require('../../middlewares/authMiddleware');
const dbContextMiddleware = require("../../middlewares/dbContext");


router.use(dbContextMiddleware);


// Settings Routes (must come before /:id routes)
router.get('/settings', verifyToken, lostReasonController.getLostReasonSettings);
router.post('/settings', verifyToken, lostReasonController.updateLostReasonSettings);

// Bulk Operations (must come before /:id routes)
router.post('/bulk', verifyToken, lostReasonController.bulkUpdateLostReasons);

// Create Default Lost Reasons (must come before /:id routes)
router.post('/create-defaults', verifyToken, lostReasonController.createDefaultLostReasons);

// Lost Reason CRUD Routes
router.post('/create-lost-reason', verifyToken, lostReasonController.createLostReason);
router.get('/get-lost-reason', verifyToken, lostReasonController.getLostReasons);
router.get('/get-lost-reason/:id', verifyToken, lostReasonController.getLostReason);
router.post('/update-lost-reason/:id', verifyToken, lostReasonController.updateLostReason);
router.delete('/delete-lost-reason/:id', verifyToken, lostReasonController.deleteLostReason);

module.exports = router;