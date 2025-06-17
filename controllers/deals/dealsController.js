const Deal = require("../../models/deals/dealsModels");
const Lead = require("../../models/leads/leadsModel");
const Person = require("../../models/leads/leadPersonModel");
const Organization = require("../../models/leads/leadOrganizationModel");
const { Op } = require("sequelize");
const { fn, col, literal } = require("sequelize");
const DealDetails = require("../../models/deals/dealsDetailModel");
const DealStageHistory = require("../../models/deals/dealsStageHistoryModel");
// Create a new deal with validation
exports.createDeal = async (req, res) => {
  try {
    const {
      contactPerson,
      organization,
      title,
      value,
      currency,
      pipeline,
      pipelineStage,
      expectedCloseDate,
      sourceChannel,
      sourceChannelId,
      serviceType,
      proposalValue,
      proposalCurrency,
      esplProposalNo,
      projectLocation,
      organizationCountry,
      proposalSentDate,
      sourceRequired,
      questionerShared,
      sectorialSector,
      sbuClass,
      phone,
      email,
      sourceOrgin,
      leadId
    } = req.body;

    // Validate required fields here...
let ownerId = req.user?.id || req.adminId || req.body.ownerId;


 // Validation
    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ message: "Title is required." });
    }
    if (!email || !/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
      return res.status(400).json({ message: "A valid email is required." });
    }
    if (!phone || !/^\+?\d{7,15}$/.test(phone)) {
      return res.status(400).json({ message: "A valid phone number is required." });
    }
    // Find or create Person and Organization here...
    // Check for unique title
    const existingDeal = await Deal.findOne({ where: { title } });
    if (existingDeal) {
      return res.status(400).json({ message: "A deal with this title already exists." });
    }
    // 1. Set masterUserID at the top, before using it anywhere
const masterUserID = req.adminId
        // 1. Check if a matching lead exists

    let existingLead = null;

    // 2. If sourceOrgin is '2', require and use leadId
    if (sourceOrgin === "2" || sourceOrgin === 2) {
      if (!leadId) {
        return res.status(400).json({ message: "leadId is required when sourceOrgin is 2." });
      }
      existingLead = await Lead.findByPk(leadId);
      if (!existingLead) {
        return res.status(404).json({ message: "Lead not found." });
      }
      // Use existingLead data for the deal (e.g., ownerId = existingLead.ownerId)
    
        let ownerId = req.adminId// fallback if no lead
    if (existingLead) {
      ownerId = existingLead.ownerId; // use the lead's ownerId if converting
    }
    //const masterUserID = req.user?.id || req.adminId || req.body.masterUserID;
    let leadId = null;
    if (existingLead) {
      leadId = existingLead.leadId;

      // Optionally, mark the lead as converted or link the deal
      // await existingLead.update({ convertedToDeal: true }); // if you have such a field
      // Or: await existingLead.update({ dealId: newDealId });
      //  // after deal is created
      // await existingLead.update({ dealId: deal.dealId });
    }
  }
        // 1. Find or create Organization
    let org = null;
if (organization) {
let org;
if (organization) {
  org = await Organization.findOne({ where: { organization } });
  if (!org) {
    org = await Organization.create({
      organization,
      masterUserID // make sure this is set
    });
  }
} else {
  return res.status(400).json({ message: "Organization name is required." });
} // findOrCreate returns [instance, created]
    }
        // 2. Find or create Person
    let person = null;
    if (contactPerson) {
  const masterUserID = req.adminId;

let person;
if (email) {
  person = await Person.findOne({ where: { email } });
  if (!person) {
    person = await Person.create({
      contactPerson,
      email,
      phone,
      leadOrganizationId: org ? org.leadOrganizationId : null,
      masterUserID
    });
  }
} else {
  return res.status(400).json({ message: "Email is required for contact person." });
}
    }
if (!(person ? person.contactPerson : contactPerson)) {
  return res.status(400).json({ message: "contactPerson is required." });
}
    // Create the lead
    const deal = await Deal.create({
      // contactPerson: person ? person.contactPerson : null,
     contactPerson: person ? person.contactPerson : contactPerson,
      organization: org ? org.organization : null,
      personId: person ? person.personId : null,
      leadOrganizationId: org ? org.leadOrganizationId : null,
       leadId, // link to the lead if found
      title,
      value,
      currency,
      pipeline,
      pipelineStage,
      expectedCloseDate,
      sourceChannel,
      sourceChannelId,
      serviceType,
      proposalValue,
      proposalCurrency,
      esplProposalNo,
      projectLocation,
      organizationCountry,
      proposalSentDate,
      sourceRequired,
      questionerShared,
      sectorialSector,
      sbuClass,
      phone,
      email,
      sourceOrgin,
      masterUserID: req.adminId, // Ensure masterUserID is set from the request
      ownerId,
      // Add personId, organizationId, etc. as needed
    });
    // Optionally, update the lead with the new dealId
    if (existingLead) {
      await existingLead.update({ dealId: deal.dealId });
    }
    res.status(201).json({ message: "Lead created successfully", deal });
  } catch (error) {
    console.log("Error creating deal:", error);
    
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getDeals = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      pipeline,
      pipelineStage,
      ownerId,
      isArchived
    } = req.query;

    const where = {};

    // Search by title, contactPerson, or organization
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { contactPerson: { [Op.like]: `%${search}%` } },
        { organization: { [Op.like]: `%${search}%` } }
      ];
    }

    // Filter by pipeline
    if (pipeline) {
      where.pipeline = pipeline;
    }

    // Filter by pipelineStage
    if (pipelineStage) {
      where.pipelineStage = pipelineStage;
    }

    // Filter by ownerId
    if (ownerId) {
      where.ownerId = ownerId;
    }

        // Add isArchived filter if provided
    if (typeof isArchived !== "undefined") {
      where.isArchived = isArchived === "true";
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { rows: deals, count: total } = await Deal.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [["createdAt", "DESC"]]
    });

    res.status(200).json({
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      deals,
    });
  } catch (error) {
    console.log(error);
    
    res.status(500).json({ message: "Internal server error" });
  }
};


