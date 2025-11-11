const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/authMiddleware");

const dealsController = require("../../controllers/deals/dealsController");
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const validatePrivilege = require("../../middlewares/validatePrivilege");
const activitySettingsMiddleware = require("../../middlewares/activitySettingsMiddleware");

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
  dealsController.getDealFieldsForFilter
);
router.get(
  "/mark-deal-as-won/:dealId",
  verifyToken,
  validatePrivilege(3, "view"),activitySettingsMiddleware,
  dealsController.markDealAsWon
);
router.post(
  "/mark-deal-as-lost/:dealId",
  verifyToken,
  validatePrivilege(3, "create"),
  dealsController.markDealAsLost
);
router.post(
  "/update-question-shared/:dealId",
  verifyToken,
  validatePrivilege(3, "update"),
  dealsController.updateQuestionShared
);
router.get(
  "/mark-deal-as-open/:dealId",
  verifyToken,
  validatePrivilege(3, "view"),
  dealsController.markDealAsOpen
);
// router.post("/import-deals", verifyToken,upload.single('file'), dealsController.bulkImportDeals);
// router.post("/import-deals-without-linking", verifyToken, upload.single('file'), dealsController.bulkImportDealsNoCrosslink);

// ================ DUPLICATE DEAL ROUTES ================
router.post(
  "/duplicate/:dealId",
  verifyToken,
  validatePrivilege(3, "create"),
  dealsController.duplicateDeal
);
router.post(
  "/duplicate-batch",
  verifyToken,
  validatePrivilege(3, "create"),
  dealsController.duplicateDealsInBatch
);

// ================ BULK CONVERT ROUTES ================
router.post(
  "/bulk-convert-to-leads",
  verifyToken,
  validatePrivilege(3, "create"),
  dealsController.bulkConvertDealsToLeads
);

// ================ BULK DELETE ROUTES ================
router.delete(
  "/bulk-delete",
  verifyToken,
  validatePrivilege(3, "delete"),
  dealsController.bulkDeleteDeals
);

// ================ FILE MANAGEMENT ROUTES ================
router.post(
  "/:dealId/files/upload",
  verifyToken,
  validatePrivilege(3, "create"),
  dealsController.uploadDealFiles
);

router.get(
  "/:dealId/files",
  verifyToken,
  validatePrivilege(3, "view"),
  dealsController.getDealFiles
);

router.get(
  "/:dealId/files/:fileId/download",
  verifyToken,
  validatePrivilege(3, "view"),
  dealsController.downloadDealFile
);

router.put(
  "/:dealId/files/:fileId",
  verifyToken,
  validatePrivilege(3, "edit"),
  dealsController.updateDealFile
);

router.delete(
  "/:dealId/files/:fileId",
  verifyToken,
  validatePrivilege(3, "delete"),
  dealsController.deleteDealFile
);
router.get(
  "/check-question-shared/:dealId",
  verifyToken,
  validatePrivilege(3, "view"),
  dealsController.checkDealQuestionSharedStatus
);

module.exports = router;