const LeadColumnPreference = require("../../models/leads/leadColumnModel");
const Lead = require("../../models/leads/leadsModel");
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
exports.deleteLeadColumn = async (req, res) => {
  const masterUserID = req.adminId;
  const { key } = req.body; // The column key to remove

  if (!key) {
    return res.status(400).json({ message: "Column key is required." });
  }

  try {
    const pref = await LeadColumnPreference.findOne({ where: { masterUserID } });
    if (!pref) {
      return res.status(404).json({ message: "Preferences not found." });
    }

    // Remove the column with the matching key
    const updatedColumns = pref.columns.filter(
      col => (typeof col === "string" ? col !== key : col.key !== key)
    );

    pref.columns = updatedColumns;
    await pref.save();

    res.status(200).json({ message: "Column deleted", columns: pref.columns });
  } catch (error) {
    res.status(500).json({ message: "Error deleting column" });
  }
};

exports.getAllLeadFields = async (req, res) => {
  const masterUserID = req.adminId;
  const fields = [
    { value: "contactPerson", label: "Contact person" },
    { value: "organization", label: "Organization" },
    { value: "title", label: "Title" },
    { value: "valueLabels", label: "Value Labels" },
    { value: "expectedCloseDate", label: "Expected Close Date" },
    { value: "sourceChannel", label: "Source channel" },
    { value: "sourceChannelID", label: "Source channel ID" },
    { value: "serviceType", label: "Service Type" },
    { value: "scopeOfServiceType", label: "Scope of Service Type" },
    { value: "phone", label: "Person phone" },
    { value: "email", label: "Email" },
    { value: "company", label: "Company" },
    { value: "proposalValue", label: "Proposal Value" },
    { value: "esplProposalNo", label: "ESPL Proposal No." },
    { value: "projectLocation", label: "Project Location" },
    { value: "organizationCountry", label: "Organization Country" },
    { value: "proposalSentDate", label: "Proposal Sent Date" },
    { value: "status", label: "Status" },
    { value: "masterUserID", label: "Owner" },
    { value: "createdAt", label: "Lead created" },
    { value: "updatedAt", label: "Last updated" },
    // Add any custom/virtual fields below
    { value: "creator", label: "Creator" },
    { value: "currency", label: "Currency" },
    { value: "nextActivityDate", label: "Next activity date" },
    { value: "nextActivityStatus", label: "Next activity status" },
    { value: "reportsPrepared", label: "No. of reports prepared for the project" },
    { value: "organizationName", label: "Organization name" },
    { value: "seen", label: "Seen" },
    { value: "questionerShared", label: "Questioner Shared?" },
    { value: "responsiblePerson", label: "Responsible Person" },
    { value: "rfpReceivedDate", label: "RFP received Date" },
    { value: "sbuClass", label: "SBU Class" },
    { value: "sectoralSector", label: "Sectoral Sector" },
    { value: "source", label: "Source" },
    { value: "sourceOrigin", label: "Source origin" },
    { value: "sourceOriginID", label: "Source origin ID" },
    { value: "statusSummery", label: "Status Summery" },
    { value: "archiveTime", label: "Archive time" },
    { value: "value", label: "Value" },
    { value: "visibleTo", label: "Visible to" },
    // ...add more as needed
  ];
    try {
    const pref = await LeadColumnPreference.findOne({ where: { masterUserID } });
    let usedKeys = [];
    if (pref && Array.isArray(pref.columns)) {
      usedKeys = pref.columns.map(col => (typeof col === "string" ? col : col.key));
    }
    // Filter out fields that are already in preferences
    const availableFields = fields.filter(field => !usedKeys.includes(field.value));
    res.status(200).json({ fields: availableFields });
  } catch (error) {
    res.status(500).json({ message: "Error fetching lead fields" });
  }
};