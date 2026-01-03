const express = require("express");
const router = express.Router();
const dbContextMiddleware = require("../../middlewares/dbContext");
const historyController = require("../../controllers/reports/historyController");

router.use(dbContextMiddleware);

router.get("/", historyController.getHistory); // Get login history

module.exports = router;