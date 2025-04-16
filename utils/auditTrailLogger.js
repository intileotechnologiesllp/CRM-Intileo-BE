const AuditTrail = require("../models/reports/auditTrailModel");

exports.logAuditTrail = async (
  entity,
  action,
  entityId,
  performedBy,
  changes = null
) => {
  try {
    if (!entityId) {
      throw new Error("entityId is required for logging audit trail");
    }

    await AuditTrail.create({
      entity,
      action,
      entityId,
      performedBy,
      changes,
    });
  } catch (error) {
    console.error("Error logging audit trail:", error);
  }
};
