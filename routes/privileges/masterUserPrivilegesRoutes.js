const express = require("express");
const router = express.Router();
const masterUserPrivilegesController = require("../../controllers/privileges/masterUserPrivilegesController");
const { verifyToken } = require("../../middlewares/authMiddleware");
const { model } = require("mongoose");


// Create a new privilege
router.post("/create", verifyToken, masterUserPrivilegesController.createPrivileges);
router.post("/update", verifyToken, masterUserPrivilegesController.updatePrivileges);
router.get("/get", verifyToken, masterUserPrivilegesController.getUsersWithPrivileges);
router.post("/delete/:masterUserID", verifyToken, masterUserPrivilegesController.deletePrivileges);


module.exports = router;