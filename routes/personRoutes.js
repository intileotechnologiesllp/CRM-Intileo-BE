const express = require("express");
const router = express.Router();
const personController = require("../controllers/personController");
const { verifyToken } = require("../middlewares/authMiddleware");
const validatePrivilege = require("../middlewares/validatePrivilege");

// Apply authentication middleware to all routes
router.use(verifyToken);

// Person CRUD Routes
router.post("/", verifyToken, validatePrivilege(5, "create"), personController.createPerson);
router.get("/", verifyToken, validatePrivilege(5, "view"), personController.getAllPersons);
router.get("/:personId", verifyToken, validatePrivilege(5, "view"), personController.getPersonById);
router.put("/:personId", verifyToken, validatePrivilege(5, "edit"), personController.updatePerson);
router.delete("/:personId", verifyToken, validatePrivilege(5, "delete"), personController.deletePerson);

module.exports = router;
