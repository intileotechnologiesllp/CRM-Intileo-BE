const express = require("express");
const router = express.Router();
const masterUserController = require("../../controllers/auth/masterUserController");
// const { authenticate } = require("../../middlewares/authMiddleware");
const { verifyToken } = require("../../middlewares/authMiddleware");
console.log(masterUserController);
// Create a master user
router.post("/create", verifyToken, masterUserController.createMasterUser);

// Get all master users
router.get("/", verifyToken, masterUserController.getMasterUsers);

// Update a master user
router.put("/:id", verifyToken, masterUserController.updateMasterUser);

// Delete a master user
router.delete("/:id", verifyToken, masterUserController.deleteMasterUser);

module.exports = router;
