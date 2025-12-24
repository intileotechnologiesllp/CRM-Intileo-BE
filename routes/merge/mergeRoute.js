const express = require("express");
const { mergeDealsHandler, mergeLeadsHandler } = require("../../controllers/merge/mergeController");
const { verifyToken } = require("../../middlewares/authMiddleware");
const router = express.Router();

router.post("/deals/:primaryId/merge", mergeDealsHandler);
router.post("/leads/:primaryId/merge", verifyToken,mergeLeadsHandler);


module.exports = router;
