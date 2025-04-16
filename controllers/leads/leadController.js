const Lead = require("../../models/leads/leadsModel");

exports.createLead = async (req, res) => {
  const {
    contactPerson,
    organization,
    title,
    valueLabels,
    expectedCloseDate,
    sourceChannel,
    sourceChannelID,
    serviceType,
    scopeOfServiceType,
    phone,
    email,
    company,
    proposalValue,
    esplProposalNo,
    projectLocation,
    organizationCountry,
    proposalSentDate,
    status,
  } = req.body;

  try {
    // Ensure only admins can create leads
    // if (req.user.role !== "admin") {
    //   return res
    //     .status(403)
    //     .json({ message: "Access denied. Only admins can create leads." });
    // }

    // Create the lead with the userId from the authenticated user
    const lead = await Lead.create({
      contactPerson,
      organization,
      title,
      valueLabels,
      expectedCloseDate,
      sourceChannel,
      sourceChannelID,
      serviceType,
      scopeOfServiceType,
      phone,
      email,
      company,
      proposalValue,
      esplProposalNo,
      projectLocation,
      organizationCountry,
      proposalSentDate,
      status,
      userId: req.adminId, // Associate the lead with the authenticated user
    });

    res.status(201).json({ message: "Lead created successfully", lead });
  } catch (error) {
    console.error("Error creating lead:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
