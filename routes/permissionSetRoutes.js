const express = require("express");
const router = express.Router();
const permissionController = require("../controllers/permissionSetController");
const { verifyToken } = require("../middlewares/authMiddleware");
const validatePrivilege = require("../middlewares/validatePrivilege");

// Apply authentication middleware to all routes
// router.use(verifyToken);

// Organization CRUD Routes
router.post(
  "/create-permission-set",
//   verifyToken,
  permissionController.createPermissionSet
);
router.post(
  "/update-permission-set",
  permissionController.updatePermissionSet
);
router.get(
  "/get-permission-set",
  permissionController.getPermissionSet
);

module.exports = router;
