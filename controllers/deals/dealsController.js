const Deal = require("../../models/deals/dealsModels");
const Lead = require("../../models/leads/leadsModel");
const Person = require("../../models/leads/leadPersonModel");
const Organization = require("../../models/leads/leadOrganizationModel");
const { Op } = require("sequelize");
const { fn, col, literal } = require("sequelize");
const DealDetails = require("../../models/deals/dealsDetailModel");
const DealStageHistory = require("../../models/deals/dealsStageHistoryModel");
const DealParticipant = require("../../models/deals/dealPartcipentsModel");
const MasterUser = require("../../models/master/masterUserModel");
const DealNote = require("../../models/deals/delasNoteModel");
const Email=require("../../models/email/emailModel");
const Attachment = require("../../models/email/attachmentModel");
const LeadFilter = require("../../models/leads/leadFiltersModel");
const {convertRelativeDate} = require("../../utils/helper");
const Activity = require("../../models/activity/activityModel");
const DealColumnPreference = require("../../models/deals/dealColumnModel"); // Adjust path as needed
const {logAuditTrail} = require("../../utils/auditTrailLogger"); // Adjust path as needed
const historyLogger = require("../../utils/historyLogger").logHistory; // Import history logger
const { getProgramId } = require("../../utils/programCache");
// Create a new deal with validation
exports.createDeal = async (req, res) => {
  try {
    const dealProgramId = getProgramId("DEALS");
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
      source
    } = req.body;

    // Validate required fields here...
let ownerId = req.user?.id || req.adminId || req.body.ownerId;


 // Validation
    if (!title || typeof title !== "string" || !title.trim()) {
await logAuditTrail(
      dealProgramId,
      "DEAL_CREATION",
      req.role,
      `Deal creation failed: Title is required.`,
      req.adminId,
    
    );
      return res.status(400).json({ message: "Title is required." });
    }
    if (!email || !/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
await logAuditTrail(
      dealProgramId,
      "DEAL_CREATION",
      req.role,
      `Deal creation failed: A valid email is required.`,
      req.adminId,
    );
      return res.status(400).json({ message: "A valid email is required." });
    }
    if (!phone || !/^\+?\d{7,15}$/.test(phone)) {
await logAuditTrail(
      dealProgramId,
      "DEAL_CREATION",
      req.role,
      `Deal creation failed: A valid phone number is required.`,
      req.adminId,
    );
      return res.status(400).json({ message: "A valid phone number is required." });
    }
    // Find or create Person and Organization here...
    // Check for unique title
    const existingDeal = await Deal.findOne({ where: { title } });
    if (existingDeal) {
await logAuditTrail(
      dealProgramId,
      "DEAL_CREATION",
      req.role,
      `Deal creation failed: A deal with this title already exists.`,
      req.adminId,
    );
      return res.status(400).json({ message: "A deal with this title already exists." });
    }
    // Check for duplicate contactPerson in the deals table
const duplicateContactPerson = await Deal.findOne({ where: { contactPerson } });
if (duplicateContactPerson) {
await logAuditTrail(
  dealProgramId,
  "DEAL_CREATION",
  req.role,
  `Deal creation failed: A deal with this contact person already exists.`,
  req.adminId,
);
  return res.status(409).json({
    message: "A deal with this contact person already exists."
  });
}
    // 1. Set masterUserID at the top, before using it anywhere
const masterUserID = req.adminId
        // 1. Check if a matching lead exists

    let existingLead = null;

    // 2. If sourceOrgin is '2', require and use leadId
    let leadId = req.body.leadId;
 if (sourceOrgin === "2" || sourceOrgin === 2) {
  if (!leadId) {
await logAuditTrail(
    dealProgramId,
    "DEAL_CREATION",
    req.role,
    `Deal creation failed: leadId is required when sourceOrgin is 2.`,
    req.adminId,
  );
    return res.status(400).json({ message: "leadId is required when sourceOrgin is 2." });
  }
  existingLead = await Lead.findByPk(leadId);
  if (!existingLead) {
await logAuditTrail(
    dealProgramId,
    "DEAL_CREATION",
    req.role,
    `Deal creation failed: Lead with leadId ${leadId} not found.`,
    req.adminId,
  );
    return res.status(404).json({ message: "Lead not found." });
  }
  ownerId = existingLead.ownerId; // assign, don't redeclare
  leadId = existingLead.leadId;   // assign, don't redeclare
  // Optionally, update the lead after deal creation
}
        // 1. Find or create Organization
    let org = null;
if (organization) {
if (organization) {
  org = await Organization.findOne({ where: { organization} });
  if (!org) {
    org = await Organization.create({
      organization,
      masterUserID // make sure this is set
    });
  }
} else {
await logAuditTrail(
    dealProgramId,
    "DEAL_CREATION",
    req.role,
    `Deal creation failed: Organization name is required.`,
    req.adminId,
  );
  return res.status(400).json({ message: "Organization name is required." });
} // findOrCreate returns [instance, created]
    }
        // 2. Find or create Person
    let person = null;
    if (contactPerson) {
  const masterUserID = req.adminId;

if (email) {
  person = await Person.findOne({ where: { email } });
  // console.log(person.personId," person found");
  
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
await logAuditTrail(
  dealProgramId,
  "DEAL_CREATION",
  req.role,
  `Deal creation failed: Email is required for contact person.`,
  req.adminId,
);
  return res.status(400).json({ message: "Email is required for contact person." });
}
    }
if (!(person ? person.contactPerson : contactPerson)) {
  return res.status(400).json({ message: "contactPerson is required." });
}
    // Create the lead
    console.log(person.personId," before deal creation");
    // Before saving to DB
    if (sourceOrgin === "2" || sourceOrgin === 2) {
  if (!leadId) {
await logAuditTrail(
    dealProgramId,
    "DEAL_CREATION",
    req.role,
    `Deal creation failed: leadId is required when sourceOrgin is 2.`,
    req.adminId,
  );
    return res.status(400).json({ message: "leadId is required when sourceOrgin is 2." });
  }
  existingLead = await Lead.findByPk(leadId);
  if (!existingLead) {
    return res.status(404).json({ message: "Lead not found." });
  }
  // Prevent conversion if already converted to a deal
  if (existingLead.dealId) {
    await logAuditTrail(
      dealProgramId,
      "DEAL_CREATION",
      req.role,
      `Deal creation failed: This lead is already converted to a deal.`,
      req.adminId
    );
    return res.status(400).json({ message: "This lead is already converted to a deal." });
  }
  ownerId = existingLead.ownerId;
  leadId = existingLead.leadId;
}
    const deal = await Deal.create({
      // contactPerson: person ? person.contactPerson : null,
     contactPerson: person ? person.contactPerson : contactPerson,
      organization: org ? org.organization : null,
      personId: person ? person.personId : null,
      leadOrganizationId: org ? org.leadOrganizationId : null,
  //       personId: person.personId,
  // leadOrganizationId: org.leadOrganizationId,
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
      status: "open", // Default status
      source
      // Add personId, organizationId, etc. as needed
    });
    let responsiblePerson = null;
if (sourceOrgin === "2" || sourceOrgin === 2) {
  // Use ownerId for responsible person
  const owner = await MasterUser.findOne({ where: { masterUserID: ownerId } });
  responsiblePerson = owner ? owner.name : null;
} else {
  // Use masterUserID for responsible person
  const user = await MasterUser.findOne({ where: { masterUserID: req.adminId } });
  responsiblePerson = user ? user.name : null;
}

if (sourceOrgin === 0 && req.body.emailID) {
  await Email.update(
    { leadId: lead.leadId },
    { where: { emailID: req.body.emailID } }
  );
}
       await DealDetails.create({
      dealId: deal.dealId, // or deal.id depending on your PK
      responsiblePerson,
      ownerName: responsiblePerson, // or any other field you want to set
      // ...other dealDetails fields if needed
    });
    // Optionally, update the lead with the new dealId
        await DealStageHistory.create({
      dealId: deal.dealId,
      stageName: deal.pipelineStage,
      enteredAt: deal.createdAt // or new Date()
    });
        if (person || org) {
      await DealParticipant.create({
        dealId: deal.dealId,
        personId: person ? person.personId : null,
        leadOrganizationId: org ? org.leadOrganizationId : null
      });
    }
    
    if (existingLead) {
      await existingLead.update({ dealId: deal.dealId });
    }

  await historyLogger(
    dealProgramId,
    "DEAL_CREATION",
    deal.masterUserID,
    deal.dealId,
    null,
    `Deal is created by ${req.role}`,
    null
  );


    res.status(201).json({ message: "deal created successfully", deal });
  } catch (error) {
    console.log("Error creating deal:", error);
    
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getDeals = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
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
    // --- Add this block to get checked columns ---
    const pref = await DealColumnPreference.findOne();

       let attributes = [];
    let dealDetailsAttributes = [];
    if (pref) {
      const columns = typeof pref.columns === "string" ? JSON.parse(pref.columns) : pref.columns;
      // Get all Deal and DealDetails fields
      const dealFields = Object.keys(Deal.rawAttributes);
      const dealDetailsFields = DealDetails ? Object.keys(DealDetails.rawAttributes) : [];
      // Split checked columns by table
      columns.filter(col => col.check).forEach(col => {
        if (dealFields.includes(col.key)) attributes.push(col.key);
        else if (dealDetailsFields.includes(col.key)) dealDetailsAttributes.push(col.key);
      });
      if (attributes.length === 0) attributes = undefined;
      if (dealDetailsAttributes.length === 0) dealDetailsAttributes = undefined;
    }

// --- DYNAMIC FILTERS START HERE ---
if (req.query.filterId) {
  const filter = await LeadFilter.findByPk(req.query.filterId);
  if (filter) {
    const filterConfig = typeof filter.filterConfig === "string"
      ? JSON.parse(filter.filterConfig)
      : filter.filterConfig;

    const { all = [], any = [] } = filterConfig;
    const dealFields = Object.keys(Deal.rawAttributes);
    const dealDetailsFields = DealDetails ? Object.keys(DealDetails.rawAttributes) : [];

    let filterWhere = {};
    let dealDetailsWhere = {};

    if (all.length > 0) {
      filterWhere[Op.and] = [];
      dealDetailsWhere[Op.and] = [];
      all.forEach(cond => {
        if (dealFields.includes(cond.field)) {
          filterWhere[Op.and].push(buildCondition(cond));
        } else if (dealDetailsFields.includes(cond.field)) {
          dealDetailsWhere[Op.and].push(buildCondition(cond));
        }
      });
      if (filterWhere[Op.and].length === 0) delete filterWhere[Op.and];
      if (dealDetailsWhere[Op.and].length === 0) delete dealDetailsWhere[Op.and];
    }

    if (any.length > 0) {
      filterWhere[Op.or] = [];
      dealDetailsWhere[Op.or] = [];
      any.forEach(cond => {
        if (dealFields.includes(cond.field)) {
          filterWhere[Op.or].push(buildCondition(cond));
        } else if (dealDetailsFields.includes(cond.field)) {
          dealDetailsWhere[Op.or].push(buildCondition(cond));
        }
      });
      if (filterWhere[Op.or].length === 0) delete filterWhere[Op.or];
      if (dealDetailsWhere[Op.or].length === 0) delete dealDetailsWhere[Op.or];
    }

    // Merge with your existing where
    Object.assign(where, filterWhere);

    // Add DealDetails where to include
    if (dealDetailsWhere && Object.keys(dealDetailsWhere).length > 0) {
      // If you already have a DealDetails include, add where to it
      let detailsInclude = {
        model: DealDetails,
        as: "details",
        attributes: dealDetailsAttributes,
        where: dealDetailsWhere
      };
      include = [detailsInclude];
    } else {
      include = [{
        model: DealDetails,
        as: "details",
        attributes: dealDetailsAttributes
      }];
    }
  }
} else {
  // If no filterId, use your default include logic
  include = [{
    model: DealDetails,
    as: "details",
    attributes: dealDetailsAttributes
  }];
}
// --- DYNAMIC FILTERS END HERE ---

    // const offset = (parseInt(page) - 1) * parseInt(limit);
        // Pagination
    const offset = (parseInt(req.query.page || 1) - 1) * parseInt(req.query.limit || 10);
    // const limit = parseInt(req.query.limit || 10);
// Always include dealId in attributes
if (attributes && !attributes.includes("dealId")) {
  attributes.unshift("dealId");
}
if (req.role !== "admin") {
  where[Op.or] = [
    { masterUserID: req.adminId },
    { ownerId: req.adminId }
  ];
}

    const { rows: deals, count: total } = await Deal.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [["createdAt", "DESC"]],
      attributes, // <-- only checked columns will be returned
            include: [
        {
          model: DealDetails,
          as: "details", // Make sure your association uses this alias
          attributes: dealDetailsAttributes
        }
      ]
    });

    res.status(200).json({
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      deals,
    });
  } catch (error) {
    console.log(error);
    await logAuditTrail(
      getProgramId("DEALS"),
      "DEAL_FETCH",
      req.role,
      `Failed to fetch deals: ${error.message}`,
      req.adminId
    );
    res.status(500).json({ message: "Internal server error" });
  }
};

