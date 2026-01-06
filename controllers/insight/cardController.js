const Card  = require("../../models/insight/cardModel"); // Adjust path as needed
const { Op, Sequelize } = require("sequelize");
// const {defaultSequelize : sequelize, clientConnections} = require("../../config/db");

exports.createCard = async (req, res) => {
  const {Card} = req.models;
  try {
    const { dashboardId, type, uniqueId } = req.body;
    const ownerId = req.adminId;

    // Validate required fields
    if (!type || !uniqueId) {
      return res.status(400).json({
        success: false,
        message: "Type and uniqueId are required",
      });
    }

    // Check if card with same uniqueId, type, and dashboardId already exists
    const existingCard = await Card.findOne({
      where: {
        uniqueId,
        type,
        dashboardId: dashboardId || null
      }
    });

    if (existingCard) {
      return res.status(409).json({
        success: false,
        message: "Card with this uniqueId, type, and dashboardId already exists",
      });
    }

    let cardPosition;
    
    // Find the highest position for this dashboard
    const lastCard = await Card.findOne({
      where: { dashboardId: dashboardId || null },
      order: [['position', 'DESC']]
    });
    
    cardPosition = lastCard ? lastCard.position + 1 : 1;

    const newCard = await Card.create({
      dashboardId,
      type,
      position: cardPosition,
      uniqueId,
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
    
    // Handle unique constraint violation from database level
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        success: false,
        message: "Card with this uniqueId, type, and dashboardId already exists",
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Failed to create card",
      error: error.message,
    });
  }
};

exports.updateCard = async (req, res) => {
  const {Card} = req.models;
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
  const {Card} = req.models;
  try {
    const ownerId = req.adminId;
    const { dashboardId } = req.query; // Get dashboardId from query params

    // Validate dashboardId
    if (!dashboardId) {
      return res.status(400).json({
        success: false,
        message: "Dashboard ID is required as query parameter",
      });
    }

    const cards = await Card.findAll({
      where: {
        ownerId,
        dashboardId: dashboardId
      },
      attributes: [
        'cardId', 
        'dashboardId', 
        'uniqueId',
        'type', 
        'position', 
        'width', 
        'height', 
        'ownerId',
        'createdAt', 
        'updatedAt'
      ],
      order: [['position', 'ASC']],
    });

    res.status(200).json({
      success: true,
      message: cards.length > 0 
        ? "Cards retrieved successfully" 
        : "No cards found for this dashboard",
      data: cards,
      count: cards.length
    });
  } catch (error) {
    console.error("Error retrieving cards by dashboard:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve cards",
      error: error.message,
    });
  }

};

exports.getCardById = async (req, res) => {
  const {Card} = req.models;
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

exports.deleteCardFromDashboard = async (req, res) => {
  const {Card} = req.models;

    // Get the client connection from request (attached by middleware)
  const clientConnection = req.clientConnection;
  
  if (!clientConnection) {
    return res.status(500).json({
      message: "No database connection available. Please login again.",
    });
  }

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

    const deletedPosition = card.position;
    const cardDashboardId = card.dashboardId;

    await card.destroy();

    // Reorder remaining cards in the same dashboard
    await Card.update(
      { position: clientConnection.literal('position - 1') },
      {
        where: {
          dashboardId: cardDashboardId,
          position: { [Op.gt]: deletedPosition } // Use Op.gt instead of sequelize.Op.gt
        }
      }
    );

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

exports.deleteCard = async (req, res) => {
  const {Card} = req.models;

  // Get the client connection from request (attached by middleware)
  const clientConnection = req.clientConnection;
  
  if (!clientConnection) {
    return res.status(500).json({
      message: "No database connection available. Please login again.",
    });
  }

  try {
    const { dashboardId, uniqueId, type } = req.body;
    const ownerId = req.adminId;

    // Validate required fields
    if (uniqueId === undefined || !type) {
      return res.status(400).json({
        success: false,
        message: "uniqueId and type are required",
      });
    }

    // Find the card by the composite key
    const card = await Card.findOne({
      where: {
        dashboardId: dashboardId || null,
        uniqueId,
        type,
        ownerId,
      },
    });

    if (!card) {
      return res.status(404).json({
        success: false,
        message: "Card not found",
      });
    }

    // Store card position before deletion for reordering
    const deletedPosition = card.position;
    const cardDashboardId = card.dashboardId;

    await card.destroy();

    // Reorder remaining cards in the same dashboard
    await Card.update(
      { position: clientConnections.literal('position - 1') },
      {
        where: {
          dashboardId: cardDashboardId,
          position: { [Op.gt]: deletedPosition } // Use Op.gt instead of sequelize.Op.gt
        }
      }
    );

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
  const {Card} = req.models;

    // Get the client connection from request (attached by middleware)
  const clientConnection = req.clientConnection;
  
  if (!clientConnection) {
    return res.status(500).json({
      message: "No database connection available. Please login again.",
    });
  }

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
    const transaction = await clientConnection.transaction();

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