const AuditTrail = require("../models/auditTrailModel");

exports.logAuditTrail = async (
  programId = null,
  mode = null,
  createdBy = null,
  error_desc = null,
  creatorId = null
) => {
  try {
    await AuditTrail.create({
      programId,
      mode,
      createdBy,
      error_desc,
      creatorId,
      timestamp: new Date(), // Automatically log the timestamp
    });
  } catch (err) {
    console.error("Error logging audit trail:", err);
  }
};
