const express = require("express");
const router = express.Router();

const historyController = require("../../controllers/reports/historyController");

router.get("/", historyController.getHistory); // Get login history

module.exports = router;