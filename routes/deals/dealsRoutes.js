const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/authMiddleware");

const dealsController = require("../../controllers/deals/dealsController");


router.post("/create-deal", verifyToken, dealsController.createDeal);
router.get("/get-deals", verifyToken, dealsController.getDeals);
router.post("/update-deal/:dealId", verifyToken, dealsController.updateDeal);
router.get("/get-deal-summary-by-currency",verifyToken, dealsController.getDealSummaryByCurrency);



module.exports = router;