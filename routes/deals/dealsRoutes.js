const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/authMiddleware");

const dealsController = require("../../controllers/deals/dealsController");
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const validatePrivilege = require("../../middlewares/validatePrivilege");

router.post("/create-deal", verifyToken, validatePrivilege(3, "create"), dealsController.createDeal);
router.get("/get-deals", verifyToken, validatePrivilege(3, "view"), dealsController.getDeals);
router.post("/update-deal/:dealId", verifyToken, validatePrivilege(3, "edit"), dealsController.updateDeal);
router.put("/change-owner/:dealId", verifyToken, validatePrivilege(3, "edit"), dealsController.changeDealOwner);
router.post("/bulk-edit-deals", verifyToken, validatePrivilege(3, "edit"), dealsController.bulkEditDeals);
router.get(
  "/get-deal-summary-by-currency",
  verifyToken,
  validatePrivilege(3, "view"),
  dealsController.getDealSummary
);
// router.get("/get-archived-deals", verifyToken, dealsController.getArchivedDeals);
router.get("/archive-deal/:dealId", verifyToken, validatePrivilege(3, "view"), dealsController.archiveDeal);
router.get(
  "/unarchive-deal/:dealId",
  verifyToken,
  validatePrivilege(3, "view"),
  dealsController.unarchiveDeal
);
router.get("/deals-by-pipeline", verifyToken, validatePrivilege(3, "view"), dealsController.getDealsByStage);
router.get(
  "/get-deal-details/:dealId",
  verifyToken,
  validatePrivilege(3, "view"),
  dealsController.getDealDetail
);
// router.get("/delete-deal/:dealId", verifyToken, dealsController.deleteDeal);
router.delete("/delete-deal/:dealId", verifyToken, validatePrivilege(3, "delete"), dealsController.deleteDeal);
router.post(
  "/link-participant/:dealId",
  verifyToken,
  validatePrivilege(3, "create"),
  dealsController.linkParticipant
);
router.post("/create-note/:dealId", verifyToken, validatePrivilege(3, "create"), dealsController.createNote);
router.get("/get-deal-notes/:dealId", verifyToken, validatePrivilege(3, "view"), dealsController.getNotes);
router.get(
  "/save-deal-fields",
  verifyToken,
  validatePrivilege(3, "view"),
  dealsController.saveAllDealFieldsWithCheck
);
router.get("/get-deal-fields", verifyToken, validatePrivilege(3, "view"), dealsController.getDealFields);
router.post(
  "/deal-check-columns",
  verifyToken,
  validatePrivilege(3, "create"),
  dealsController.updateDealColumnChecks
);
router.get(
  "/get-deal-for-filter",
  verifyToken,
  validatePrivilege(3, "view"),
  dealsController.getDealFieldsForFilter
);
router.get(
  "/mark-deal-as-won/:dealId",
  verifyToken,
  validatePrivilege(3, "view"),
  dealsController.markDealAsWon
);
router.post(
  "/mark-deal-as-lost/:dealId",
  verifyToken,
  validatePrivilege(3, "create"),
  dealsController.markDealAsLost
);
router.get(
  "/mark-deal-as-open/:dealId",
  verifyToken,
  validatePrivilege(3, "view"),
  dealsController.markDealAsOpen
);
// router.post("/import-deals", verifyToken,upload.single('file'), dealsController.bulkImportDeals);
// router.post("/import-deals-without-linking", verifyToken, upload.single('file'), dealsController.bulkImportDealsNoCrosslink);

module.exports = router;

