const LeadDetails = require("../../models/leads/leadDetailsModel"); // Import LeadDetails model

exports.updateLead = async (req, res) => {
  const { leadId } = req.params; // Use leadId from the request parameters
  const { leadDetails, ...updatedData } = req.body; // Separate leadDetails from other data

  try {
    const lead = await Lead.findByPk(leadId); // Find the lead by leadId
    if (!lead) {
      await logAuditTrail(
        PROGRAMS.LEAD_MANAGEMENT, // Program ID for authentication
        "LEAD_UPDATE", // Mode
        req.role, // No user ID for failed sign-in
        "Lead not found", // Error description
        req.adminId
      );
      return res.status(404).json({ message: "Lead not found" });
    }

    // Capture the original data before the update
    const originalData = {
      contactPerson: lead.contactPerson,
      organization: lead.organization,
      title: lead.title,
      valueLabels: lead.valueLabels,
      expectedCloseDate: lead.expectedCloseDate,
      sourceChannel: lead.sourceChannel,
      sourceChannelID: lead.sourceChannelID,
      serviceType: lead.serviceType,
      scopeOfServiceType: lead.scopeOfServiceType,
      phone: lead.phone,
      email: lead.email,
      company: lead.company,
      proposalValue: lead.proposalValue,
      esplProposalNo: lead.esplProposalNo,
      projectLocation: lead.projectLocation,
      organizationCountry: lead.organizationCountry,
      proposalSentDate: lead.proposalSentDate,
      status: lead.status,
    };

    // Update the lead with the provided data
    await lead.update(updatedData);

    // Handle leadDetails if provided
    if (leadDetails) {
      const existingLeadDetails = await LeadDetails.findOne({
        where: { leadId },
      });

      if (existingLeadDetails) {
        // Update existing leadDetails
        await existingLeadDetails.update(leadDetails);
      } else {
        // Create new leadDetails
        await LeadDetails.create({
          leadId,
          ...leadDetails,
        });
      }
    }

    // Capture the updated data
    const updatedLead = {
      contactPerson: lead.contactPerson,
      organization: lead.organization,
      title: lead.title,
      valueLabels: lead.valueLabels,
      expectedCloseDate: lead.expectedCloseDate,
      sourceChannel: lead.sourceChannel,
      sourceChannelID: lead.sourceChannelID,
      serviceType: lead.serviceType,
      scopeOfServiceType: lead.scopeOfServiceType,
      phone: lead.phone,
      email: lead.email,
      company: lead.company,
      proposalValue: lead.proposalValue,
      esplProposalNo: lead.esplProposalNo,
      projectLocation: lead.projectLocation,
      organizationCountry: lead.organizationCountry,
      proposalSentDate: lead.proposalSentDate,
      status: lead.status,
    };

    // Calculate the changes
    const changes = {};
    for (const key in updatedLead) {
      if (originalData[key] !== updatedLead[key]) {
        changes[key] = { from: originalData[key], to: updatedLead[key] };
      }
    }

    await historyLogger(
      PROGRAMS.LEAD_MANAGEMENT, // Program ID for lead management
      "LEAD_UPDATE", // Mode
      lead.userId, // Created by (Admin ID)
      leadId, // Record ID (Lead ID)
      req.adminId, // Modified by (Admin ID)
      `Lead with ID ${leadId} updated by user ${req.role}`, // Description
      changes // Changes logged as JSON
    );

    res.status(200).json({ message: "Lead updated successfully", lead });
  } catch (error) {
    console.error("Error updating lead:", error);
    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT, // Program ID for authentication
      "LEAD_UPDATE", // Mode
      null, // No user ID for failed sign-in
      "Error updating lead: " + error.message, // Error description
      null
    );
    res.status(500).json({ message: "Internal server error" });
  }
};