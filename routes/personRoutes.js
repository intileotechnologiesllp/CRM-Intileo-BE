const express = require("express");
const router = express.Router();
const personController = require("../controllers/personController");
const { verifyToken } = require("../middlewares/authMiddleware");
const validatePrivilege = require("../middlewares/validatePrivilege");
const dbContextMiddleware = require("../middlewares/dbContext");


// Apply authentication middleware to all routes
router.use(verifyToken);
router.use(dbContextMiddleware);


// Person CRUD Routes
router.post("/", verifyToken,personController.createPerson);
router.get("/", verifyToken, personController.getAllPersons);
router.get("/:personId", verifyToken, personController.getPersonById);
router.put("/:personId", verifyToken, personController.updatePerson);
router.delete("/:personId", verifyToken, personController.deletePerson);

// Timeline Routes - Get unified timeline (emails, activities) for a person
const leadController = require("../controllers/leads/leadController");

router.get(
  "/timeline/:personId",
  verifyToken,
  leadController.getPersonTimeline
);

router.get(
  "/emails/:personId",
  verifyToken,
  leadController.getPersonTimeline
);

module.exports = router;
