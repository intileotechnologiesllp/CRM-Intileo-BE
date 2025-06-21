const LeadColumnPreference = require("../../models/leads/leadColumnModel");
const Lead = require("../../models/leads/leadsModel");
const { Op } = require("sequelize");
const LeadDetails = require("../../models/leads/leadDetailsModel");
exports.saveLeadColumnPreference = async (req, res) => {
  const masterUserID = req.adminId;
  const { columns } = req.body;

  if (!columns || !Array.isArray(columns)) {
    return res.status(400).json({ message: "Columns array is required." });
  }

  try {
    const [pref] = await LeadColumnPreference.upsert({ masterUserID, columns });
    res
      .status(200)
      .json({ message: "Preferences saved", columns: pref.columns });
  } catch (error) {
    res.status(500).json({ message: "Error saving preferences" });
  }
};
exports.getLeadColumnPreference = async (req, res) => {
  // const masterUserID = req.adminId;
  try {
    const pref = await LeadColumnPreference.findOne({ where: {} });

    let columns = [];
    if (pref) {
      // Parse columns if it's a string
      columns = typeof pref.columns === "string"
        ? JSON.parse(pref.columns)
        : pref.columns;
    }

    // Optionally: parse filterConfig for each column if needed
    columns = columns.map(col => {
      if (col.filterConfig) {
        col.filterConfig = typeof col.filterConfig === "string"
          ? JSON.parse(col.filterConfig)
          : col.filterConfig;
      }
      return col;
    });

    res.status(200).json({ columns });
  } catch (error) {
    res.status(500).json({ message: "Error fetching preferences" });
  }
};
exports.deleteLeadColumn = async (req, res) => {
  const masterUserID = req.adminId;
  const { key } = req.body; // The column key to remove

  if (!key) {
    return res.status(400).json({ message: "Column key is required." });
  }

  try {
    const pref = await LeadColumnPreference.findOne({
      where: { masterUserID },
    });
    if (!pref) {
      return res.status(404).json({ message: "Preferences not found." });
    }

    // Remove the column with the matching key
    const updatedColumns = pref.columns.filter((col) =>
      typeof col === "string" ? col !== key : col.key !== key
    );

    pref.columns = updatedColumns;
    await pref.save();

    res.status(200).json({ message: "Column deleted", columns: pref.columns });
  } catch (error) {
    res.status(500).json({ message: "Error deleting column" });
  }
};

exports.saveAllLeadFieldsWithCheck = async (req, res) => {
  let LeadDetails;
  try {
    LeadDetails = require("../../models/leads/leadDetailsModel");
  } catch (e) {
    LeadDetails = null;
  }

  // Get all field names from Lead and LeadDetails models
  const leadFields = Object.keys(Lead.rawAttributes);
  const leadDetailsFields = LeadDetails
    ? Object.keys(LeadDetails.rawAttributes)
    : [];
  const allFieldNames = Array.from(
    new Set([...leadFields, ...leadDetailsFields])
  );

  // Exclude fields that are likely IDs (case-insensitive, ends with 'id' or is 'id')
  const filteredFieldNames = allFieldNames.filter(
    (field) => !/^id$/i.test(field) && !/id$/i.test(field)
  );

  // Accept array of { value, check } from req.body
  const { checkedFields } = req.body || {};

  // Build columns array to save: always include all fields, set check from checkedFields if provided
  let columnsToSave = filteredFieldNames.map((field) => {
    let check = false;
    if (Array.isArray(checkedFields)) {
      const found = checkedFields.find((item) => item.value === field);
      check = found ? !!found.check : false;
    }
    return { key: field, check };
  });

 try {
  let pref = await LeadColumnPreference.findOne();
  if (!pref) {
    // Create the record if it doesn't exist
    pref = await LeadColumnPreference.create({ columns: columnsToSave });
  } else {
    // Update the existing record
    pref.columns = columnsToSave;
    await pref.save();
  }
  res.status(200).json({ message: "All columns saved", columns: pref.columns });
} catch (error) {
  console.log("Error saving all columns:", error);
  res.status(500).json({ message: "Error saving all columns" });
}
};

exports.updateLeadColumnChecks = async (req, res) => {
  // Expecting: { columns: [ { key: "columnName", check: true/false }, ... ] }
  const { columns } = req.body;

  if (!Array.isArray(columns)) {
    return res.status(400).json({ message: "Columns array is required." });
  }

  try {
    // Find the global LeadColumnPreference record
    let pref = await LeadColumnPreference.findOne();
    if (!pref) {
      return res.status(404).json({ message: "Preferences not found." });
    }

    // Parse columns if stored as string
    let prefColumns = typeof pref.columns === "string"
      ? JSON.parse(pref.columns)
      : pref.columns;

    // Update check status for matching columns
    prefColumns = prefColumns.map(col => {
      const found = columns.find(c => c.key === col.key);
      if (found) {
        return { ...col, check: !!found.check };
      }
      return col;
    });

    pref.columns = prefColumns;
    await pref.save();
    res.status(200).json({ message: "Columns updated", columns: pref.columns });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating columns" });
  }
};