// --- Helper functions (reuse from your prompt) ---

const operatorMap = {
  "is": "eq",
  "is not": "ne",
  "is empty": "is empty",
  "is not empty": "is not empty",
  "is exactly or earlier than": "lte",
  "is earlier than": "lt",
  "is exactly or later than": "gte",
  "is later than": "gt"
  // Add more mappings if needed
};

function buildCondition(cond) {
  const ops = {
    eq: Op.eq,
    ne: Op.ne,
    like: Op.like,
    notLike: Op.notLike,
    gt: Op.gt,
    gte: Op.gte,
    lt: Op.lt,
    lte: Op.lte,
    in: Op.in,
    notIn: Op.notIn,
    is: Op.eq,
    isNot: Op.ne,
    isEmpty: Op.is,
    isNotEmpty: Op.not,
  };

  let operator = cond.operator;
  if (operatorMap[operator]) {
    operator = operatorMap[operator];
  }

  // Handle "is empty" and "is not empty"
  if (operator === "is empty") {
    return { [cond.field]: { [Op.is]: null } };
  }
  if (operator === "is not empty") {
    return { [cond.field]: { [Op.not]: null, [Op.ne]: "" } };
  }

  // Handle date fields
  const leadDateFields = Object.entries(Deal.rawAttributes)
  .filter(([_, attr]) => attr.type && attr.type.key === 'DATE')
  .map(([key]) => key);

const DealDetailsDateFields = Object.entries(DealDetails.rawAttributes)
  .filter(([_, attr]) => attr.type && attr.type.key === 'DATE')
  .map(([key]) => key);

const allDateFields = [...leadDateFields, ...DealDetailsDateFields];

  if (allDateFields.includes(cond.field)) {
    if (cond.useExactDate) {
      const date = new Date(cond.value);
      if (isNaN(date.getTime())) return {};
      return {
        [cond.field]: {
          [ops[operator] || Op.eq]: date,
        },
      };
    }
    // Otherwise, use relative date conversion
    const dateRange = convertRelativeDate(cond.value);
    const isValidDate = d => d instanceof Date && !isNaN(d.getTime());

    if (dateRange && isValidDate(dateRange.start) && isValidDate(dateRange.end)) {
      return {
        [cond.field]: {
          [Op.between]: [dateRange.start, dateRange.end],
        },
      };
    }
    if (dateRange && isValidDate(dateRange.start)) {
      return {
        [cond.field]: {
          [ops[operator] || Op.eq]: dateRange.start,
        },
      };
    }
    return {};
  }

  // Default
  return {
    [cond.field]: {
      [ops[operator] || Op.eq]: cond.value,
    },
  };
}


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
      await logAuditTrail(
        getProgramId("DEALS"),
        "DEAL_UPDATE",
        req.role,
        `Deal update failed: Deal with ID ${dealId} not found.`,
        req.adminId
      );
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
    // After all updates and before sending the response:
