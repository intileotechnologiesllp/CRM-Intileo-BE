const LeadColumnPreference = require("../../models/leads/leadColumnModel");

exports.saveLeadColumnPreference = async (req, res) => {
  const masterUserID = req.adminId;
  const { columns } = req.body;

  if (!columns || !Array.isArray(columns)) {
    return res.status(400).json({ message: "Columns array is required." });
  }

  try {
    const [pref] = await LeadColumnPreference.upsert({ masterUserID, columns });
    res.status(200).json({ message: "Preferences saved", columns: pref.columns });
  } catch (error) {
    res.status(500).json({ message: "Error saving preferences" });
  }
};
exports.getLeadColumnPreference = async (req, res) => {
  const masterUserID = req.adminId;
  try {
    const pref = await LeadColumnPreference.findOne({ where: { masterUserID } });
    res.status(200).json({ columns: pref ? pref.columns : [] });
  } catch (error) {
    res.status(500).json({ message: "Error fetching preferences" });
  }
};