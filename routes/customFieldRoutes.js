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
router.put("/:fieldId", customFieldController.updateCustomField);
router.delete("/:fieldId", customFieldController.deleteCustomField);

// Custom Field Value Management Routes
router.post("/values", customFieldController.saveCustomFieldValues);
router.get(
  "/values/:entityType/:entityId",
  customFieldController.getCustomFieldValues
);
router.put(
  "/values/:entityType/:entityId",
  customFieldController.updateCustomFieldValues
);
router.delete("/values/:valueId", customFieldController.deleteCustomFieldValue);

// Pure Custom Fields Entity Creation
router.post(
  "/create-entity",
  customFieldController.createEntityWithCustomFields
);
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
router.put("/:fieldId/order", customFieldController.updateFieldOrder);
router.put("/:fieldId/category", customFieldController.updateFieldCategory);
router.put("/:fieldId/group", customFieldController.updateFieldGroup);
router.put("/:fieldId/summary/add", customFieldController.addFieldToSummary);
router.put(
  "/:fieldId/summary/remove",
  customFieldController.removeFieldFromSummary
);
router.put("/bulk/order", customFieldController.updateFieldDisplayOrder);

module.exports = router;
