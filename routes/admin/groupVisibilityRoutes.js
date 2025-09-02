const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/authMiddleware");
const groupVisibilityController = require("../../controllers/admin/groupVisibilityController");


router.post("/create-deal", verifyToken, groupVisibilityController.createVisibilityGroup);
router.get("/get-deals", verifyToken,  groupVisibilityController.getVisibilityGroups);
router.post("/update-deal/:dealId", verifyToken, groupVisibilityController.updateVisibilityGroup);

module.exports = router;