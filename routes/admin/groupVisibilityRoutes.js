const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/authMiddleware");
const groupVisibilityController = require("../../controllers/admin/groupVisibilityController");


router.post("/create-groupvisibility", verifyToken, groupVisibilityController.createVisibilityGroup);
router.get("/get-groupvisibility", verifyToken,  groupVisibilityController.getVisibilityGroups);
router.get("/get-groupvisibility/:groupId", verifyToken,  groupVisibilityController.getVisibilityGroupsWithId);
router.post("/update-groupvisibility/:groupId", verifyToken, groupVisibilityController.updateVisibilityGroup);
router.delete('/deletegroup/:groupId', verifyToken, groupVisibilityController.deleteGroup);
router.delete('/softdeletegroup/:groupId', verifyToken, groupVisibilityController.softDeleteGroup);

module.exports = router;