exports.updateDeal = async (req, res) => {
  try {
    const { dealId } = req.params;
    const updateFields = {...req.body };

    // Separate DealDetails fields
    const dealDetailsFields = {};
    if ('statusSummary' in updateFields) dealDetailsFields.statusSummary = updateFields.statusSummary;
    if ('responsiblePerson' in updateFields) dealDetailsFields.responsiblePerson = updateFields.responsiblePerson;
    if ('rfpReceivedDate' in updateFields) dealDetailsFields.rfpReceivedDate = updateFields.rfpReceivedDate;

    // Remove DealDetails fields from main update
    delete updateFields.statusSummary;
    delete updateFields.responsiblePerson;
    delete updateFields.rfpReceivedDate;

    // Update Deal
    const deal = await Deal.findByPk(dealId);
    if (!deal) {
      return res.status(404).json({ message: "Deal not found." });
    }
       // Check if pipelineStage is changing
    // Only check for pipelineStage if it's in the request body
    if (updateFields.pipelineStage && updateFields.pipelineStage !== deal.pipelineStage) {
      await DealStageHistory.create({
        dealId: deal.dealId,
        stageName: updateFields.pipelineStage,
        enteredAt: new Date()
      });
    }
       await deal.update({...updateFields });

    // Update or create DealDetails
    if (Object.keys(dealDetailsFields).length > 0) {
      let dealDetails = await DealDetails.findOne({ where: { dealId } });
      if (dealDetails) {
        await dealDetails.update(dealDetailsFields);
      } else {
        await DealDetails.create({ dealId, ...dealDetailsFields });
      }
    }

    // Update all fields of Person
    if (deal.personId) {
      const person = await Person.findByPk(deal.personId);
      if (person) {
        // Only update fields that exist in the Person model
        const personAttributes = Object.keys(Person.rawAttributes);
        const personUpdate = {};
        for (const key of personAttributes) {
          if (key in req.body) {
            personUpdate[key] = req.body[key];
          }
        }
        if (Object.keys(personUpdate).length > 0) {
          await person.update(personUpdate);
        }
      }
    }

    // Update all fields of Organization
    if (deal.leadOrganizationId) {
      const org = await Organization.findByPk(deal.leadOrganizationId);
      if (org) {
        // Only update fields that exist in the Organization model
        const orgAttributes = Object.keys(Organization.rawAttributes);
        const orgUpdate = {};
        for (const key of orgAttributes) {
          if (key in req.body) {
            orgUpdate[key] = req.body[key];
          }
        }
        if (Object.keys(orgUpdate).length > 0) {
          await org.update(orgUpdate);
        }
      }
    }

    res.status(200).json({ message: "Deal, person, and organization updated successfully" });
  } catch (error) {
    console.log(error);
    
    res.status(500).json({ message: "Internal server error" });
  }
};


