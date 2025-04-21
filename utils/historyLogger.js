const History = require("../models/reports/historyModel");

exports.logHistory = async (
  programId = null,
  mode = null,
  createdById = null,
  recordId = null,
  modifiedBy = null,
  description = null,
  changes = null
) => {
  try {
    if (typeof description !== "string") {
        description = JSON.stringify(description); // Convert to string if it's an object or array
      }


    await History.create({
      programId,
      mode,
      createdById,
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
