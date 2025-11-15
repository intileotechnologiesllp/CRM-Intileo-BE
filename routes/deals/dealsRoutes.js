
const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/authMiddleware");
const dealsController = require("../../controllers/deals/dealsController");

const Deal = require("../../models/deals/dealsModels");
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const validatePrivilege = require("../../middlewares/validatePrivilege");
const activitySettingsMiddleware = require("../../middlewares/activitySettingsMiddleware");

router.post("/create-deal", verifyToken, validatePrivilege(0, "create"), dealsController.createDeal);
router.get("/get-deals", verifyToken,dealsController.getDeals);
router.post("/update-deal/:dealId", verifyToken, validatePrivilege(1, "edit_others", { checkOwnership: true, ownershipModel: Deal }), dealsController.updateDeal);
router.put("/change-owner/:dealId", verifyToken, validatePrivilege(2, "edit_owner", { checkOwnership: true, ownershipModel: Deal }), dealsController.changeDealOwner);
router.post("/bulk-edit-deals", verifyToken, validatePrivilege(1, "edit_others", { checkOwnership: true, ownershipModel: Deal }), dealsController.bulkEditDeals);
router.get(
  "/get-deal-summary-by-currency",
  verifyToken,
  dealsController.getDealSummary
);
// router.get("/get-archived-deals", verifyToken, dealsController.getArchivedDeals);
router.get("/archive-deal/:dealId", verifyToken, dealsController.archiveDeal);
router.get(
  "/unarchive-deal/:dealId",
  verifyToken,
  dealsController.unarchiveDeal
);
router.get("/deals-by-pipeline", verifyToken, dealsController.getDealsByStage);
router.get(
  "/get-deal-details/:dealId",
  verifyToken,
  dealsController.getDealDetail
);
// router.get("/delete-deal/:dealId", verifyToken, dealsController.deleteDeal);
router.delete("/delete-deal/:dealId", verifyToken, validatePrivilege(3, "delete", { checkOwnership: true, ownershipModel: Deal }), dealsController.deleteDeal);
router.post(
  "/link-participant/:dealId",
  verifyToken,
  dealsController.linkParticipant
);
router.post("/create-note/:dealId", verifyToken, dealsController.createNote);
router.get("/get-deal-notes/:dealId", verifyToken, dealsController.getNotes);
router.get(
  "/save-deal-fields",
  verifyToken,
  dealsController.saveAllDealFieldsWithCheck
);
router.get("/get-deal-fields", verifyToken, dealsController.getDealFields);
router.post(
  "/deal-check-columns",
  verifyToken,
  dealsController.updateDealColumnChecks
);
router.get(
  "/get-deal-for-filter",
  dealsController.getDealFieldsForFilter
);
router.get(
  "/mark-deal-as-won/:dealId",
  verifyToken,activitySettingsMiddleware,
  dealsController.markDealAsWon
);
router.post(
  "/mark-deal-as-lost/:dealId",
  verifyToken,
  dealsController.markDealAsLost
);
router.post(
  "/update-question-shared/:dealId",
  verifyToken,
  dealsController.updateQuestionShared
);
router.get(
  "/mark-deal-as-open/:dealId",
  verifyToken,
  dealsController.markDealAsOpen
);
// router.post("/import-deals", verifyToken,upload.single('file'), dealsController.bulkImportDeals);
// router.post("/import-deals-without-linking", verifyToken, upload.single('file'), dealsController.bulkImportDealsNoCrosslink);

// ================ DUPLICATE DEAL ROUTES ================
router.post(
  "/duplicate/:dealId",
  verifyToken,
  dealsController.duplicateDeal
);
router.post(
  "/duplicate-batch",
  verifyToken,
  dealsController.duplicateDealsInBatch
);

// ================ BULK CONVERT ROUTES ================
router.post(
  "/bulk-convert-to-leads",
  verifyToken,
  validatePrivilege(4, "create", { checkOwnership: true, ownershipModel: Deal }),
  dealsController.bulkConvertDealsToLeads
);

// ================ BULK DELETE ROUTES ================
router.delete(
  "/bulk-delete",
  verifyToken,
  validatePrivilege(3, "delete", { checkOwnership: true, ownershipModel: Deal }),
  dealsController.bulkDeleteDeals
);

// ================ FILE MANAGEMENT ROUTES ================
router.post(
  "/:dealId/files/upload",
  verifyToken,
  dealsController.uploadDealFiles
);

router.get(
  "/:dealId/files",
  verifyToken,
  dealsController.getDealFiles
);

router.get(
  "/:dealId/files/:fileId/download",
  verifyToken,
  dealsController.downloadDealFile
);

router.put(
  "/:dealId/files/:fileId",
  verifyToken,
  dealsController.updateDealFile
);

router.delete(
  "/:dealId/files/:fileId",
  verifyToken,
  validatePrivilege(3, "delete", { checkOwnership: true, ownershipModel: Deal }),
  dealsController.deleteDealFile
);
router.get(
  "/check-question-shared/:dealId",
  verifyToken,
  dealsController.checkDealQuestionSharedStatus
);

module.exports = router;



