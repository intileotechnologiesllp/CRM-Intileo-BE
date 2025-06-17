const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/authMiddleware");

const dealsController = require("../../controllers/deals/dealsController");


router.post("/create-deal", verifyToken, dealsController.createDeal);
router.get("/get-deals", verifyToken, dealsController.getDeals);
router.post("/update-deal/:dealId", verifyToken, dealsController.updateDeal);
router.get("/get-deal-summary-by-currency",verifyToken, dealsController.getDealSummary);
// router.get("/get-archived-deals", verifyToken, dealsController.getArchivedDeals);
router.get("/archive-deal/:dealId", verifyToken, dealsController.archiveDeal);
router.get("/unarchive-deal/:dealId", verifyToken, dealsController.unarchiveDeal);
router.get("/deals-by-pipeline",verifyToken, dealsController.getDealsByStage);


module.exports = router;