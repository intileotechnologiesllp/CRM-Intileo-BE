const express = require("express");
const router = express.Router();
const personController = require("../controllers/personController");
const { verifyToken } = require("../middlewares/authMiddleware");
const validatePrivilege = require("../middlewares/validatePrivilege");

// Apply authentication middleware to all routes
router.use(verifyToken);

// Person CRUD Routes
router.post("/", verifyToken,personController.createPerson);
router.get("/", verifyToken, personController.getAllPersons);
router.get("/:personId", verifyToken, personController.getPersonById);
router.put("/:personId", verifyToken, personController.updatePerson);
router.delete("/:personId", verifyToken, personController.deletePerson);
module.exports = router;
