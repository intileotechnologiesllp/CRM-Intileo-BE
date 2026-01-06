// merge.controller.js
const { mergeEntitiesSequelize } = require("./mergeServices");

exports.mergeDealsHandler = async (req, res) => {
  const {Lead, Deal, Activity, Email, MergeMap, TagMap} = req.models;
    
  // Get the client connection from request (attached by middleware)
  const clientConnection = req.clientConnection;
  
  if (!clientConnection) {
    return res.status(500).json({
      message: "No database connection available. Please login again.",
    });
  }

  try {
    const primaryId = Number(req.params.primaryId);
    const { secondaryIds, strategy, reason } = req.body;

    const result = await mergeEntitiesSequelize({
      entityType: "deal",
      primaryId,
      secondaryIds,
      strategy,
      reason,
      mergedBy: req.user.id,
      Lead, Deal, Activity, Email, MergeMap, TagMap, clientConnection
    });

    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
}

exports.mergeLeadsHandler = async (req, res) => {
  const {Lead, Deal, Activity, Email, MergeMap, TagMap} = req.models;
  try {
    console.log("HERE STEP 0")
    const primaryId = Number(req.params.primaryId);
    console.log(primaryId,"HERE STEP 0")
    const { secondaryIds, strategy, reason } = req.body;

    const result = await mergeEntitiesSequelize({
      entityType: "lead",
      primaryId,
      secondaryIds,
      strategy,
      reason,
      mergedBy: req.adminId,
      Lead, Deal, Activity, Email, MergeMap, TagMap
    });

    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
}
