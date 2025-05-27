const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/authMiddleware");
const leadColumnController = require("../../controllers/leads/leadColumnController");


router.post("/create-column", verifyToken, leadColumnController.saveLeadColumnPreference);
router.get("/get-column", verifyToken, leadColumnController.getLeadColumnPreference);

module.exports = router;