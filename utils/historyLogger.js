const History = require("../models/reports/historyModel");

exports.logHistory = async (
  programId = null,
  mode = null,
  createdBy = null,
  recordId = null,
  modifiedBy = null,
  description = null,
  changes = null
) => {
  try {
    await History.create({
      programId,
      mode,
      createdBy,
      recordId,
      modifiedBy,
      description,
      changes, // JSON object to store modified data
      timestamp: new Date(), // Automatically log the timestamp
    });
  } catch (err) {
    console.error("Error logging history:", err);
  }
};
