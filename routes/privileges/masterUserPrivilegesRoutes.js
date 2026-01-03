const express = require("express");
const router = express.Router();
const masterUserPrivilegesController = require("../../controllers/privileges/masterUserPrivilegesController");
const { verifyToken } = require("../../middlewares/authMiddleware");
const dbContextMiddleware = require("../../middlewares/dbContext");
const { model } = require("mongoose");


router.use(dbContextMiddleware);


// Create a new privilege
router.post(
  "/create",
  verifyToken,
  masterUserPrivilegesController.createPrivileges
);
router.post(
  "/update",
  verifyToken,
  masterUserPrivilegesController.updatePrivileges
);
router.get(
  "/get",
  verifyToken,
  masterUserPrivilegesController.getUsersWithPrivileges
);
router.post(
  "/delete/:masterUserID",
  verifyToken,
  masterUserPrivilegesController.deletePrivileges
);
router.get(
  "/privileges",
  verifyToken,
  masterUserPrivilegesController.getAllPrivileges
);

// User deactivation routes
router.put(
  "/toggle-status/:masterUserID",
  verifyToken,
  masterUserPrivilegesController.toggleUserStatus
);
router.get(
  "/deactivated-users",
  verifyToken,
  masterUserPrivilegesController.getDeactivatedUsers
);
router.put(
  "/bulk-toggle-status",
  verifyToken,
  masterUserPrivilegesController.bulkToggleUserStatus
);

module.exports = router;
