const express = require("express");
const router = express.Router();
const personController = require("../controllers/personController");
const { verifyToken } = require("../middlewares/authMiddleware");

// Apply authentication middleware to all routes
router.use(verifyToken);

// Person CRUD Routes
router.post("/", personController.createPerson);
router.get("/", personController.getAllPersons);
router.get("/:personId", personController.getPersonById);
router.put("/:personId", personController.updatePerson);
router.delete("/:personId", personController.deletePerson);

module.exports = router;
