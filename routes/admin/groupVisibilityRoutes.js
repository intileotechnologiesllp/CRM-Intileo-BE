const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/authMiddleware");
const dbContextMiddleware = require("../../middlewares/dbContext");
const groupVisibilityController = require("../../controllers/admin/groupVisibilityController");

router.use(dbContextMiddleware);


router.post("/create-groupvisibility", verifyToken, groupVisibilityController.createVisibilityGroup);
router.get("/get-groupvisibility", verifyToken,  groupVisibilityController.getVisibilityGroups);
router.get("/get-groupvisibility/:groupId", verifyToken,  groupVisibilityController.getVisibilityGroupsWithId);
router.post("/update-groupvisibility/:groupId", verifyToken, groupVisibilityController.updateVisibilityGroup);
router.delete('/deletegroup/:groupId', verifyToken, groupVisibilityController.deleteGroup);
router.delete('/softdeletegroup/:groupId', verifyToken, groupVisibilityController.softDeleteGroup);
router.get('/mygroups', verifyToken, groupVisibilityController.getMyGroups);
router.get('/getgroupsbyentity', verifyToken, groupVisibilityController.getGroupsByEntity);

module.exports = router;