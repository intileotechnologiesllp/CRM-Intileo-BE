const express = require("express");
const router = express.Router();
const customFieldController = require("../controllers/customFieldController");
const { verifyToken } = require("../middlewares/authMiddleware");

// Apply authentication middleware to all routes
router.use(verifyToken);

// Custom Field Management Routes
router.post("/", customFieldController.createCustomField);
router.get("/", customFieldController.getCustomFields);
router.get(
  "/:entityType/stats",
  customFieldController.getCustomFieldsWithStats
);
router.get("/:entityType/groups", customFieldController.getFieldGroups);
router.get("/:entityType/default", customFieldController.getDefaultFields);
router.get("/:entityType/system", customFieldController.getSystemFields);
router.get(
  "/:entityType/hybrid-sections",
  customFieldController.getHybridFieldsSections
);
router.post("/edit/:fieldId", customFieldController.updateCustomField);
router.post("/delete/:fieldId", customFieldController.deleteCustomField);

// Custom Field Value Management Routes
router.post("/values", customFieldController.saveCustomFieldValues);
router.get(
  "/values/:entityType/:entityId",
  customFieldController.getCustomFieldValues
);
router.post(
  "/values/:entityType/:entityId",
  customFieldController.updateCustomFieldValues
);
router.post("/values/:valueId", customFieldController.deleteCustomFieldValue);

// Pure Custom Fields Entity Creation
router.post(
  "/create-entity",
  customFieldController.createEntityWithCustomFields
);
// Alias route for entities (supports both endpoints)
router.post("/entities", customFieldController.createEntityWithCustomFields);
router.post(
  "/create-person",
  customFieldController.createPersonWithCustomFields
);
router.post(
  "/create-organization",
  customFieldController.createOrganizationWithCustomFields
);

// Entity Retrieval with Custom Fields
router.get(
  "/person/:entityId",
  customFieldController.getPersonWithCustomFields
);
router.get(
  "/organization/:entityId",
  customFieldController.getOrganizationWithCustomFields
);

// Field Organization Routes
router.post("/:fieldId/order", customFieldController.updateFieldOrder);
router.post("/:fieldId/category", customFieldController.updateFieldCategory);
router.post("/:fieldId/group", customFieldController.updateFieldGroup);
router.post("/:fieldId/summary/add", customFieldController.addFieldToSummary);
router.post(
  "/:fieldId/summary/remove",
  customFieldController.removeFieldFromSummary
);
router.post("/bulk/order", customFieldController.updateFieldDisplayOrder);

// Bulk Update and Migration Routes
router.post(
  "/bulk/visibility",
  customFieldController.bulkUpdateFieldVisibility
);
router.post("/migrate", customFieldController.migrateFieldsToNewStructure);

module.exports = router;
