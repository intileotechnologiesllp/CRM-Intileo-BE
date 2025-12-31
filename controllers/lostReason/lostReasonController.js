
// Create lost reason
exports.createLostReason = async (req, res) => {
  const { LostReason } = req.models;
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ message: "Reason is required." });
    const lostReason = await LostReason.create({ reason, isActive: true });
    res.status(201).json({ message: "Lost reason created.", lostReason });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get all active lost reasons
exports.getLostReasons = async (req, res) => {
  const { LostReason } = req.models;
  try {
    const lostReasons = await LostReason.findAll({ where: { isActive: true } });
    res.status(200).json({ lostReasons });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};