const express = require("express");
const router = express.Router();
const dbContextMiddleware = require("../../middlewares/dbContext");
const planController = require("../../controllers/plans/planController.js");



router.get("/getplans",  planController.getPlans);

router.get("/getfeatureswithplans",  planController.getFeaturesWithPlans);



module.exports = router;