const express = require("express");
const router = express.Router();
const emailSettingsController = require("../../controllers/email/emailSettingController");
const { verifyToken } = require("../../middlewares/authMiddleware");


router.post("/create-default-email", verifyToken,emailSettingsController.createOrUpdateDefaultEmail);
router.get("/get-default-email",verifyToken,emailSettingsController.getDefaultEmail);
router.post("/update-default-email",verifyToken,emailSettingsController.updateDefaultEmail);










module.exports = router;