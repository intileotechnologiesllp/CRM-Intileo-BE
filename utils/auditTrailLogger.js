const AuditTrail = require("../models/auditTrailModel");

exports.logAuditTrail = async (
  entity,
  action,
  entityId,
  performedBy,
  ipAddress,
  changes = null
) => {
  try {
    await AuditTrail.create({
      entity,
      action,
      entityId,
      performedBy,
      ipAddress,
      changes,
    });
  } catch (error) {
    console.error("Error logging audit trail:", error);
  }
};