const updatedDeal = await Deal.findByPk(dealId, {
  include: [
    { model: DealDetails, as: "details" },
    { model: Person, as: "Person" },
    { model: Organization, as: "Organization" }
  ]
});

// Calculate pipeline stage days
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
const pipelineOrder = [
  "Qualified",
  "Contact Made",
  "Proposal Made",
  "Negotiations Started"
];

const stageDaysMap = new Map();
for (const stage of pipelineStages) {
  if (!stageDaysMap.has(stage.stageName)) {
    stageDaysMap.set(stage.stageName, stage.days);
  } else {
    stageDaysMap.set(stage.stageName, stageDaysMap.get(stage.stageName) + stage.days);
  }
}

let currentStageName = pipelineStages.length
  ? pipelineStages[pipelineStages.length - 1].stageName
  : null;

let pipelineStagesUnique = [];
if (currentStageName && pipelineOrder.includes(currentStageName)) {
  const currentIdx = pipelineOrder.indexOf(currentStageName);
  pipelineStagesUnique = pipelineOrder.slice(0, currentIdx + 1).map(stageName => ({
    stageName,
    days: stageDaysMap.get(stageName) || 0
  }));
}

    //res.status(200).json({ message: "Deal, person, and organization updated successfully",deal });
    await historyLogger(
      getProgramId("DEALS"),
      "DEAL_UPDATE",
      req.adminId,
      deal.dealId,
      null,
      `Deal updated by ${req.role}`,
      null
    );
    res.status(200).json({
  message: "Deal, person, and organization updated successfully",
  deal: updatedDeal,
  person: updatedDeal.Person ? [updatedDeal.Person] : [],
  organization: updatedDeal.Organization ? [updatedDeal.Organization] : [],
  pipelineStages: pipelineStagesUnique,
  currentStage: currentStageName
});
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

    //     // --- Pipeline stage days calculation ---
    // const stageHistory = await DealStageHistory.findAll({
    //   where: { dealId },
    //   order: [['enteredAt', 'ASC']]
    // });

    // const now = new Date();
    // const pipelineStages = [];

    // for (let i = 0; i < stageHistory.length; i++) {
    //   const stage = stageHistory[i];
    //   const nextStage = stageHistory[i + 1];
    //   const start = new Date(stage.enteredAt);
    //   const end = nextStage ? new Date(nextStage.enteredAt) : now;
    //   const days = Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
    //   pipelineStages.push({
    //     stageName: stage.stageName,
    //     days
    //   });
    // }
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
// Aggregate days per unique stage for frontend bar
// After building pipelineStages (with possible repeats)
const stageDaysMap = new Map();
const orderedStages = [];
let currentStageName = pipelineStages.length
  ? pipelineStages[pipelineStages.length - 1].stageName
  : null;

