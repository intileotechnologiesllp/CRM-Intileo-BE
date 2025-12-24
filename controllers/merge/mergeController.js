// merge.controller.js
const { mergeEntitiesSequelize } = require("./mergeServices");

exports.mergeDealsHandler = async (req, res) => {
  try {
    const primaryId = Number(req.params.primaryId);
    const { secondaryIds, strategy, reason } = req.body;

    const result = await mergeEntitiesSequelize({
      entityType: "deal",
      primaryId,
      secondaryIds,
      strategy,
      reason,
      mergedBy: req.user.id
    });

    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
}

exports.mergeLeadsHandler = async (req, res) => {
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
      mergedBy: req.adminId
    });

    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
}