exports.getDealSummary = async (req, res) => {
  try {
    // 1. Per-currency summary
    const currencySummary = await Deal.findAll({
      attributes: [
        "currency",
        [fn("SUM", col("value")), "totalValue"],
        // Replace with your actual weighted value logic if needed
        [fn("SUM", col("value")), "weightedValue"],
        [fn("COUNT", col("dealId")), "dealCount"]
      ],
      group: ["currency"]
    });

    // 2. Overall summary
    const overall = await Deal.findAll({
      attributes: [
        [fn("SUM", col("value")), "totalValue"],
        [fn("SUM", col("value")), "weightedValue"],
        [fn("COUNT", col("dealId")), "dealCount"]
      ]
    });

    res.status(200).json({
      overall: overall[0],         // { totalValue, weightedValue, dealCount }
      currencySummary              // array of per-currency summaries
    });
  } catch (error) {
    console.log(error);
    
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.archiveDeal = async (req, res) => {
  try {
    const { dealId } = req.params;
    const deal = await Deal.findByPk(dealId);
    if (!deal) {
      return res.status(404).json({ message: "Deal not found." });
    }
    await deal.update({ isArchived: true });
    res.status(200).json({ message: "Deal archived successfully.",deal});
  } catch (error) {
    console.log(error);
    
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.unarchiveDeal = async (req, res) => {
  try {
    const { dealId } = req.params;
    const deal = await Deal.findByPk(dealId);
    if (!deal) {
      return res.status(404).json({ message: "Deal not found." });
    }
    await deal.update({ isArchived: false });
    res.status(200).json({ message: "Deal unarchived successfully.",deal });
  } catch (error) {
    console.log(error);
    
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getDealsByStage = async (req, res) => {
  try {
    const allStages = [
      "Qualified",
      "Contact Made",
      "Proposal Made",
      "Negotiations Started"
      // ...add all your stages here
    ];

    const result = [];
    let totalDeals = 0;

    for (const stage of allStages) {
      const deals = await Deal.findAll({
        where: { pipelineStage: stage},
        order: [["createdAt", "DESC"]]
      });

      const totalValue = deals.reduce((sum, deal) => sum + (deal.value || 0), 0);
      const dealCount = deals.length;
      totalDeals += dealCount;

      result.push({
        stage,
        totalValue,
        dealCount,
        deals
      });
    }

    res.status(200).json({
      totalDeals,
      stages: result
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// ...existing code...
exports.getDealDetail = async (req, res) => {
  try {
    const { dealId } = req.params;
    const deal = await Deal.findByPk(dealId, {
      include: [
        { model: DealDetails, as: "details" },
        { model: Person, as: "Person" },
        { model: Organization, as: "Organization" }
      ]
    });

    if (!deal) {
      return res.status(404).json({ message: "Deal not found." });
    }

        // --- Pipeline stage days calculation ---
    const stageHistory = await DealStageHistory.findAll({
      where: { dealId },
      order: [['enteredAt', 'ASC']]
    });

    const now = new Date();
    const pipelineStages = [];

    for (let i = 0; i < stageHistory.length; i++) {
      const stage = stageHistory[i];
      const nextStage = stageHistory[i + 1];
      const start = new Date(stage.enteredAt);
      const end = nextStage ? new Date(nextStage.enteredAt) : now;
      const days = Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
      pipelineStages.push({
        stageName: stage.stageName,
        days
      });
    }

        // Calculate avgTimeToWon for all won deals
    const wonDeals = await Deal.findAll({ where: { status: 'won' } });
    let avgTimeToWon = 0;
    if (wonDeals.length) {
      const totalDays = wonDeals.reduce((sum, d) => {
        if (d.wonDate && d.createdAt) {
          const days = Math.floor((d.wonDate - d.createdAt) / (1000 * 60 * 60 * 24));
          return sum + days;
        }
        return sum;
      }, 0);
      avgTimeToWon = Math.round(totalDays / wonDeals.length);
    }
        // ...existing overview calculations...
    // const now = new Date();
    const createdAt = deal.createdAt;
    const dealAgeDays = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
    const dealAge = dealAgeDays < 1 ? "< 1 day" : `${dealAgeDays} days`;
    const inactiveDays = 0; // Placeholder until you have activities

    // Send all person data
    const personArr = deal.Person ? [deal.Person.toJSON ? deal.Person.toJSON() : deal.Person] : [];

    // Send all organization data
    const orgArr = deal.Organization ? [deal.Organization.toJSON ? deal.Organization.toJSON() : deal.Organization] : [];

    // Flat deal object (as before)
    const dealObj = {
      dealId: deal.dealId,
      title: deal.title,
      value: deal.value,
      pipeline: deal.pipeline,
      pipelineStage: deal.pipelineStage,
      status: deal.status || "open",
      createdAt: deal.createdAt,
      expectedCloseDate: deal.expectedCloseDate,
      serviceType: deal.serviceType,
      proposalValue: deal.proposalValue,
      esplProposalNo: deal.esplProposalNo,
      projectLocation: deal.projectLocation,
      organizationCountry: deal.organizationCountry,
      proposalSentDate: deal.proposalSentDate,
      sourceOrgin: deal.sourceOrgin,
      sourceChannel: deal.sourceChannel,
      sourceChannelId: deal.sourceChannelId,
      statusSummary: deal.details?.statusSummary,
      responsiblePerson: deal.details?.responsiblePerson,
      rfpReceivedDate: deal.details?.rfpReceivedDate
      // ...other deal fields
    };

    res.status(200).json({
      deal: dealObj,
      person: personArr,
      organization: orgArr,
            pipelineStages, // [{ stageName: 'Qualified', days: 216 }, ...]
      currentStage: pipelineStages[pipelineStages.length - 1]?.stageName || deal.pipelineStage,
      overview: {
        dealAge,
        avgTimeToWon,
        inactiveDays,
        createdAt
      },
      participants: []
    });

      } catch (error) {
        console.log(error);
        
    res.status(500).json({ message: "Internal server error" });
  }
};


exports.deleteDeal = async (req, res) => {
  try {
    const { dealId } = req.params;
    const deal = await Deal.findByPk(dealId);

    if (!deal) {
      return res.status(404).json({ message: "Deal not found." });
    }

    await deal.destroy();

    res.status(200).json({ message: "Deal deleted successfully." });
  } catch (error) {
    console.log(error);
    
    res.status(500).json({ message: "Internal server error" });
  }
};