for (const stage of pipelineStages) {
  if (!stageDaysMap.has(stage.stageName)) {
    orderedStages.push(stage.stageName);
    stageDaysMap.set(stage.stageName, stage.days);
  } else {
    stageDaysMap.set(stage.stageName, stageDaysMap.get(stage.stageName) + stage.days);
  }
  // Stop if we've reached the current stage
  if (stage.stageName === currentStageName) break;
}

// Build the array for the bar (only up to and including current stage)
// const pipelineStagesUnique = orderedStages.map(stageName => ({
//   stageName,
//   days: stageDaysMap.get(stageName) || 0
// }));
// Define your pipeline order
const pipelineOrder = [
  "Qualified",
  "Contact Made",
  "Proposal Made",
  "Negotiations Started"
];

let pipelineStagesUnique = [];
if (currentStageName && pipelineOrder.includes(currentStageName)) {
  const currentIdx = pipelineOrder.indexOf(currentStageName);
  // Always include all stages from "Qualified" up to and including the current stage
  pipelineStagesUnique = pipelineOrder.slice(0, currentIdx + 1).map(stageName => ({
    stageName,
    days: stageDaysMap.get(stageName) || 0
  }));
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
      rfpReceivedDate: deal.details?.rfpReceivedDate,
      wonTime:deal.details?.wonTime,
      lostTime: deal.details?.lostTime,
      lostReason: deal.details?.lostReason,
      // ...other deal fields
    };
