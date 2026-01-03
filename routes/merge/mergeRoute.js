const express = require("express");
const { mergeDealsHandler, mergeLeadsHandler } = require("../../controllers/merge/mergeController");
const { verifyToken } = require("../../middlewares/authMiddleware");
const dbContextMiddleware = require("../../middlewares/dbContext");
const router = express.Router();


router.use(dbContextMiddleware);


router.post("/deals/:primaryId/merge", mergeDealsHandler);
router.post("/leads/:primaryId/merge", verifyToken,mergeLeadsHandler);


module.exports = router;
