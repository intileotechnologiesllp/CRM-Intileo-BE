const Card  = require("../../models/insight/cardModel"); // Adjust path as needed

exports.createCard = async (req, res) => {
  try {
    const { dashboardId, type, position, size } = req.body;
    const ownerId = req.adminId;

    // Validate required fields
    if (!type) {
      return res.status(400).json({
        success: false,
        message: "Type is required",
      });
    }

    let cardPosition = position;
    
    // If position is not provided, calculate the next position
    if (position === undefined || position === null) {
      // Find the highest position for this dashboard
      const lastCard = await Card.findOne({
        where: { dashboardId },
        order: [['position', 'DESC']]
      });
      
      cardPosition = lastCard ? lastCard.position + 1 : 0;
    }

    // Default size if not provided
    const cardSize = size !== undefined ? size : 1;

    const newCard = await Card.create({
      dashboardId,
      type,
      position: cardPosition,
      size: cardSize,
      ownerId,
    });

    res.status(201).json({
      success: true,
      message: "Card created successfully",
      data: {
        ...newCard.toJSON(),
      },
    });
  } catch (error) {
    console.error("Error creating card:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create card",
      error: error.message,
    });
  }
};

exports.updateCard = async (req, res) => {
  try {
    const { cardId } = req.params;
    const { dashboardId, type, position, size } = req.body;
    const ownerId = req.adminId;

    // Find the card
    const card = await Card.findOne({
      where: {
        cardId,
        ownerId, // Ensure user owns the card
      },
    });

    if (!card) {
      return res.status(404).json({
        success: false,
        message: "Card not found",
      });
    }

    // Prepare update data
    const updateData = {};
    if (dashboardId !== undefined) updateData.dashboardId = dashboardId;
    if (type !== undefined) updateData.type = type;
    if (position !== undefined) updateData.position = position;
    if (size !== undefined) updateData.size = size;

    // Update the card
    await card.update(updateData);

    res.status(200).json({
      success: true,
      message: "Card updated successfully",
      data: {
        ...card.toJSON(),
      },
    });
  } catch (error) {
    console.error("Error updating card:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update card",
      error: error.message,
    });
  }
};

exports.getAllCards = async (req, res) => {
  try {
    const ownerId = req.adminId;
    const { dashboardId } = req.query; // Optional filter by dashboard

    // Build where condition
    const whereCondition = { ownerId };
    if (dashboardId) {
      whereCondition.dashboardId = dashboardId;
    }

    const cards = await Card.findAll({
      where: whereCondition,
      attributes: ['cardId', 'dashboardId', 'type', 'position', 'size', 'createdAt', 'updatedAt'],
      order: [['position', 'ASC']], // Order by position
    });

    res.status(200).json({
      success: true,
      message: "Cards retrieved successfully",
      data: cards,
    });
  } catch (error) {
    console.error("Error retrieving cards:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve cards",
      error: error.message,
    });
  }
};

exports.getCardById = async (req, res) => {
  try {
    const { cardId } = req.params;
    const ownerId = req.adminId;

    const card = await Card.findOne({
      where: {
        cardId,
        ownerId,
      },
      attributes: ['cardId', 'dashboardId', 'type', 'position', 'size', 'createdAt', 'updatedAt'],
    });

    if (!card) {
      return res.status(404).json({
        success: false,
        message: "Card not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Card retrieved successfully",
      data: card,
    });
  } catch (error) {
    console.error("Error retrieving card:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve card",
      error: error.message,
    });
  }
};

exports.deleteCard = async (req, res) => {
  try {
    const { cardId } = req.params;
    const ownerId = req.adminId;

    const card = await Card.findOne({
      where: {
        cardId,
        ownerId,
      },
    });

    if (!card) {
      return res.status(404).json({
        success: false,
        message: "Card not found",
      });
    }

    await card.destroy();

    res.status(200).json({
      success: true,
      message: "Card deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting card:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete card",
      error: error.message,
    });
  }
};

// Bulk update positions for reordering
exports.updateCardPositions = async (req, res) => {
  try {
    const { cards } = req.body; // Array of { cardId, position }
    const ownerId = req.adminId;

    if (!Array.isArray(cards)) {
      return res.status(400).json({
        success: false,
        message: "Cards array is required",
      });
    }

    // Update positions in transaction
    const transaction = await sequelize.transaction();

    try {
      for (const cardData of cards) {
        const { cardId, position } = cardData;
        
        await Card.update(
          { position },
          {
            where: {
              cardId,
              ownerId, // Ensure user owns the card
            },
            transaction,
          }
        );
      }

      await transaction.commit();

      res.status(200).json({
        success: true,
        message: "Card positions updated successfully",
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error updating card positions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update card positions",
      error: error.message,
    });
  }
};