// Fetch participants for this deal
const participants = await DealParticipant.findAll({
  where: { dealId },
  include: [
    { model: Person, as: "Person", attributes: ["personId", "contactPerson", "email"] },
    { model: Organization, as: "Organization", attributes: ["leadOrganizationId", "organization","masterUserID"] }
  ]
});
const participantArr = await Promise.all(participants.map(async p => {
  const person = p.Person;
  const organization = p.Organization;

  let closedDeals = 0, openDeals = 0, ownerName = null;

  if (person) {
    closedDeals = await Deal.count({ where: { personId: person.personId, status: "won" } });
    openDeals = await Deal.count({ where: { personId: person.personId, status: "open" } });
console.log("Person found:", person.contactPerson, "Closed Deals:", closedDeals, "Open Deals:", openDeals);

    // Use ownerId or masterUserID from organization
    console.log(organization.masterUserID, " organization masterUserID");
    console.log(organization, " organization");
    
    
    let ownerIdToUse = organization
      ? (organization.ownerId || organization.masterUserID)
      : null;
console.log(ownerIdToUse, " ownerIdToUse");

    if (ownerIdToUse) {
      const owner = await MasterUser.findOne({ where: { masterUserID: ownerIdToUse } });
      ownerName = owner ? owner.name : null;
    }
  }

  return {
    name: person ? person.contactPerson : null,
    organization: organization ? organization.organization : null,
    email: person ? person.email : null,
    phone: person ? person.phone : null,
    closedDeals,
    openDeals,
    owner: ownerName
  };
}));
// Fetch emails linked to this deal
const emailsByDeal = await Email.findAll({ where: { dealId } });
let emailsByAddress = [];
if (deal.email) {
  emailsByAddress = await Email.findAll({
    where: {
      [Op.or]: [
        { sender: deal.email },
        { recipient: { [Op.like]: `%${deal.email}%` } },
      ],
    },
  });
}
  // Merge and deduplicate emails
    const allEmailsMap = new Map();
    emailsByDeal.forEach((email) => allEmailsMap.set(email.emailID, email));
    emailsByAddress.forEach((email) => allEmailsMap.set(email.emailID, email));
    const allEmails = Array.from(allEmailsMap.values());

    // Fetch all attachments for these emails
    const emailIDs = allEmails.map((email) => email.emailID);
    let files = [];
    if (emailIDs.length > 0) {
      files = await Attachment.findAll({
        where: { emailID: emailIDs },
      });
      // Optionally, attach email info to each file
      const emailMap = new Map();
      allEmails.forEach((email) => emailMap.set(email.emailID, email));
      files = files.map((file) => ({
        ...file.toJSON(),
        email: emailMap.get(file.emailID) || null,
      }));
    }

    // Fetch notes for this deal
    const notes = await DealNote.findAll({ where: { dealId } });
    // Fetch activities for this deal
    const activities = await Activity.findAll({
      where: { dealId },
      order: [["startDateTime", "DESC"]]
    });
    res.status(200).json({
      deal: dealObj,
      person: personArr,
      organization: orgArr,
            //pipelineStages, // [{ stageName: 'Qualified', days: 216 }, ...]
      pipelineStages: pipelineStagesUnique, // Use unique stages with aggregated days
      currentStage: pipelineStages[pipelineStages.length - 1]?.stageName || deal.pipelineStage,
      overview: {
        dealAge,
        avgTimeToWon,
        inactiveDays,
        createdAt
      },
      participants:participantArr,
      emails: allEmails,
      notes,
      activities
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
exports.linkParticipant = async (req, res) => {
  try {
    const { dealId } = req.params;
    const { personId } = req.body;

    // Require at least personId
    if (!dealId || !personId) {
      return res.status(400).json({ message: "dealId and personId are required." });
    }

    // Optionally, check if participant already linked
    const exists = await DealParticipant.findOne({
      where: { dealId, personId }
    });
    if (exists) {
      return res.status(409).json({ message: "Participant already linked to this deal." });
    }

    const participant = await DealParticipant.create({
      dealId,
      personId
    });

    res.status(201).json({ message: "Participant linked successfully.", participant });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};


exports.createNote = async (req, res) => {
  try {
    const { dealId } = req.params;
    const { content } = req.body;
    const createdBy = req.user?.masterUserID || req.adminId; // Adjust as per your auth

    if (!content) {
      return res.status(400).json({ message: "Note content is required." });
    }

    const note = await DealNote.create({
      dealId,
      content,
      createdBy
    });

    res.status(201).json({ message: "Note created successfully.", note });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getNotes = async (req, res) => {
  try {
    const { dealId } = req.params;
    const notes = await DealNote.findAll({
      where: { dealId },
      order: [["createdAt", "DESC"]]
    });
    res.status(200).json({ notes });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};


exports.saveAllDealFieldsWithCheck = async (req, res) => {
  // Get all field names from Deal and DealDetails models
  const dealFields = Object.keys(Deal.rawAttributes);
  const dealDetailsFields = DealDetails
    ? Object.keys(DealDetails.rawAttributes)
    : [];
  const allFieldNames = Array.from(
    new Set([...dealFields, ...dealDetailsFields])
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
    let pref = await DealColumnPreference.findOne();
    if (!pref) {
      // Create the record if it doesn't exist
      pref = await DealColumnPreference.create({ columns: columnsToSave });
    } else {
      // Update the existing record
      pref.columns = columnsToSave;
      await pref.save();
    }
    res.status(200).json({ message: "All deal columns saved", columns: pref.columns });
  } catch (error) {
    console.log("Error saving all deal columns:", error);
    res.status(500).json({ message: "Error saving all deal columns" });
  }
};
exports.getDealFields = (req, res) => {
  const fields = [
    { key: "contactPerson", label: "Contact Person", check: false },
    { key: "organization", label: "Organization", check: false },
    { key: "title", label: "Title", check: false },
    { key: "value", label: "Value", check: false },
    { key: "currency", label: "Currency", check: false },
    { key: "pipeline", label: "Pipeline", check: false },
    { key: "pipelineStage", label: "Pipeline Stage", check: false },
    { key: "label", label: "Label", check: false },
    { key: "expectedCloseDate", label: "Expected Close Date", check: false },
    { key: "sourceChannel", label: "Source Channel", check: false },
    { key: "serviceType", label: "Service Type", check: false },
    { key: "proposalValue", label: "Proposal Value", check: false },
    { key: "proposalCurrency", label: "Proposal Currency", check: false },
    { key: "esplProposalNo", label: "ESPL Proposal No.", check: false },
    { key: "projectLocation", label: "Country of Project Location", check: false },
    { key: "organizationCountry", label: "Organization Country", check: false },
    { key: "proposalSentDate", label: "Proposal Sent Date", check: false },
    { key: "sourceRequired", label: "Source Required", check: false },
    { key: "questionerShared", label: "Questioner Shared", check: false },
    { key: "sectorialSector", label: "Sectorial Sector", check: false },
    { key: "sbuClass", label: "SBU Class", check: false },
    { key: "phone", label: "Phone", check: false },
    { key: "email", label: "Email", check: false },
    { key: "sourceOrgin", label: "Source Origin", check: false },
    { key: "isArchived", label: "Is Archived", check: false },
    { key: "status", label: "Status", check: false },
    { key: "createdAt", label: "Deal Created", check: false },
    { key: "updatedAt", label: "Updated At", check: false },
    { key: "statusSummary", label: "Status Summary", check: false },
    { key: "responsiblePerson", label: "Responsible Person", check: false },
    { key: "rfpReceivedDate", label: "RFP Received Date", check: false },
    {key:"owner",label:"Owner",check:false},
    {key:"wonTime",label:"Won Time",check:false},
    {key:"lostTime",label:"Lost Time",check:false},
    {key:"scopeOfServiceType", label: "Scope of Service Type", check: false},
    {key:"countryOfOrganizationCountry", label: "Country of Organization Country", check: false},
    {key:"source",label:"Source",check:false},
    {key:"lostReason",label:"Lost Reason",check:false},
    {key:"status", label: "Status", check: false},
    {key:"dealClosedOn", label: "Deal Closed On", check: false},
    {key:"nextActivityDate", label: "Next Activity Date", check: false},
    {key:"stateAndCountryProjectLocation", label: "State/Country of Project Location", check: false},
  ];

  res.status(200).json({ fields });
};
exports.updateDealColumnChecks = async (req, res) => {
  // Expecting: { columns: [ { key: "columnName", check: true/false }, ... ] }
  const { columns } = req.body;

  if (!Array.isArray(columns)) {
    return res.status(400).json({ message: "Columns array is required." });
  }

  try {
    // Find the global DealColumnPreference record
    let pref = await DealColumnPreference.findOne();
    if (!pref) {
      return res.status(404).json({ message: "Preferences not found."});
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

exports.markDealAsWon = async (req, res) => {
  try {
    const { dealId } = req.params;

    const deal = await Deal.findByPk(dealId);
    if (!deal) {
      return res.status(404).json({ message: "Deal not found." });
    }

    // Update status to 'won'
    await deal.update({ status: 'won' });

    // Update DealDetails: wonTime and dealClosedOn
    const now = new Date();
    let dealDetails = await DealDetails.findOne({ where: { dealId } });
    if (dealDetails) {
      await dealDetails.update({
        wonTime: now,
        dealClosedOn: now
      });
    } else {
      await DealDetails.create({
        dealId,
        wonTime: now,
        dealClosedOn: now
      });
    }

    // Add a new entry to DealStageHistory
    await DealStageHistory.create({
      dealId,
      stageName: deal.pipelineStage, // keep current stage
      enteredAt: now,
      note: 'Marked as won'
    });

    res.status(200).json({ message: "Deal marked as won", deal });
  } catch (error) {
    console.log(error);
    
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.markDealAsLost = async (req, res) => {
  try {
    const { dealId } = req.params;
    const { lostReason } = req.body; // Accept lostReason from request body

    const deal = await Deal.findByPk(dealId);
    if (!deal) {
      return res.status(404).json({ message: "Deal not found." });
    }

    await deal.update({ status: 'lost' });

    // Update DealDetails: lostTime and lostReason
    const now = new Date();
    let dealDetails = await DealDetails.findOne({ where: { dealId } });
    if (dealDetails) {
      await dealDetails.update({
        lostTime: now,
        lostReason: lostReason || dealDetails.lostReason
      });
    } else {
      await DealDetails.create({
        dealId,
        lostTime: now,
        lostReason: lostReason || null
      });
    }

    res.status(200).json({ message: "Deal marked as lost", deal });
  } catch (error) {
    console.log(error);
    
    res.status(500).json({ message: "Internal server error" });
  }
}

exports.markDealAsOpen = async (req, res) => {
  try {
    const { dealId } = req.params;
    const initialStage = 'Qualified'; // Set your initial pipeline stage here

    const deal = await Deal.findByPk(dealId);
    if (!deal) {
      return res.status(404).json({ message: "Deal not found." });
    }

    // Update deal status and reset pipelineStage
    await deal.update({ status: 'open', pipelineStage: initialStage });

    // Reset closure fields in DealDetails
    let dealDetails = await DealDetails.findOne({ where: { dealId } });
    if (dealDetails) {
      await dealDetails.update({
        wonTime: null,
        lostTime: null,
        dealClosedOn: null,
        lostReason: null
      });
    }

    // Add a new entry to DealStageHistory to track reopening
    await DealStageHistory.create({
      dealId,
      stageName: initialStage,
      enteredAt: new Date()
    });

    res.status(200).json({ message: "Deal marked as open", deal });
  } catch (error) {
    console.log(error);
    
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.getDealFieldsForFilter = (req, res) => {
  const fields = [
    { value: "dealId", label: "Deal ID" },
    { value: "title", label: "Title" },
    { value: "value", label: "Value" },
    { value: "pipeline", label: "Pipeline" },
    { value: "pipelineStage", label: "Pipeline Stage" },
    { value: "status", label: "Status" },
    { value: "expectedCloseDate", label: "Expected Close Date" },
    { value: "serviceType", label: "Service Type" },
    { value: "scopeOfServiceType", label: "Scope of Service Type" },
    { value: "proposalValue", label: "Proposal Value" },
    { value: "esplProposalNo", label: "ESPL Proposal No." },
    { value: "projectLocation", label: "Project Location" },
    { value: "organizationCountry", label: "Organization Country" },
    { value: "proposalSentDate", label: "Proposal Sent Date" },
    { value: "ownerId", label: "Owner" },
    { value: "createdAt", label: "Deal Created" },
    { value: "updatedAt", label: "Last Updated" },
    { value: "masterUserID", label: "Creator" },
    { value: "currency", label: "Currency" },
    { value: "nextActivityDate", label: "Next Activity Date" },
    { value: "responsiblePerson", label: "Responsible Person" },
    { value: "rfpReceivedDate", label: "RFP Received Date" },
    { value: "statusSummary", label: "Status Summary" },
    { value: "wonTime", label: "Won Time" },
    { value: "lostTime", label: "Lost Time" },
    { value: "dealClosedOn", label: "Deal Closed On" },
    { value: "lostReason", label: "Lost Reason" },
    { value: "stateAndCountryProjectLocation", label: "State and Country Project Location" },
    { value: "visibleTo", label: "Visible To" },
    { value: "archiveTime", label: "Archive Time" },
    // ...add more as needed
  ];
  res.status(200).json({ fields });
}