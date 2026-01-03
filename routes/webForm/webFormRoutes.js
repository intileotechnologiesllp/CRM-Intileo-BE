const express = require("express");
const router = express.Router();
const webFormController = require("../../controllers/webForm/webFormController");
const webFormPublicController = require("../../controllers/webForm/webFormPublicController");
const { verifyToken } = require("../../middlewares/authMiddleware");
const dbContextMiddleware = require("../../middlewares/dbContext");
// ====================================
// ADMIN ROUTES (Protected)
// ====================================


router.use(dbContextMiddleware);


// Form Management
router.post("/", verifyToken, webFormController.createForm);
router.get("/", verifyToken, webFormController.getAllForms);
router.get("/:formId", webFormController.getFormById);
router.put("/:formId", verifyToken, webFormController.updateForm);
router.delete("/:formId", verifyToken, webFormController.deleteForm);
router.post("/:formId/duplicate", verifyToken, webFormController.duplicateForm);

// Field Management
router.post("/:formId/fields", verifyToken, webFormController.addField);
router.put("/:formId/fields/:fieldId", verifyToken, webFormController.updateField);
router.delete("/:formId/fields/:fieldId", verifyToken, webFormController.deleteField);
router.put("/:formId/fields/reorder", verifyToken, webFormController.reorderFields);

// Submissions & Analytics
router.get("/:formId/submissions", verifyToken, webFormController.getSubmissions);
router.get("/:formId/analytics", verifyToken, webFormController.getFormAnalytics);
router.put("/submissions/:submissionId/read", verifyToken, webFormPublicController.markAsRead);
router.put("/submissions/:submissionId/status", verifyToken, webFormPublicController.updateSubmissionStatus);

module.exports = router;
