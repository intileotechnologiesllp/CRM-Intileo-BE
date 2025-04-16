const AuditTrail = require("../models/reports/auditTrailModel");

const auditTrailMiddleware = (entity, action) => {
  return async (req, res, next) => {
    try {
      const { performedBy = "system" } = req.body; // Default to "system" if not provided
      const changes = req.body.changes || null; // Optional changes object
      const entityId = req.params.id || req.body.entityId; // Use `id` from params or `entityId` from body

      if (!entityId) {
        console.error("Audit Trail Middleware: Missing entityId");
        return res
          .status(400)
          .json({ message: "Entity ID is required for audit trail" });
      }

      // Log the audit trail
      await AuditTrail.create({
        entity,
        action,
        entityId,
        performedBy,
        changes,
      });

      next(); // Proceed to the next middleware or controller
    } catch (error) {
      console.error("Error in Audit Trail Middleware:", error);
      res
        .status(500)
        .json({ message: "Internal server error while logging audit trail" });
    }
  };
};

module.exports = auditTrailMiddleware;
