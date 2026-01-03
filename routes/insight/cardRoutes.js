const express = require("express");
const router = express.Router();
const cardController = require("../../controllers/insight/cardController");
const { verifyToken } = require("../../middlewares/authMiddleware"); // Adjust path as needed
const dbContextMiddleware = require("../../middlewares/dbContext");


router.use(dbContextMiddleware);


// Create a new card
router.post("/create-card", verifyToken, cardController.createCard);

// Get all cards (with optional dashboard filter)
router.get("/get-cards", verifyToken, cardController.getAllCards);

// Get specific card by ID
router.get("/get-card/:cardId", verifyToken, cardController.getCardById);

// Update card
router.put("/update-card/:cardId", verifyToken, cardController.updateCard);

// Delete card
router.delete("/deletecardfromdashboard/:cardId", verifyToken, cardController.deleteCardFromDashboard);

router.delete("/delete-card", verifyToken, cardController.deleteCard);

// Bulk update card positions
router.put("/update-card-positions", verifyToken, cardController.updateCardPositions);

module.exports = router;