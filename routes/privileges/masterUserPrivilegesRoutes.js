const express = require("express");
const router = express.Router();
const masterUserPrivilegesController = require("../../controllers/privileges/masterUserPrivilegesController");
const { verifyToken } = require("../../middlewares/authMiddleware");
const { model } = require("mongoose");


// Create a new privilege
router.post("/create", verifyToken, masterUserPrivilegesController.createPrivileges);


module.exports = router;