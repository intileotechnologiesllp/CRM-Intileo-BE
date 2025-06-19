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
router.get("/get-deal-details/:dealId", verifyToken, dealsController.getDealDetail);
router.get("/delete-deal/:dealId", verifyToken, dealsController.deleteDeal);
router.post("/link-participant/:dealId", verifyToken, dealsController.linkParticipant);
router.post("create-note/:dealId", verifyToken, dealsController.createNote);
router.get("/get-deal-notes/:dealId", verifyToken, dealsController.getNotes);
router.get("/save-deal-fields", verifyToken, dealsController.saveAllDealFieldsWithCheck);
router.get("/get-deal-fields", verifyToken, dealsController.getDealFields);
router.post("/check-columns", verifyToken, dealsController.updateDealColumnChecks);
router.get("/get-deal-for-filter", verifyToken, dealsController.getDealFieldsForFilter);
router.get("/mark-deal-as-won/:dealId", verifyToken, dealsController.markDealAsWon);
router.post("/mark-deal-as-lost/:dealId", verifyToken, dealsController.markDealAsLost);
router.get("/mark-deal-as-open/:dealId", verifyToken, dealsController.markDealAsOpen);


module.exports = router;