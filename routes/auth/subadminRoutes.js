const express = require("express");
const router = express.Router();

const subadminController = require("../../controllers/auth/subadminController");
const { verifyToken } = require("../../middlewares/authMiddleware");

router.post("/create", verifyToken, subadminController.createSubadmin);
router.get("/get", verifyToken, subadminController.getSubadmins);
router.post("update/:subadminID", verifyToken, subadminController.updateSubadmin);
router.post("/delete/:subadminID", verifyToken, subadminController.deleteSubadmin);


module.exports = router;
