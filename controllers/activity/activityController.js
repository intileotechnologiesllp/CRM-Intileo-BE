const Activity = require("../../models/activity/activityModel");
const { Op } = require("sequelize");
const moment = require("moment"); // or use JS Date
const { convertRelativeDate } = require("../../utils/helper"); // Import the utility to convert relative dates
const Person = require("../../models/leads/leadPersonModel");
const Organizations = require("../../models/leads/leadOrganizationModel");
const LeadFilter = require("../../models/leads/leadFiltersModel");
const ActivityColumnPreference = require("../../models/activity/activityColumnModel"); // Adjust path as needed
const Lead = require("../../models/leads/leadsModel");
const LeadDetails = require("../../models/leads/leadDetailsModel");
const Deal = require("../../models/deals/dealsModels");
const DealDetails = require("../../models/deals/dealsDetailModel");
const DealColumn = require("../../models/deals/dealColumnModel");
const sequelize = require("../../config/db");
const CustomFieldValue = require("../../models/customFieldValueModel");
const CustomField = require("../../models/customFieldModel");
//const Organizations = require("../../models/leads/leadOrganizationModel"); // Adjust path as needed

exports.createActivity = async (req, res) => {
  try {
    const {
      type,
      subject,
      startDateTime,
      endDateTime,
      priority,
      guests,
      location,
      videoCallIntegration,
      description,
      status,
      notes,
      assignedTo,
      dealId,
      leadId,
      personId,
      leadOrganizationId,
      isDone,
      activityTypeFlag
    } = req.body;
    // Fetch contact person details
    let contactPerson = null;
    let email = null;
    if (personId) {
      const person = await Person.findByPk(personId);
      if (person) {
        contactPerson = person.contactPerson;
        email = person.email;
        console.log(
          person.contactPerson,
          person.email,
          "Contact Person and Email fetched in inside createActivity"
        );
      }
    }
    console.log(contactPerson, email, "Contact Person and Email fetched");

    // Fetch organization details
    let organization = null;
    if (leadOrganizationId) {
      const org = await Organizations.findByPk(leadOrganizationId);
      if (org) {
        organization = org.organization;
      }
      console.log(
        org.organization,
        "Organization fetched inside createActivity"
      );
    }
    console.log(organization, "Organization fetched");

    // If guests is an array, convert to string for storage
    const guestsValue = Array.isArray(guests) ? JSON.stringify(guests) : guests;
    const activity = await Activity.create({
      type,
      subject,
      startDateTime,
      endDateTime,
      priority,
      guests: guestsValue,
      location,
      videoCallIntegration,
      description,
      status,
      notes,
      assignedTo,
      dealId,
      leadId,
      personId,
      leadOrganizationId,
      isDone,
      masterUserID: req.adminId, // Assuming adminId is the masterUserID
      contactPerson,
      email,
      organization,
      dueDate: endDateTime,
      activityTypeFlag
    });

    // Update nextActivity in Lead if leadId is present
    if (leadId) {
      await updateNextActivityForLead(leadId);
    }

    // Update nextActivity in Deal if dealId is present
    if (dealId) {
      await updateNextActivityForDeal(dealId);
    }

    res
      .status(201)
      .json({ message: "Activity created successfully", activity });
  } catch (error) {
    console.error("Error creating activity:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getActivities = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 100,
      search = "",
      type,
      assignedTo,
      isDone,
      personId,
      leadOrganizationId,
      dealId,
      leadId,
      dateFilter,
      filterId,
      startDate,
      endDate,
      priority,
      status,
      masterUserID
    } = req.query;

    let { entityType } = req.query; // Extract entityType from query parameters

    const pref = await ActivityColumnPreference.findOne();
    let attributes = [];
    let dealColumns = [];
    let hasDealColumns = false;
    
    if (pref) {
      const columns =
        typeof pref.columns === "string"
          ? JSON.parse(pref.columns)
          : pref.columns;
      
      const activityFields = Object.keys(Activity.rawAttributes);
      const dealFields = Object.keys(Deal.rawAttributes);
      
      // Filter Activity columns that are checked
      columns
        .filter((col) => col.check && col.entityType === 'Activity' && activityFields.includes(col.key))
        .forEach((col) => {
          attributes.push(col.key);
        });
      
      // Filter Deal columns that are checked
      columns
        .filter((col) => col.check && col.entityType === 'Deal' && dealFields.includes(col.key))
        .forEach((col) => {
          dealColumns.push(col.key);
          hasDealColumns = true;
        });
      
      if (attributes.length === 0) attributes = undefined;
    }

    const where = {};
    let filterWhere = {};

    if (filterId) {
      const filter = await LeadFilter.findByPk(filterId);
      if (!filter) {
        return res.status(404).json({ message: "Filter not found." });
      }
      const filterConfig =
        typeof filter.filterConfig === "string"
          ? JSON.parse(filter.filterConfig)
          : filter.filterConfig;

      // If entityType is not provided in query, try to infer from filterConfig
      if (!entityType) {
        // Try to get the first entity from 'all' or 'any' conditions
        if (
          filterConfig.all &&
          filterConfig.all.length > 0 &&
          filterConfig.all[0].entity
        ) {
          entityType = filterConfig.all[0].entity;
        } else if (
          filterConfig.any &&
          filterConfig.any.length > 0 &&
          filterConfig.any[0].entity
        ) {
          entityType = filterConfig.any[0].entity;
        }
      }

      const { all = [], any = [] } = filterConfig;
      const activityFields = Object.keys(Activity.rawAttributes);
      console.log(activityFields, "Activity Fields in getActivities");

      if (all.length > 0) {
        filterWhere[Op.and] = [];
        all.forEach((cond) => {
          if (cond.entity === "Lead" && cond.field === "title") {
            filterWhere[Op.and].push({
              "$ActivityLead.title$": { [Op.eq]: cond.value },
            });
          } else if (cond.entity === "Deal" && cond.field === "title") {
            filterWhere[Op.and].push({
              "$ActivityDeal.title$": { [Op.eq]: cond.value },
            });
          } else if (cond.entity === "Person") {
            filterWhere[Op.and].push({
              [`$ActivityPerson.${cond.field}$`]: { [Op.eq]: cond.value },
            });
          } else if (cond.entity === "Organization") {
            filterWhere[Op.and].push({
              [`$ActivityOrganization.${cond.field}$`]: { [Op.eq]: cond.value },
            });
          } else if (activityFields.includes(cond.field)) {
            const condition = buildCondition(cond);
            if (condition && Object.keys(condition).length > 0) {
              filterWhere[Op.and].push(condition);
            }
          }
        });
        if (filterWhere[Op.and].length === 0) delete filterWhere[Op.and];
      }

      if (any.length > 0) {
        filterWhere[Op.or] = [];
        any.forEach((cond) => {
          if (cond.entity === "Lead" && cond.field === "title") {
            filterWhere[Op.or].push({
              "$ActivityLead.title$": { [Op.eq]: cond.value },
            });
          } else if (cond.entity === "Deal" && cond.field === "title") {
            filterWhere[Op.or].push({
              "$ActivityDeal.title$": { [Op.eq]: cond.value },
            });
          } else if (cond.entity === "Person") {
            filterWhere[Op.or].push({
              [`$ActivityPerson.${cond.field}$`]: { [Op.eq]: cond.value },
            });
          } else if (cond.entity === "Organization") {
            filterWhere[Op.or].push({
              [`$ActivityOrganization.${cond.field}$`]: { [Op.eq]: cond.value },
            });
          } else if (activityFields.includes(cond.field)) {
            const condition = buildCondition(cond);
            if (condition && Object.keys(condition).length > 0) {
              filterWhere[Op.or].push(condition);
            }
          }
        });
        if (filterWhere[Op.or].length === 0) delete filterWhere[Op.or];
      }
    }

    const now = moment().startOf("day");
    switch (dateFilter) {
      case "overdue":
        where.startDateTime = { [Op.lt]: now.toDate() };
        where.isDone = false;
        if (assignedTo) where.assignedTo = assignedTo;
        break;
      case "today":
        where.dueDate = {
          [Op.gte]: now.toDate(),
          [Op.lt]: moment(now).add(1, "day").toDate(),
        };
        if (assignedTo) where.assignedTo = assignedTo;
        break;
      case "tomorrow":
        where.startDateTime = {
          [Op.gte]: moment(now).add(1, "day").toDate(),
          [Op.lt]: moment(now).add(2, "day").toDate(),
        };
        if (assignedTo) where.assignedTo = assignedTo;
        break;
      case "this_week":
        // Calculate current week Monday to Sunday
        const today = moment(now);
        const startOfWeek = today.clone().isoWeekday(1).startOf('day'); // Monday
        const endOfWeek = today.clone().isoWeekday(7).endOf('day'); // Sunday
        
        where.dueDate = {
          [Op.gte]: startOfWeek.toDate(),
          [Op.lt]: endOfWeek.toDate(),
        };
        if (assignedTo) where.assignedTo = assignedTo;
        break;
      case "next_week":
        // Calculate next week Monday to Sunday
        const nextWeekStart = moment(now).isoWeekday(1).add(1, 'week').startOf('day'); // Next Monday
        const nextWeekEnd = moment(now).isoWeekday(1).add(2, 'week').startOf('day'); // Monday after next week
        
        where.dueDate = {
          [Op.gte]: nextWeekStart.toDate(),
          [Op.lt]: nextWeekEnd.toDate(),
        };
        if (assignedTo) where.assignedTo = assignedTo;
        break;
      case "select_period":
        if (startDate && endDate) {
          where.startDateTime = {
            [Op.gte]: new Date(startDate),
            [Op.lte]: new Date(endDate),
          };
        }
        break;
      case "To-do":
        where.isDone = false;
        if (assignedTo) where.assignedTo = assignedTo;
        break;
      default:
        break;
    }

    if (search) {
      where[Op.or] = [
        { subject: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }
    if (type) {
      // Handle multiple types in different formats:
      // 1. Multiple query params: ?type=Meeting&type=Task
      // 2. Comma-separated string: ?type=Meeting,Task
      // 3. Single type: ?type=Meeting
      if (Array.isArray(type)) {
        // Multiple query parameters (?type=Meeting&type=Task) - Express automatically creates array
        where.type = { [Op.in]: type };
      } else if (typeof type === 'string' && type.includes(',')) {
        // Comma-separated string (?type=Meeting,Task)
        const typeArray = type.split(',').map(t => t.trim()).filter(t => t);
        where.type = { [Op.in]: typeArray };
      } else {
        // Single type (?type=Meeting)
        where.type = type;
      }
    }
    if (typeof isDone !== "undefined") where.isDone = isDone === "true";
    if (personId) where.personId = personId;
    if (leadOrganizationId) where.leadOrganizationId = leadOrganizationId;
    if (dealId) where.dealId = dealId;
    if (leadId) where.leadId = leadId;
    if (assignedTo) where.assignedTo = assignedTo;

    // Handle masterUserID filtering
    if (masterUserID) {
      // If a specific masterUserID is provided, filter by that user
      where.masterUserID = masterUserID;
    } else if (req.role !== "admin") {
      // Only apply role-based restrictions if no specific masterUserID is requested
      where[Op.or] = [
        { masterUserID: req.adminId },
        { assignedTo: req.adminId },
      ];
    }

    const finalWhere = { ...filterWhere, ...where };
    console.log(JSON.stringify(finalWhere, null, 2));
    const alwaysInclude = [
      "dealId",
      "leadId",
      // "assignedTo",
      "leadOrganizationId",
      "personId",
      "activityId",
      // "type",
      "startDateTime",
      "endDateTime",
      "activityTypeFlag"
      // "priority",
      // "status"
    ];
    if (attributes) {
      alwaysInclude.forEach((field) => {
        if (!attributes.includes(field)) attributes.push(field);
      });
    }
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { rows: activities, count: total } = await Activity.findAndCountAll({
      where: finalWhere,
      limit: parseInt(limit),
      offset,
      order: [["startDateTime", "DESC"]],
      attributes,
      include: [
        {
          model: Lead,
          as: "ActivityLead", // Use the alias here
          attributes: Object.keys(Lead.rawAttributes),
          required: entityType === "Lead", // Apply filter only for Lead
          where:
            entityType === "Lead" && (filterWhere[Op.and] || filterWhere[Op.or])
              ? filterWhere
              : undefined,
        },
        {
          model: Deal,
          as: "ActivityDeal", // Use the alias here
          attributes: hasDealColumns ? dealColumns : ["dealId"], // Include checked Deal columns or default
          required: entityType === "Deal", // Apply filter only for Deal entity type
          where:
            entityType === "Deal" &&
            Object.keys(filterWhere).length > 0 &&
            filterWhere[Op.and]
              ? filterWhere
              : undefined,
        },
        {
          model: Organizations,
          as: "ActivityOrganization",
          attributes: Object.keys(Organizations.rawAttributes),
          required: entityType === "Organization", // Apply filter only for Organization
          where:
            entityType === "Organization" &&
            (filterWhere[Op.and] || filterWhere[Op.or])
              ? filterWhere
              : undefined,
        },
        {
          model: Person,
          as: "ActivityPerson",
          attributes: Object.keys(Person.rawAttributes),
          required: entityType === "Person", // Apply filter only for Person
          where:
            entityType === "Person" &&
            (filterWhere[Op.and] || filterWhere[Op.or])
              ? filterWhere
              : undefined,
        },
      ],
    });

    // Fetch available custom fields to ensure we show columns even if no values exist
    let availableCustomFields = {
      activity: [],
      lead: [],
      deal: [],
      person: [],
      organization: []
    };

    // Get checked custom field names from ActivityColumnPreference
    const checkedCustomFields = {
      activity: [],
      lead: [],
      deal: [],
      person: [],
      organization: []
    };

    if (pref && pref.columns) {
      const columns = typeof pref.columns === "string" ? JSON.parse(pref.columns) : pref.columns;
      
      // Filter custom field columns that are checked
      columns.forEach(column => {
        // Check if this is a custom field column (has isCustomField property)
        if (column.check && column.isCustomField && column.key) {
          const entityType = column.entityType ? column.entityType.toLowerCase() : null;
          const fieldName = column.key;
          
          if (checkedCustomFields[entityType]) {
            checkedCustomFields[entityType].push(fieldName);
          }
        }
      });
    }

    console.log("Checked custom fields from ActivityColumnPreference:", checkedCustomFields);

    // Get all available custom fields for each entity type, but filter by checked status from ActivityColumnPreference
    const customFieldPromises = [
      // Skip activity custom fields - we don't show them even if check=true
      
      CustomField.findAll({
        where: { 
          entityType: { [Op.in]: ['lead', 'both'] }, 
          isActive: true
        },
        attributes: ['fieldId', 'fieldName', 'fieldLabel', 'fieldType']
      }).then(fields => ({ 
        type: 'lead', 
        fields: fields.filter(field => checkedCustomFields.lead.includes(field.fieldName))
      })),
      
      // For deal custom fields, we need to check both 'deal' and 'lead' entityTypes
      // because some fields might be stored as 'lead' but used for deals
      CustomField.findAll({
        where: { 
          entityType: { [Op.in]: ['deal', 'both', 'lead'] }, 
          isActive: true
        },
        attributes: ['fieldId', 'fieldName', 'fieldLabel', 'fieldType']
      }).then(fields => ({ 
        type: 'deal', 
        fields: fields.filter(field => checkedCustomFields.deal.includes(field.fieldName))
      })),
      
      CustomField.findAll({
        where: { 
          entityType: { [Op.in]: ['person', 'both'] }, 
          isActive: true
        },
        attributes: ['fieldId', 'fieldName', 'fieldLabel', 'fieldType']
      }).then(fields => ({ 
        type: 'person', 
        fields: fields.filter(field => checkedCustomFields.person.includes(field.fieldName))
      })),
      
      CustomField.findAll({
        where: { 
          entityType: { [Op.in]: ['organization', 'both'] }, 
          isActive: true
        },
        attributes: ['fieldId', 'fieldName', 'fieldLabel', 'fieldType']
      }).then(fields => ({ 
        type: 'organization', 
        fields: fields.filter(field => checkedCustomFields.organization.includes(field.fieldName))
      }))
    ];

    const customFieldResults = await Promise.all(customFieldPromises);
    
    // Store available custom fields
    customFieldResults.forEach(result => {
      availableCustomFields[result.type] = result.fields;
    });

    console.log("Available checked custom fields from ActivityColumnPreference:", {
      activity: availableCustomFields.activity.map(f => f.fieldName),
      lead: availableCustomFields.lead.map(f => f.fieldName),
      deal: availableCustomFields.deal.map(f => f.fieldName),
      person: availableCustomFields.person.map(f => f.fieldName),
      organization: availableCustomFields.organization.map(f => f.fieldName)
    });

    // Debug: Check if espl_proposal_no is in the deal custom fields
    console.log("DEBUG: Deal custom fields details:", availableCustomFields.deal.map(f => ({
      fieldName: f.fieldName,
      fieldId: f.fieldId,
      fieldLabel: f.fieldLabel
    })));
    
    const esplField = availableCustomFields.deal.find(f => f.fieldName === 'espl_proposal_no');
    console.log("DEBUG: espl_proposal_no field found in deal custom fields:", esplField ? 'YES' : 'NO');
    if (esplField) {
      console.log("DEBUG: espl_proposal_no field details:", esplField);
    }

    // After getting activities, fetch custom field values for related entities
    let customFieldsByEntity = {};
    
    if (activities.length > 0) {
      // Get all related entity IDs from activities
      const leadIds = [...new Set(activities.map(a => a.leadId).filter(id => id))];
      const dealIds = [...new Set(activities.map(a => a.dealId).filter(id => id))];
      const personIds = [...new Set(activities.map(a => a.personId).filter(id => id))];
      const organizationIds = [...new Set(activities.map(a => a.leadOrganizationId).filter(id => id))];
      const activityIds = activities.map(a => a.activityId);

      console.log("Fetching custom fields for:", { leadIds: leadIds.length, dealIds: dealIds.length, personIds: personIds.length, organizationIds: organizationIds.length, activityIds: activityIds.length });

      // Fetch custom field values for all related entities in parallel
      const customFieldValuePromises = [];

      // Skip activity custom fields - we don't fetch them anymore
      // Activity custom fields
      // if (activityIds.length > 0) {
      //   customFieldValuePromises.push(
      //     CustomFieldValue.findAll({
      //       where: {
      //         entityId: { [Op.in]: activityIds.map(id => id.toString()) },
      //         entityType: 'activity',
      //         masterUserID: req.adminId
      //       },
      //       include: [{
      //         model: CustomField,
      //         as: 'CustomField',
      //         where: { isActive: true },
      //         attributes: ['fieldId', 'fieldName', 'fieldLabel', 'fieldType']
      //       }]
      //     }).then(values => ({ type: 'activity', values }))
      //   );
      // }

      // Lead custom fields
      if (leadIds.length > 0) {
        customFieldValuePromises.push(
          CustomFieldValue.findAll({
            where: {
              entityId: { [Op.in]: leadIds.map(id => id.toString()) },
              entityType: 'lead',
              masterUserID: req.adminId
            },
            include: [{
              model: CustomField,
              as: 'CustomField',
              where: { isActive: true },
              attributes: ['fieldId', 'fieldName', 'fieldLabel', 'fieldType']
            }]
          }).then(values => ({ type: 'lead', values }))
        );
      }

      // Deal custom fields
      if (dealIds.length > 0) {
        customFieldValuePromises.push(
          CustomFieldValue.findAll({
            where: {
              entityId: { [Op.in]: dealIds.map(id => id.toString()) },
              entityType: 'deal',
              masterUserID: req.adminId
            },
            include: [{
              model: CustomField,
              as: 'CustomField',
              where: { isActive: true },
              attributes: ['fieldId', 'fieldName', 'fieldLabel', 'fieldType']
            }]
          }).then(values => ({ type: 'deal', values }))
        );
      }

      // Person custom fields
      if (personIds.length > 0) {
        customFieldValuePromises.push(
          CustomFieldValue.findAll({
            where: {
              entityId: { [Op.in]: personIds.map(id => id.toString()) },
              entityType: 'person',
              masterUserID: req.adminId
            },
            include: [{
              model: CustomField,
              as: 'CustomField',
              where: { isActive: true },
              attributes: ['fieldId', 'fieldName', 'fieldLabel', 'fieldType']
            }]
          }).then(values => ({ type: 'person', values }))
        );
      }

      // Organization custom fields
      if (organizationIds.length > 0) {
        customFieldValuePromises.push(
          CustomFieldValue.findAll({
            where: {
              entityId: { [Op.in]: organizationIds.map(id => id.toString()) },
              entityType: 'organization',
              masterUserID: req.adminId
            },
            include: [{
              model: CustomField,
              as: 'CustomField',
              where: { isActive: true },
              attributes: ['fieldId', 'fieldName', 'fieldLabel', 'fieldType']
            }]
          }).then(values => ({ type: 'organization', values }))
        );
      }

      // Wait for all custom field queries to complete
      const customFieldValueResults = await Promise.all(customFieldValuePromises);
      
      // Organize custom fields by entity type and entity ID
      customFieldValueResults.forEach(result => {
        if (!customFieldsByEntity[result.type]) {
          customFieldsByEntity[result.type] = {};
        }
        
        result.values.forEach(value => {
          const entityId = value.entityId;
          if (!customFieldsByEntity[result.type][entityId]) {
            customFieldsByEntity[result.type][entityId] = {};
          }
          
          if (value.CustomField) {
            customFieldsByEntity[result.type][entityId][value.CustomField.fieldName] = {
              fieldId: value.CustomField.fieldId,
              fieldName: value.CustomField.fieldName,
              fieldLabel: value.CustomField.fieldLabel,
              fieldType: value.CustomField.fieldType,
              value: value.value
            };
          }
        });
      });

      console.log("Custom fields fetched:", {
        activity: Object.keys(customFieldsByEntity.activity || {}).length,
        lead: Object.keys(customFieldsByEntity.lead || {}).length,
        deal: Object.keys(customFieldsByEntity.deal || {}).length,
        person: Object.keys(customFieldsByEntity.person || {}).length,
        organization: Object.keys(customFieldsByEntity.organization || {}).length
      });

      // Debug: Check custom field values for deals
      console.log("DEBUG: Deal custom field values by entity ID:", customFieldsByEntity.deal || {});
      
      // Check if we have any deal custom field values at all
      const dealCustomFieldEntities = Object.keys(customFieldsByEntity.deal || {});
      console.log("DEBUG: Deal IDs with custom field values:", dealCustomFieldEntities);
      
      // Check specifically for deal ID 248 if it exists
      if (customFieldsByEntity.deal && customFieldsByEntity.deal['248']) {
        console.log("DEBUG: Custom fields for deal 248:", customFieldsByEntity.deal['248']);
      } else {
        console.log("DEBUG: No custom fields found for deal 248");
      }
    }

    const activitiesWithTitle = activities.map((activity) => {
      const data = activity.get ? activity.get({ plain: true }) : activity;
      const { ActivityLead, ActivityDeal, ActivityOrganization, ActivityPerson, ...rest } =
        data;
      let result = { ...rest };
      
      // Only add title if it's in the selected attributes or no preferences are set
      if (!attributes || attributes.includes('title')) {
        let title = null;
        if (rest.leadId && ActivityLead) {
          title = ActivityLead.title;
        } else if (rest.dealId && ActivityDeal) {
          title = ActivityDeal.title;
        }
        result.title = title;
      }
      
      // Add deal columns to ALL activities if columns are checked (show null if no deal linked)
      if (hasDealColumns && dealColumns.length > 0) {
        dealColumns.forEach(column => {
          if (rest.dealId && ActivityDeal && ActivityDeal[column] !== undefined) {
            // Activity has deal and column has value
            result[`deal_${column}`] = ActivityDeal[column];
          } else {
            // Activity has no deal or column has no value - show null
            result[`deal_${column}`] = null;
          }
        });
      }
      
      // Only add organization if it's in the selected attributes or no preferences are set
      if (!attributes || attributes.includes('organization')) {
        result.organization = ActivityOrganization
          ? ActivityOrganization.organization
          : null;
      }
      
      // Only add contactPerson if it's in the selected attributes or no preferences are set
      if (!attributes || attributes.includes('contactPerson')) {
        result.contactPerson = ActivityPerson ? ActivityPerson.contactPerson : null;
      }
      
      // Only add email if it's in the selected attributes or no preferences are set
      if (!attributes || attributes.includes('email')) {
        result.email = ActivityPerson ? ActivityPerson.email : null;
      }
      
      // Add custom fields for the activity itself (SKIP - we don't show activity custom fields)
      // availableCustomFields.activity.forEach(field => {
      //   const activityCustomFields = customFieldsByEntity.activity?.[rest.activityId.toString()] || {};
      //   result[`activity_${field.fieldName}`] = activityCustomFields[field.fieldName]?.value || null;
      // });
      
      // Add custom fields from related Lead (only if activity is linked to a lead)
      if (rest.leadId) {
        availableCustomFields.lead.forEach(field => {
          const leadCustomFields = customFieldsByEntity.lead?.[rest.leadId.toString()] || {};
          result[`lead_${field.fieldName}`] = leadCustomFields[field.fieldName]?.value || null;
        });
      }
      
      // Add custom fields from related Deal (CRITICAL: Check if dealId exists first)
      availableCustomFields.deal.forEach(field => {
        console.log(`DEBUG: Processing deal custom field ${field.fieldName} for activity ${rest.activityId}`);
        
        if (rest.dealId) {
          // Activity is linked to a deal - get actual custom field value
          const dealCustomFields = customFieldsByEntity.deal?.[rest.dealId.toString()] || {};
          result[`deal_cf_${field.fieldName}`] = dealCustomFields[field.fieldName]?.value || null;
          console.log(`Activity ${rest.activityId} has dealId ${rest.dealId} - deal_cf_${field.fieldName}: ${result[`deal_cf_${field.fieldName}`]}`);
          
          // Special debug for espl_proposal_no
          if (field.fieldName === 'espl_proposal_no') {
            console.log(`DEBUG ESPL: Activity ${rest.activityId}, Deal ${rest.dealId}`);
            console.log(`DEBUG ESPL: dealCustomFields for this deal:`, dealCustomFields);
            console.log(`DEBUG ESPL: espl_proposal_no field exists in dealCustomFields:`, !!dealCustomFields[field.fieldName]);
            if (dealCustomFields[field.fieldName]) {
              console.log(`DEBUG ESPL: espl_proposal_no value:`, dealCustomFields[field.fieldName].value);
            }
          }
        } else {
          // Activity is NOT linked to a deal - show null but keep the column
          result[`deal_cf_${field.fieldName}`] = null;
          console.log(`Activity ${rest.activityId} has no dealId - deal_cf_${field.fieldName}: null`);
        }
      });
      
      // Add custom fields from related Person (only if activity is linked to a person)
      if (rest.personId) {
        availableCustomFields.person.forEach(field => {
          const personCustomFields = customFieldsByEntity.person?.[rest.personId.toString()] || {};
          result[`person_${field.fieldName}`] = personCustomFields[field.fieldName]?.value || null;
        });
      }
      
      // Add custom fields from related Organization (only if activity is linked to an organization)
      if (rest.leadOrganizationId) {
        availableCustomFields.organization.forEach(field => {
          const orgCustomFields = customFieldsByEntity.organization?.[rest.leadOrganizationId.toString()] || {};
          result[`org_${field.fieldName}`] = orgCustomFields[field.fieldName]?.value || null;
        });
      }
      
      return result;
    });

    // Calculate overdue and upcoming counts when dateFilter is "To-do"
    let responseData = {
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      activities: activitiesWithTitle,
    };

    if (dateFilter === "To-do") {
      try {
        const now = moment().startOf("day");
        
        // Build base where condition for counts (same permission logic as main query)
        let baseCountWhere = { isDone: false };
        
        // Apply same permission logic as main query
        if (masterUserID) {
          baseCountWhere.masterUserID = masterUserID;
        } else if (req.role !== "admin") {
          baseCountWhere[Op.or] = [
            { masterUserID: req.adminId },
            { assignedTo: req.adminId }
          ];
        }
        
        // Apply additional filters if provided (same as main query)
        if (assignedTo) baseCountWhere.assignedTo = assignedTo;
        if (personId) baseCountWhere.personId = personId;
        if (leadOrganizationId) baseCountWhere.leadOrganizationId = leadOrganizationId;
        if (dealId) baseCountWhere.dealId = dealId;
        if (leadId) baseCountWhere.leadId = leadId;
        
        // Handle activity type filter
        if (type) {
          if (Array.isArray(type)) {
            baseCountWhere.type = { [Op.in]: type };
          } else if (typeof type === 'string' && type.includes(',')) {
            const typeArray = type.split(',').map(t => t.trim()).filter(t => t);
            baseCountWhere.type = { [Op.in]: typeArray };
          } else {
            baseCountWhere.type = type;
          }
        }
        
        // Handle search filter
        if (search) {
          baseCountWhere[Op.or] = [
            { subject: { [Op.like]: `%${search}%` } },
            { description: { [Op.like]: `%${search}%` } },
          ];
        }
        
        // Count overdue activities (startDateTime < today and not done)
        const overdueWhere = {
          ...baseCountWhere,
          startDateTime: { [Op.lt]: now.toDate() }
        };
        
        // Count upcoming activities (startDateTime >= today and not done)
        const upcomingWhere = {
          ...baseCountWhere,
          startDateTime: { [Op.gte]: now.toDate() }
        };
        
        // Execute count queries in parallel
        const [overdueResult, upcomingResult] = await Promise.all([
          Activity.count({ where: overdueWhere }),
          Activity.count({ where: upcomingWhere })
        ]);
        
        // Add counts to response
        responseData.counts = {
          overdue: overdueResult,
          upcoming: upcomingResult,
          total: overdueResult + upcomingResult
        };
        
        console.log(`To-do counts: Overdue: ${overdueResult}, Upcoming: ${upcomingResult}`);
      } catch (countError) {
        console.error("Error calculating To-do counts:", countError);
        // Continue with response even if count calculation fails
      }
    }

    res.status(200).json(responseData);
  } catch (error) {
    console.error("Error fetching activities:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getActivityById = async (req, res) => {
  try {
    const { activityId } = req.params;
    const masterUserID = req.adminId;
    const role = req.role;

    // Build the where condition based on role
    const whereCondition = { activityId: activityId };
    
    // Only include masterUserID if role is not admin
    if (role !== 'admin') {
      whereCondition[Op.or] = [
        { masterUserID: masterUserID },
        { assignedTo: masterUserID },
      ];
    }

    // Fetch the activity with all related data
    const activity = await Activity.findOne({
      where: whereCondition,
      include: [
        {
          model: Lead,
          as: "ActivityLead",
          required: false,
          attributes: ["leadId", "title", "contactPerson", "organization", "value"]
        },
        {
          model: Deal,
          as: "ActivityDeal",
          required: false,
          attributes: ["dealId", "title", "value", "currency", "status", "pipelineStage"]
        },
        {
          model: Organizations,
          as: "ActivityOrganization",
          required: false,
          attributes: ["leadOrganizationId", "organization", "address", "organizationLabels"]
        },
        {
          model: Person,
          as: "ActivityPerson",
          required: false,
          attributes: ["personId", "contactPerson", "email", "phone", "jobTitle"]
        }
      ]
    });

    if (!activity) {
      return res.status(404).json({
        message: "Activity not found or you don't have permission to view it"
      });
    }

    // Format the response
    const activityData = activity.get ? activity.get({ plain: true }) : activity;
    const { ActivityLead, ActivityDeal, ActivityOrganization, ActivityPerson, ...activityFields } = activityData;

    // Parse guests if it's a JSON string
    if (activityFields.guests && typeof activityFields.guests === 'string') {
      try {
        activityFields.guests = JSON.parse(activityFields.guests);
      } catch (e) {
        // Keep as string if parsing fails
      }
    }

    // Build the formatted response
    const formattedActivity = {
      ...activityFields,
      // Related entities data
      lead: ActivityLead ? {
        leadId: ActivityLead.leadId,
        title: ActivityLead.title,
        contactPerson: ActivityLead.contactPerson,
        organization: ActivityLead.organization,
        value: ActivityLead.value,
        // currency: ActivityLead.currency
      } : null,
      deal: ActivityDeal ? {
        dealId: ActivityDeal.dealId,
        title: ActivityDeal.title,
        value: ActivityDeal.value,
        // currency: ActivityDeal.currency,
        status: ActivityDeal.status,
        pipelineStage: ActivityDeal.pipelineStage
      } : null,
      organization: ActivityOrganization ? {
        leadOrganizationId: ActivityOrganization.leadOrganizationId,
        organization: ActivityOrganization.organization,
        address: ActivityOrganization.address,
        organizationLabels: ActivityOrganization.organizationLabels
      } : null,
      person: ActivityPerson ? {
        personId: ActivityPerson.personId,
        contactPerson: ActivityPerson.contactPerson,
        email: ActivityPerson.email,
        phone: ActivityPerson.phone,
        jobTitle: ActivityPerson.jobTitle
      } : null
    };

    // Fetch custom field values for this activity and related entities
    const customFieldPromises = [];

    // Activity custom fields
    customFieldPromises.push(
      CustomFieldValue.findAll({
        where: {
          entityId: activityId.toString(),
          entityType: 'activity',
          masterUserID: masterUserID
        },
        include: [{
          model: CustomField,
          as: 'CustomField',
          where: { isActive: true },
          attributes: ['fieldId', 'fieldName', 'fieldLabel', 'fieldType']
        }]
      }).then(values => ({ type: 'activity', values }))
    );

    // Lead custom fields (if activity is linked to a lead)
    if (ActivityLead) {
      customFieldPromises.push(
        CustomFieldValue.findAll({
          where: {
            entityId: ActivityLead.leadId.toString(),
            entityType: 'lead',
            masterUserID: masterUserID
          },
          include: [{
            model: CustomField,
            as: 'CustomField',
            where: { isActive: true },
            attributes: ['fieldId', 'fieldName', 'fieldLabel', 'fieldType']
          }]
        }).then(values => ({ type: 'lead', values }))
      );
    }

    // Deal custom fields (if activity is linked to a deal)
    if (ActivityDeal) {
      customFieldPromises.push(
        CustomFieldValue.findAll({
          where: {
            entityId: ActivityDeal.dealId.toString(),
            entityType: 'deal',
            masterUserID: masterUserID
          },
          include: [{
            model: CustomField,
            as: 'CustomField',
            where: { isActive: true },
            attributes: ['fieldId', 'fieldName', 'fieldLabel', 'fieldType']
          }]
        }).then(values => ({ type: 'deal', values }))
      );
    }

    // Person custom fields (if activity is linked to a person)
    if (ActivityPerson) {
      customFieldPromises.push(
        CustomFieldValue.findAll({
          where: {
            entityId: ActivityPerson.personId.toString(),
            entityType: 'person',
            masterUserID: masterUserID
          },
          include: [{
            model: CustomField,
            as: 'CustomField',
            where: { isActive: true },
            attributes: ['fieldId', 'fieldName', 'fieldLabel', 'fieldType']
          }]
        }).then(values => ({ type: 'person', values }))
      );
    }

    // Organization custom fields (if activity is linked to an organization)
    if (ActivityOrganization) {
      customFieldPromises.push(
        CustomFieldValue.findAll({
          where: {
            entityId: ActivityOrganization.leadOrganizationId.toString(),
            entityType: 'organization',
            masterUserID: masterUserID
          },
          include: [{
            model: CustomField,
            as: 'CustomField',
            where: { isActive: true },
            attributes: ['fieldId', 'fieldName', 'fieldLabel', 'fieldType']
          }]
        }).then(values => ({ type: 'organization', values }))
      );
    }

    // Wait for all custom field queries to complete
    const customFieldResults = await Promise.all(customFieldPromises);
    
    // Add custom fields to the response
    const customFields = {
      activity: {},
      lead: {},
      deal: {},
      person: {},
      organization: {}
    };

    customFieldResults.forEach(result => {
      result.values.forEach(value => {
        if (value.CustomField) {
          customFields[result.type][value.CustomField.fieldName] = {
            fieldId: value.CustomField.fieldId,
            fieldName: value.CustomField.fieldName,
            fieldLabel: value.CustomField.fieldLabel,
            fieldType: value.CustomField.fieldType,
            value: value.value
          };
        }
      });
    });

    // Add custom fields to the main response object
    if (Object.keys(customFields.activity).length > 0) {
      formattedActivity.activityCustomFields = customFields.activity;
    }

    if (ActivityLead && Object.keys(customFields.lead).length > 0) {
      formattedActivity.lead.customFields = customFields.lead;
      
      // Specifically add espl_proposal_no to main level if it exists
      if (customFields.lead.espl_proposal_no) {
        formattedActivity.espl_proposal_no = customFields.lead.espl_proposal_no.value;
      }
    }

    if (ActivityDeal && Object.keys(customFields.deal).length > 0) {
      formattedActivity.deal.customFields = customFields.deal;
    }

    if (ActivityPerson && Object.keys(customFields.person).length > 0) {
      formattedActivity.person.customFields = customFields.person;
    }

    if (ActivityOrganization && Object.keys(customFields.organization).length > 0) {
      formattedActivity.organization.customFields = customFields.organization;
    }

    res.status(200).json({
      message: "Activity retrieved successfully",
      activity: formattedActivity
    });

  } catch (error) {
    console.error("Error fetching activity:", error);
    res.status(500).json({ 
      message: "Internal server error",
      error: error.message 
    });
  }
};



const operatorMap = {
  is: "eq",
  "is not": "ne",
  "is empty": "is empty",
  "is not empty": "is not empty",
  "is exactly or earlier than": "lte",
  "is earlier than": "lt",
  "is exactly or later than": "gte",
  "is later than": "gt",
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
  const leadDateFields = Object.entries(Activity.rawAttributes)
    .filter(([_, attr]) => attr.type && attr.type.key === "DATE")
    .map(([key]) => key);

  // const DealDetailsDateFields = Object.entries(DealDetails.rawAttributes)
  //   .filter(([_, attr]) => attr.type && attr.type.key === 'DATE')
  //   .map(([key]) => key);

  const allDateFields = [...leadDateFields];

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
    const isValidDate = (d) => d instanceof Date && !isNaN(d.getTime());

    if (
      dateRange &&
      isValidDate(dateRange.start) &&
      isValidDate(dateRange.end)
    ) {
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




exports.deleteActivity = async (req, res) => {
  const { activityId } = req.params;
  const masterUserID = req.adminId;
  const role = req.role;
  const entityType = "activity";

  try {
    // Build the where condition based on role
    const whereCondition = { activityId : activityId };
    
    // Only include masterUserID if role is not admin
    if (role !== 'admin') {
      whereCondition.masterUserID = masterUserID;
    }

    // Check if activity exists
    const activity = await Activity.findOne({
      where: whereCondition,
    });

    if (!activity) {
      return res.status(404).json({
        message: "Activity not found.",
      });
    }

    // Start a transaction
    const transaction = await sequelize.transaction();

    try {
      // Build where condition for custom field values deletion
      const customFieldWhereCondition = {
        entityId: activityId.toString(),
        entityType,
      };
      
      // Only include masterUserID if role is not admin
      if (role !== 'admin') {
        customFieldWhereCondition.masterUserID = masterUserID;
      }

      // Delete all custom field values
      await CustomFieldValue.destroy({
        where: customFieldWhereCondition,
        transaction,
      });

      // Delete the organization
      await activity.destroy({ transaction });

      // Commit the transaction
      await transaction.commit();


      res.status(200).json({
        message: "Activity deleted successfully.",
        activityId: activityId,
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error deleting Activity:", error);
    res.status(500).json({
      message: "Failed to delete Activity.",
      error: error.message,
    });
  }
};

exports.markActivityAsDone = async (req, res) => {
  try {
    const { activityId } = req.params;

    const activity = await Activity.findByPk(activityId);
    if (!activity) {
      return res.status(404).json({ message: "Activity not found" });
    }

    activity.isDone = true;
    activity.markedAsDoneTime = new Date();
    await activity.save();

    // Update next activity date for the lead if this activity was linked to a lead
    if (activity.leadId) {
      await updateNextActivityForLead(activity.leadId);
    }

    // Update next activity date for the deal if this activity was linked to a deal
    if (activity.dealId) {
      await updateNextActivityForDeal(activity.dealId);
    }

    // --- Activity popup settings logic ---
    let showSchedulePopup = false;
    if (req.activityPopupSettings) {
      const { showPopup, showType, pipelines } = req.activityPopupSettings;
      if (showPopup) {
        if (showType === 'always') {
          showSchedulePopup = true;
        } else if (showType === 'pipelines') {
          // If you store pipelineId on the activity, use it here
          const pipelineId = activity.pipelineId || null;
          if (pipelineId && Array.isArray(pipelines)) {
            showSchedulePopup = pipelines.includes(pipelineId);
          }
        }
      }
    }

    res.status(200).json({
      message: "Activity marked as done",
      activity,
      showSchedulePopup,
    });
  } catch (error) {
    console.error("Error marking activity as done:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.updateActivity = async (req, res) => {
  try {
    const { activityId } = req.params;
    const updateFields = req.body;

    // Fetch the activity to get personId and leadOrganizationId if not provided
    const activity = await Activity.findByPk(activityId);
    if (!activity) {
      return res.status(404).json({ message: "Activity not found" });
    }

    // Use existing personId and leadOrganizationId if not provided in body
    if (!updateFields.personId) updateFields.personId = activity.personId;
    if (!updateFields.leadOrganizationId)
      updateFields.leadOrganizationId = activity.leadOrganizationId;

    // Update Person if needed
    if (
      updateFields.personId &&
      (updateFields.contactPerson || updateFields.email)
    ) {
      await Person.update(
        {
          ...(updateFields.contactPerson && {
            contactPerson: updateFields.contactPerson,
          }),
          ...(updateFields.email && { email: updateFields.email }),
        },
        { where: { personId: updateFields.personId } }
      );
    }

    // Update Organizations if needed
    if (updateFields.leadOrganizationId && updateFields.organization) {
      await Organizations.update(
        { organization: updateFields.organization },
        { where: { leadOrganizationId: updateFields.leadOrganizationId } }
      );
    }

    // Update Deal if activity is connected to deal and deal fields are provided
    if (activity.dealId || updateFields.dealId) {
      const targetDealId = updateFields.dealId || activity.dealId;
      
      // Extract deal-related fields from updateFields (fields that start with 'deal_')
      const dealFields = {};
      Object.keys(updateFields).forEach(key => {
        if (key.startsWith('deal_')) {
          // Remove 'deal_' prefix to get actual deal field name
          const dealFieldName = key.replace('deal_', '');
          dealFields[dealFieldName] = updateFields[key];
          // Remove from updateFields so it doesn't get saved to activity
          delete updateFields[key];
        }
      });

      // Also check for direct deal field names (without deal_ prefix)
      const dealModelFields = Object.keys(Deal.rawAttributes);
      dealModelFields.forEach(field => {
        if (updateFields.hasOwnProperty(field) && field !== 'dealId') {
          dealFields[field] = updateFields[field];
          // Keep in updateFields as it might also be an activity field
        }
      });

      // Update the deal if we have fields to update
      if (Object.keys(dealFields).length > 0) {
        console.log(`Updating deal ${targetDealId} with fields:`, dealFields);
        
        try {
          const dealUpdateResult = await Deal.update(dealFields, {
            where: { dealId: targetDealId }
          });
          
          if (dealUpdateResult[0] > 0) {
            console.log(`Successfully updated deal ${targetDealId}`);
          } else {
            console.log(`Deal ${targetDealId} not found or no changes made`);
          }
        } catch (dealUpdateError) {
          console.error(`Error updating deal ${targetDealId}:`, dealUpdateError.message);
          // Don't fail the entire request, just log the error
        }
      }
    }

    // If guests is present and is an array, stringify it
    if (updateFields.guests && Array.isArray(updateFields.guests)) {
      updateFields.guests = JSON.stringify(updateFields.guests);
    }

    await activity.update(updateFields);

    // Update next activity date for the lead if this activity is linked to a lead
    // and if the update affects scheduling (startDateTime, isDone, etc.)
    if (
      activity.leadId &&
      (updateFields.startDateTime ||
        updateFields.isDone !== undefined ||
        updateFields.leadId)
    ) {
      await updateNextActivityForLead(activity.leadId);

      // If leadId was changed, also update the previous lead
      if (updateFields.leadId && updateFields.leadId !== activity.leadId) {
        const originalLeadId = activity.getDataValue("leadId"); // Get original value before update
        if (originalLeadId) {
          await updateNextActivityForLead(originalLeadId);
        }
      }
    }

    // Update next activity date for the deal if this activity is linked to a deal
    // and if the update affects scheduling (startDateTime, isDone, etc.)
    if (
      activity.dealId &&
      (updateFields.startDateTime ||
        updateFields.isDone !== undefined ||
        updateFields.dealId)
    ) {
      await updateNextActivityForDeal(activity.dealId);

      // If dealId was changed, also update the previous deal
      if (updateFields.dealId && updateFields.dealId !== activity.dealId) {
        const originalDealId = activity.getDataValue("dealId"); // Get original value before update
        if (originalDealId) {
          await updateNextActivityForDeal(originalDealId);
        }
      }
    }

    // Fetch updated activity with related deal information if connected
    const updatedActivity = await Activity.findByPk(activityId, {
      include: [
        {
          model: Deal,
          as: "ActivityDeal",
          required: false,
          attributes: ["dealId", "title", "value", "currency", "status", "pipelineStage"]
        }
      ]
    });

    res.status(200).json({ 
      message: "Activity updated successfully", 
      activity: updatedActivity,
      dealUpdated: !!(activity.dealId || req.body.dealId)
    });
  } catch (error) {
    console.error("Error updating activity:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.saveAllActivityFieldsWithCheck = async (req, res) => {
  // Accept checked fields from req.body
  const { checkedFields } = req.body || {};

  try {
    // Get all field names from Activity model
    const activityFields = Object.keys(Activity.rawAttributes);
    
    // Exclude fields that are likely IDs (case-insensitive, ends with 'id' or is 'id')
    const filteredActivityFields = activityFields.filter(
      (field) => !/^id$/i.test(field) && !/id$/i.test(field)
    );

    // Build activity columns to save
    const activityColumnsToSave = filteredActivityFields.map((field) => {
      let check = false;
      if (Array.isArray(checkedFields)) {
        const found = checkedFields.find((item) => item.value === field);
        check = found ? !!found.check : false;
      }
      return { key: field, check, entityType: 'Activity' };
    });

    // Get deal columns from DealColumn table
    let dealColumnsToSave = [];
    const existingDealPref = await DealColumn.findOne();
    if (existingDealPref && existingDealPref.columns) {
      const dealColumns = Array.isArray(existingDealPref.columns) 
        ? existingDealPref.columns 
        : JSON.parse(existingDealPref.columns);
      
      // Add entityType to existing deal columns
      dealColumnsToSave = dealColumns.map(col => ({
        ...col,
        entityType: 'Deal'
      }));
    } else {
      // If no existing deal columns, get all Deal model fields
      const dealFields = Object.keys(Deal.rawAttributes);
      const filteredDealFields = dealFields.filter(
        (field) => !/^id$/i.test(field) && !/id$/i.test(field)
      );

      dealColumnsToSave = filteredDealFields.map((field) => {
        return { key: field, check: false, entityType: 'Deal' };
      });
    }

    // Combine both arrays into a single columns array
    const allColumnsToSave = [...activityColumnsToSave, ...dealColumnsToSave];

    // Save everything in ActivityColumnPreference
    let activityPref = await ActivityColumnPreference.findOne();
    if (!activityPref) {
      // Create the record if it doesn't exist
      activityPref = await ActivityColumnPreference.create({ columns: allColumnsToSave });
    } else {
      // Update the existing record
      activityPref.columns = allColumnsToSave;
      await activityPref.save();
    }

    res.status(200).json({
      message: "All columns saved in ActivityColumnPreference in single array",
      columns: activityPref.columns
    });

  } catch (error) {
    console.log("Error saving all columns:", error);
    res.status(500).json({ 
      message: "Error saving all columns", 
      error: error.message 
    });
  }
};

exports.updateActivityColumnChecks = async (req, res) => {
  // Expecting: { columns: [ { key: "columnName", check: true/false }, ... ] }
  const { columns } = req.body;

  if (!Array.isArray(columns)) {
    return res.status(400).json({ message: "Columns array is required." });
  }

  try {
    // Find the global ActivityColumnPreference record
    let pref = await ActivityColumnPreference.findOne();
    if (!pref) {
      return res.status(404).json({ message: "Preferences not found." });
    }

    // Parse columns if stored as string
    let prefColumns =
      typeof pref.columns === "string"
        ? JSON.parse(pref.columns)
        : pref.columns;

    // Update check status for matching columns
    prefColumns = prefColumns.map((col) => {
      const found = columns.find((c) => c.key === col.key);
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

exports.getActivityFields = async (req, res) => {
  try {
    // Fetch data from ActivityColumnPreference table
    const pref = await ActivityColumnPreference.findOne();
    
    if (!pref || !pref.columns) {
      return res.status(404).json({ 
        message: "No column preferences found",
        fields: []
      });
    }

    // Parse columns data if it's stored as JSON string
    const columns = typeof pref.columns === "string" 
      ? JSON.parse(pref.columns) 
      : pref.columns;

    // Transform the data to include labels for better display
    const fieldsWithLabels = columns.map(column => ({
      key: column.key,
      label: column.key
        .replace(/([A-Z])/g, " $1") // Add space before capital letters
        .replace(/^./, str => str.toUpperCase()), // Capitalize first letter
      check: column.check,
      entityType: column.entityType
    }));

    res.status(200).json({ 
      success: true,
      fields: fieldsWithLabels,
      totalFields: fieldsWithLabels.length,
      activityFields: fieldsWithLabels.filter(field => field.entityType === 'Activity').length,
      dealFields: fieldsWithLabels.filter(field => field.entityType === 'Deal').length
    });
  } catch (error) {
    console.error("Error fetching activity fields:", error);
    res.status(500).json({ 
      success: false,
      message: "Error fetching activity fields",
      error: error.message 
    });
  }
};

exports.getAllLeadsAndDeals = async (req, res) => {
  try {
    // Pagination and search params
    const { page = 1, limit = 20, search = "" } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Search condition for leads and deals
    const leadWhere = search ? { title: { [Op.like]: `%${search}%` } } : {};
    const dealWhere = search ? { title: { [Op.like]: `%${search}%` } } : {};

    // Fetch leads with pagination
    const { rows: leadsRows, count: totalLeads } = await Lead.findAndCountAll({
      attributes: ["leadId", "title"],
      where: leadWhere,
      limit: parseInt(limit),
      offset,
      order: [["createdAt", "DESC"]],
    });

    // Fetch deals with pagination
    const { rows: dealsRows, count: totalDeals } = await Deal.findAndCountAll({
      attributes: ["dealId", "title"],
      where: dealWhere,
      limit: parseInt(limit),
      offset,
      order: [["createdAt", "DESC"]],
    });

    // Format response
    const leads = leadsRows.map((lead) => ({
      leadId: lead.leadId,
      title: lead.title,
    }));

    const deals = dealsRows.map((deal) => ({
      dealId: deal.dealId,
      title: deal.title,
    }));

    res.status(200).json({
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalLeads,
        totalDeals,
        totalLeadPages: Math.ceil(totalLeads / limit),
        totalDealPages: Math.ceil(totalDeals / limit),
      },
      leads,
      deals,
    });
  } catch (error) {
    console.error("Error fetching leads and deals:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getAllOrganizations = async (req, res) => {
  try {
    // Pagination and search params
    const {
      page = 1,
      limit = 20,
      search = "",
      // Add more filters as needed, e.g. country, status, etc.
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build where condition for search/filter
    const where = {};
    if (search) {
      where.organization = { [Op.like]: `%${search}%` };
    }
    // Add more filters here if needed, e.g.:
    // if (req.query.country) where.country = req.query.country;

    // Fetch organizations with pagination and search
    const { rows: organizations, count: total } =
      await Organizations.findAndCountAll({
        attributes: ["leadOrganizationId", "organization"],
        where,
        limit: parseInt(limit),
        offset,
        order: [["organization", "ASC"]],
      });

    res.status(200).json({
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
      organizations,
    });
  } catch (error) {
    console.error("Error fetching organizations:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getCalendarActivities = async (req, res) => {
  try {
    // Optional filters: user, date range, type, etc.
    const {
      startDate, // e.g. "2025-06-22"
      endDate, // e.g. "2025-06-28"
      assignedTo,
      type,
    } = req.query;

    const where = {};

    // Filter by date range
    if (startDate && endDate) {
      where.startDateTime = { [Op.gte]: new Date(startDate) };
      where.endDateTime = { [Op.lte]: new Date(endDate) };
    } else if (startDate) {
      where.startDateTime = { [Op.gte]: new Date(startDate) };
    } else if (endDate) {
      where.endDateTime = { [Op.lte]: new Date(endDate) };
    }

    // Filter by assigned user
    if (assignedTo) {
      where.assignedTo = assignedTo;
    }

    // Filter by activity type (Meeting, Task, etc.)
    if (type) {
      where.type = type;
    }

    // Fetch activities
    const activities = await Activity.findAll({
      where,
      attributes: [
        "activityId",
        "type",
        "subject",
        "startDateTime",
        "endDateTime",
        "status",
        "assignedTo",
        "dealId",
        "leadId",
      ],
      order: [["startDateTime", "ASC"]],
    });

    // Optionally, group by date or format as needed for your frontend calendar
    res.status(200).json({ activities });
  } catch (error) {
    console.error("Error fetching calendar activities:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Helper function to update next activity date for a lead
const updateNextActivityForLead = async (leadId) => {
  try {
    // Find the earliest upcoming activity for this lead that is not done
    const nextActivity = await Activity.findOne({
      where: {
        leadId,
        isDone: false,
        startDateTime: { [Op.gte]: new Date() }, // Only future activities
      },
      order: [["startDateTime", "ASC"]], // Get the earliest one
      attributes: ["startDateTime", "activityId"],
    });

    let nextActivityDate = null;
    let nextActivityStatus = null;

    if (nextActivity) {
      nextActivityDate = nextActivity.startDateTime;

      // Calculate status based on how close the activity is
      const now = new Date();
      const activityDate = new Date(nextActivity.startDateTime);
      const timeDiff = activityDate.getTime() - now.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

      if (daysDiff < 0) {
        nextActivityStatus = "overdue"; // Red - Past due
      } else if (daysDiff <= 1) {
        nextActivityStatus = "today"; // Red/Orange - Due today or tomorrow
      } else if (daysDiff <= 3) {
        nextActivityStatus = "upcoming"; // Yellow - Due within 3 days
      } else {
        nextActivityStatus = "normal"; // Default color
      }
    }

    // Update the lead details
    await LeadDetails.update(
      {
        nextActivityDate,
        nextActivityStatus,
      },
      { where: { leadId } }
    );

    console.log(
      `Updated next activity for lead ${leadId}: ${nextActivityDate} (${nextActivityStatus})`
    );
  } catch (error) {
    console.error(`Error updating next activity for lead ${leadId}:`, error);
  }
};

// Helper function to update next activity date for a deal
const updateNextActivityForDeal = async (dealId) => {
  try {
    // Find the earliest upcoming activity for this deal that is not done
    const nextActivity = await Activity.findOne({
      where: {
        dealId,
        isDone: false,
        startDateTime: { [Op.gte]: new Date() }, // Only future activities
      },
      order: [["startDateTime", "ASC"]], // Get the earliest one
      attributes: ["startDateTime", "activityId"],
    });

    let nextActivityDate = null;
    let nextActivityStatus = null;

    if (nextActivity) {
      nextActivityDate = nextActivity.startDateTime;

      // Calculate status based on how close the activity is
      const now = new Date();
      const activityDate = new Date(nextActivity.startDateTime);
      const timeDiff = activityDate.getTime() - now.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

      if (daysDiff < 0) {
        nextActivityStatus = "overdue"; // Red - Past due
      } else if (daysDiff <= 1) {
        nextActivityStatus = "today"; // Red/Orange - Due today or tomorrow
      } else if (daysDiff <= 3) {
        nextActivityStatus = "upcoming"; // Yellow - Due within 3 days
      } else {
        nextActivityStatus = "normal"; // Default color
      }
    }

    // Update the deal's nextActivityDate field
    await Deal.update(
      {
        nextActivityDate,
        lastActivityDate: nextActivity ? nextActivity.startDateTime : null,
      },
      { where: { dealId } }
    );

    // Also update DealDetails if it exists
    const dealDetails = await DealDetails.findOne({ where: { dealId } });
    if (dealDetails) {
      await DealDetails.update(
        {
          nextActivityDate,
        },
        { where: { dealId } }
      );
    }

    console.log(
      `Updated next activity for deal ${dealId}: ${nextActivityDate} (${nextActivityStatus})`
    );
  } catch (error) {
    console.error(`Error updating next activity for deal ${dealId}:`, error);
  }
};

// Utility function to update next activity dates for all leads (can be called via API)
exports.updateAllLeadsNextActivity = async (req, res) => {
  try {
    // Get all leads that have activities
    const leadsWithActivities = await Activity.findAll({
      attributes: ["leadId"],
      where: {
        leadId: { [Op.ne]: null },
      },
      group: ["leadId"],
      raw: true,
    });

    const leadIds = leadsWithActivities.map((item) => item.leadId);
    let updatedCount = 0;

    for (const leadId of leadIds) {
      await updateNextActivityForLead(leadId);
      updatedCount++;
    }

    res.status(200).json({
      message: `Updated next activity dates for ${updatedCount} leads`,
      updatedLeads: updatedCount,
    });
  } catch (error) {
    console.error("Error updating all leads next activity:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Utility function to update next activity dates for all deals (can be called via API)
exports.updateAllDealsNextActivity = async (req, res) => {
  try {
    // Get all deals that have activities
    const dealsWithActivities = await Activity.findAll({
      attributes: ["dealId"],
      where: {
        dealId: { [Op.ne]: null },
      },
      group: ["dealId"],
      raw: true,
    });

    const dealIds = dealsWithActivities.map((item) => item.dealId);
    let updatedCount = 0;

    for (const dealId of dealIds) {
      await updateNextActivityForDeal(dealId);
      updatedCount++;
    }

    res.status(200).json({
      message: `Updated next activity dates for ${updatedCount} deals`,
      updatedDeals: updatedCount,
    });
  } catch (error) {
    console.error("Error updating all deals next activity:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Bulk edit activities functionality
exports.bulkEditActivities = async (req, res) => {
  const { activityIds, updateData } = req.body;

  // Validate input
  if (!activityIds || !Array.isArray(activityIds) || activityIds.length === 0) {
    return res.status(400).json({
      message: "activityIds must be a non-empty array",
    });
  }

  if (!updateData || Object.keys(updateData).length === 0) {
    return res.status(400).json({
      message: "updateData must contain at least one field to update",
    });
  }

  console.log("Bulk edit activities request:", { activityIds, updateData });

  try {
    // Find activities to update
    let whereClause = { activityId: { [Op.in]: activityIds } };

    // Apply role-based filtering - only admin can edit all activities
    if (req.role !== "admin") {
      whereClause[Op.or] = [
        { masterUserID: req.adminId },
        { assignedTo: req.adminId },
      ];
    }

    const activitiesToUpdate = await Activity.findAll({
      where: whereClause,
      attributes: [
        "activityId",
        "type",
        "subject",
        "startDateTime",
        "endDateTime",
        "assignedTo",
        "leadId",
        "dealId",
        "personId",
        "leadOrganizationId",
        "isDone",
      ],
    });

    if (activitiesToUpdate.length === 0) {
      return res.status(404).json({
        message:
          "No activities found to update or you don't have permission to edit them",
      });
    }

    console.log(`Found ${activitiesToUpdate.length} activities to update`);

    const updateResults = {
      successful: [],
      failed: [],
      skipped: [],
    };

    // If guests is present and is an array, stringify it
    if (updateData.guests && Array.isArray(updateData.guests)) {
      updateData.guests = JSON.stringify(updateData.guests);
    }

    // Process each activity
    for (const activity of activitiesToUpdate) {
      try {
        console.log(`Processing activity ${activity.activityId}`);

        // Handle person and organization updates if needed
        let contactPerson = null;
        let email = null;
        let organization = null;

        // If personId is being updated or contact person info is being updated
        if (
          updateData.personId ||
          updateData.contactPerson ||
          updateData.email
        ) {
          const personId = updateData.personId || activity.personId;
          if (personId) {
            const person = await Person.findByPk(personId);
            if (person) {
              contactPerson = person.contactPerson;
              email = person.email;
            }
          }
        }

        // If leadOrganizationId is being updated or organization info is being updated
        if (updateData.leadOrganizationId || updateData.organization) {
          const orgId =
            updateData.leadOrganizationId || activity.leadOrganizationId;
          if (orgId) {
            const org = await Organizations.findByPk(orgId);
            if (org) {
              organization = org.organization;
            }
          }
        }

        // Prepare the update data with additional fields
        const finalUpdateData = {
          ...updateData,
          ...(contactPerson && { contactPerson }),
          ...(email && { email }),
          ...(organization && { organization }),
        };

        // Update the activity
        await activity.update(finalUpdateData);

        // Update related deal if activity is connected to a deal
        if (activity.dealId) {
          console.log(`Processing deal updates for activity ${activity.activityId} connected to deal ${activity.dealId}`);
          
          const dealUpdateData = {};
          
          // Check for deal_ prefixed fields
          Object.keys(updateData).forEach((key) => {
            if (key.startsWith("deal_")) {
              const dealField = key.substring(5); // Remove "deal_" prefix
              dealUpdateData[dealField] = updateData[key];
              console.log(`Found deal field update: ${dealField} = ${updateData[key]}`);
            }
          });
          
          // Check for direct deal fields (without deal_ prefix)
          const dealFields = ['title', 'value', 'currency', 'status', 'stage_id', 'probability', 'expected_close_date', 
                            'lost_reason', 'visible_to', 'add_time', 'update_time', 'stage_change_time', 
                            'active', 'deleted', 'won_time', 'lost_time', 'close_time', 'pipeline_id', 
                            'next_activity_date', 'next_activity_time', 'next_activity_id', 'last_activity_id',
                            'last_activity_date', 'label', 'org_hidden', 'person_hidden'];
          
          dealFields.forEach(field => {
            if (updateData.hasOwnProperty(field) && !dealUpdateData.hasOwnProperty(field)) {
              dealUpdateData[field] = updateData[field];
              console.log(`Found direct deal field update: ${field} = ${updateData[field]}`);
            }
          });
          
          // Update the deal if we have deal updates
          if (Object.keys(dealUpdateData).length > 0) {
            try {
              const deal = await Deal.findByPk(activity.dealId);
              if (deal) {
                console.log(`Updating deal ${activity.dealId} with data:`, dealUpdateData);
                await deal.update(dealUpdateData);
                console.log(`Successfully updated deal ${activity.dealId}`);
              } else {
                console.log(`Deal ${activity.dealId} not found`);
              }
            } catch (dealError) {
              console.error(`Error updating deal ${activity.dealId}:`, dealError);
            }
          } else {
            console.log(`No deal field updates found for activity ${activity.activityId}`);
          }
        }

        // Update next activity date for the lead if this activity is linked to a lead
        // and if the update affects scheduling
        if (
          activity.leadId &&
          (updateData.startDateTime ||
            updateData.isDone !== undefined ||
            updateData.leadId)
        ) {
          await updateNextActivityForLead(activity.leadId);

          // If leadId was changed, also update the previous lead
          if (updateData.leadId && updateData.leadId !== activity.leadId) {
            await updateNextActivityForLead(activity.leadId);
          }
        }

        // Update next activity date for the deal if this activity is linked to a deal
        // and if the update affects scheduling
        if (
          activity.dealId &&
          (updateData.startDateTime ||
            updateData.isDone !== undefined ||
            updateData.dealId)
        ) {
          await updateNextActivityForDeal(activity.dealId);

          // If dealId was changed, also update the previous deal
          if (updateData.dealId && updateData.dealId !== activity.dealId) {
            await updateNextActivityForDeal(activity.dealId);
          }
        }

        // Fetch the updated activity with related data to return in response
        const updatedActivityWithDetails = await Activity.findByPk(activity.activityId, {
          include: [
            {
              model: Deal,
              as: "ActivityDeal",
              required: false,
              attributes: ["dealId", "title", "value", "currency", "status", "pipelineStage"]
            },
            {
              model: Lead,
              as: "ActivityLead",
              required: false,
              attributes: ["leadId", "title"]
            },
            {
              model: Person,
              as: "ActivityPerson",
              required: false,
              attributes: ["personId", "contactPerson", "email"]
            },
            {
              model: Organizations,
              as: "ActivityOrganization",
              required: false,
              attributes: ["leadOrganizationId", "organization"]
            }
          ]
        });

        updateResults.successful.push({
          activityId: activity.activityId,
          type: updatedActivityWithDetails.type,
          subject: updatedActivityWithDetails.subject,
          startDateTime: updatedActivityWithDetails.startDateTime,
          endDateTime: updatedActivityWithDetails.endDateTime,
          assignedTo: updatedActivityWithDetails.assignedTo,
          isDone: updatedActivityWithDetails.isDone,
          priority: updatedActivityWithDetails.priority,
          status: updatedActivityWithDetails.status,
          description: updatedActivityWithDetails.description,
          // Include related entity data
          deal: updatedActivityWithDetails.ActivityDeal ? {
            dealId: updatedActivityWithDetails.ActivityDeal.dealId,
            title: updatedActivityWithDetails.ActivityDeal.title,
            value: updatedActivityWithDetails.ActivityDeal.value,
            currency: updatedActivityWithDetails.ActivityDeal.currency,
            status: updatedActivityWithDetails.ActivityDeal.status
          } : null,
          lead: updatedActivityWithDetails.ActivityLead ? {
            leadId: updatedActivityWithDetails.ActivityLead.leadId,
            title: updatedActivityWithDetails.ActivityLead.title
          } : null,
          person: updatedActivityWithDetails.ActivityPerson ? {
            personId: updatedActivityWithDetails.ActivityPerson.personId,
            contactPerson: updatedActivityWithDetails.ActivityPerson.contactPerson,
            email: updatedActivityWithDetails.ActivityPerson.email
          } : null,
          organization: updatedActivityWithDetails.ActivityOrganization ? {
            leadOrganizationId: updatedActivityWithDetails.ActivityOrganization.leadOrganizationId,
            organization: updatedActivityWithDetails.ActivityOrganization.organization
          } : null,
          // Include all updated fields for reference
          updatedFields: Object.keys(finalUpdateData),
          dealUpdated: !!activity.dealId
        });

        console.log(`Updated activity ${activity.activityId}`);
      } catch (activityError) {
        console.error(
          `Error updating activity ${activity.activityId}:`,
          activityError
        );

        updateResults.failed.push({
          activityId: activity.activityId,
          type: activity.type,
          subject: activity.subject,
          error: activityError.message,
        });
      }
    }

    // Check for activities that were requested but not found
    const foundActivityIds = activitiesToUpdate.map(
      (activity) => activity.activityId
    );
    const notFoundActivityIds = activityIds.filter(
      (id) => !foundActivityIds.includes(id)
    );

    notFoundActivityIds.forEach((activityId) => {
      updateResults.skipped.push({
        activityId: activityId,
        reason: "Activity not found or no permission to edit",
      });
    });

    console.log("Bulk update results:", updateResults);

    res.status(200).json({
      message: "Bulk edit operation completed",
      results: updateResults,
      summary: {
        total: activityIds.length,
        successful: updateResults.successful.length,
        failed: updateResults.failed.length,
        skipped: updateResults.skipped.length,
      },
    });
  } catch (error) {
    console.error("Error in bulk edit activities:", error);
    res.status(500).json({
      message: "Internal server error during bulk edit",
      error: error.message,
    });
  }
};

// Bulk delete activities functionality
exports.bulkDeleteActivities = async (req, res) => {
  const { activityIds } = req.body;

  // Validate input
  if (!activityIds || !Array.isArray(activityIds) || activityIds.length === 0) {
    return res.status(400).json({
      message: "activityIds must be a non-empty array",
    });
  }

  console.log("Bulk delete activities request:", activityIds);

  try {
    // Find activities to delete
    let whereClause = { activityId: { [Op.in]: activityIds } };

    // Apply role-based filtering - only admin can delete all activities
    if (req.role !== "admin") {
      whereClause[Op.or] = [
        { masterUserID: req.adminId },
        { assignedTo: req.adminId },
      ];
    }

    const activitiesToDelete = await Activity.findAll({
      where: whereClause,
      attributes: [
        "activityId",
        "type",
        "subject",
        "startDateTime",
        "assignedTo",
        "leadId",
      ],
    });

    if (activitiesToDelete.length === 0) {
      return res.status(404).json({
        message:
          "No activities found to delete or you don't have permission to delete them",
      });
    }

    console.log(`Found ${activitiesToDelete.length} activities to delete`);

    const deleteResults = {
      successful: [],
      failed: [],
      skipped: [],
    };

    // Process each activity for deletion
    for (const activity of activitiesToDelete) {
      try {
        console.log(`Deleting activity ${activity.activityId}`);

        const leadId = activity.leadId;
        const dealId = activity.dealId;

        // Delete the activity
        await Activity.destroy({
          where: { activityId: activity.activityId },
        });

        // Update next activity date for the lead if this activity was linked to a lead
        if (leadId) {
          await updateNextActivityForLead(leadId);
        }

        // Update next activity date for the deal if this activity was linked to a deal
        if (dealId) {
          await updateNextActivityForDeal(dealId);
        }

        deleteResults.successful.push({
          activityId: activity.activityId,
          type: activity.type,
          subject: activity.subject,
          startDateTime: activity.startDateTime,
          assignedTo: activity.assignedTo,
        });

        console.log(`Deleted activity ${activity.activityId}`);
      } catch (activityError) {
        console.error(
          `Error deleting activity ${activity.activityId}:`,
          activityError
        );

        deleteResults.failed.push({
          activityId: activity.activityId,
          type: activity.type,
          subject: activity.subject,
          error: activityError.message,
        });
      }
    }

    // Check for activities that were requested but not found
    const foundActivityIds = activitiesToDelete.map(
      (activity) => activity.activityId
    );
    const notFoundActivityIds = activityIds.filter(
      (id) => !foundActivityIds.includes(id)
    );

    notFoundActivityIds.forEach((activityId) => {
      deleteResults.skipped.push({
        activityId: activityId,
        reason: "Activity not found or no permission to delete",
      });
    });

    console.log("Bulk delete results:", deleteResults);

    res.status(200).json({
      message: "Bulk delete operation completed",
      results: deleteResults,
      summary: {
        total: activityIds.length,
        successful: deleteResults.successful.length,
        failed: deleteResults.failed.length,
        skipped: deleteResults.skipped.length,
      },
    });
  } catch (error) {
    console.error("Error in bulk delete activities:", error);
    res.status(500).json({
      message: "Internal server error during bulk delete",
      error: error.message,
    });
  }
};

// Bulk mark activities as done/undone
exports.bulkMarkActivities = async (req, res) => {
  const { activityIds, isDone } = req.body;

  // Validate input
  if (!activityIds || !Array.isArray(activityIds) || activityIds.length === 0) {
    return res.status(400).json({
      message: "activityIds must be a non-empty array",
    });
  }

  if (typeof isDone !== "boolean") {
    return res.status(400).json({
      message: "isDone must be a boolean value",
    });
  }

  console.log("Bulk mark activities request:", { activityIds, isDone });

  try {
    // Find activities to mark
    let whereClause = { activityId: { [Op.in]: activityIds } };

    // Apply role-based filtering - only admin can mark all activities
    if (req.role !== "admin") {
      whereClause[Op.or] = [
        { masterUserID: req.adminId },
        { assignedTo: req.adminId },
      ];
    }

    const activitiesToMark = await Activity.findAll({
      where: whereClause,
      attributes: [
        "activityId",
        "type",
        "subject",
        "startDateTime",
        "assignedTo",
        "leadId",
        "isDone",
      ],
    });

    if (activitiesToMark.length === 0) {
      return res.status(404).json({
        message:
          "No activities found to mark or you don't have permission to mark them",
      });
    }

    console.log(
      `Found ${activitiesToMark.length} activities to mark as ${
        isDone ? "done" : "undone"
      }`
    );

    const markResults = {
      successful: [],
      failed: [],
      skipped: [],
    };

    // Process each activity for marking
    for (const activity of activitiesToMark) {
      try {
        console.log(
          `Marking activity ${activity.activityId} as ${
            isDone ? "done" : "undone"
          }`
        );

        const leadId = activity.leadId;
        const dealId = activity.dealId;

        // Update the activity done status
        await Activity.update(
          { isDone: isDone },
          { where: { activityId: activity.activityId } }
        );

        // Update next activity date for the lead if this activity was linked to a lead
        if (leadId) {
          await updateNextActivityForLead(leadId);
        }

        // Update next activity date for the deal if this activity was linked to a deal
        if (dealId) {
          await updateNextActivityForDeal(dealId);
        }

        markResults.successful.push({
          activityId: activity.activityId,
          type: activity.type,
          subject: activity.subject,
          startDateTime: activity.startDateTime,
          assignedTo: activity.assignedTo,
          previousStatus: activity.isDone,
          newStatus: isDone,
        });

        console.log(
          `Marked activity ${activity.activityId} as ${
            isDone ? "done" : "undone"
          }`
        );
      } catch (activityError) {
        console.error(
          `Error marking activity ${activity.activityId}:`,
          activityError
        );

        markResults.failed.push({
          activityId: activity.activityId,
          type: activity.type,
          subject: activity.subject,
          error: activityError.message,
        });
      }
    }

    // Check for activities that were requested but not found
    const foundActivityIds = activitiesToMark.map(
      (activity) => activity.activityId
    );
    const notFoundActivityIds = activityIds.filter(
      (id) => !foundActivityIds.includes(id)
    );

    notFoundActivityIds.forEach((activityId) => {
      markResults.skipped.push({
        activityId: activityId,
        reason: "Activity not found or no permission to mark",
      });
    });

    console.log("Bulk mark results:", markResults);

    res.status(200).json({
      message: `Bulk mark as ${isDone ? "done" : "undone"} operation completed`,
      results: markResults,
      summary: {
        total: activityIds.length,
        successful: markResults.successful.length,
        failed: markResults.failed.length,
        skipped: markResults.skipped.length,
      },
    });
  } catch (error) {
    console.error("Error in bulk mark activities:", error);
    res.status(500).json({
      message: "Internal server error during bulk mark",
      error: error.message,
    });
  }
};

// Bulk reassign activities to different users
exports.bulkReassignActivities = async (req, res) => {
  const { activityIds, assignedTo } = req.body;

  // Validate input
  if (!activityIds || !Array.isArray(activityIds) || activityIds.length === 0) {
    return res.status(400).json({
      message: "activityIds must be a non-empty array",
    });
  }

  if (!assignedTo) {
    return res.status(400).json({
      message: "assignedTo is required",
    });
  }

  console.log("Bulk reassign activities request:", { activityIds, assignedTo });

  try {
    // Find activities to reassign
    let whereClause = { activityId: { [Op.in]: activityIds } };

    // Apply role-based filtering - only admin can reassign all activities
    if (req.role !== "admin") {
      whereClause[Op.or] = [
        { masterUserID: req.adminId },
        { assignedTo: req.adminId },
      ];
    }

    const activitiesToReassign = await Activity.findAll({
      where: whereClause,
      attributes: [
        "activityId",
        "type",
        "subject",
        "startDateTime",
        "assignedTo",
        "leadId",
      ],
    });

    if (activitiesToReassign.length === 0) {
      return res.status(404).json({
        message:
          "No activities found to reassign or you don't have permission to reassign them",
      });
    }

    console.log(
      `Found ${activitiesToReassign.length} activities to reassign to ${assignedTo}`
    );

    const reassignResults = {
      successful: [],
      failed: [],
      skipped: [],
    };

    // Process each activity for reassignment
    for (const activity of activitiesToReassign) {
      try {
        console.log(
          `Reassigning activity ${activity.activityId} from ${activity.assignedTo} to ${assignedTo}`
        );

        const leadId = activity.leadId;
        const dealId = activity.dealId;

        // Update the activity assigned user
        await Activity.update(
          { assignedTo: assignedTo },
          { where: { activityId: activity.activityId } }
        );

        // Update next activity date for the lead if this activity was linked to a lead
        if (leadId) {
          await updateNextActivityForLead(leadId);
        }

        // Update next activity date for the deal if this activity was linked to a deal
        if (dealId) {
          await updateNextActivityForDeal(dealId);
        }

        reassignResults.successful.push({
          activityId: activity.activityId,
          type: activity.type,
          subject: activity.subject,
          startDateTime: activity.startDateTime,
          fromUser: activity.assignedTo,
          toUser: assignedTo,
        });

        console.log(
          `Reassigned activity ${activity.activityId} to ${assignedTo}`
        );
      } catch (activityError) {
        console.error(
          `Error reassigning activity ${activity.activityId}:`,
          activityError
        );

        reassignResults.failed.push({
          activityId: activity.activityId,
          type: activity.type,
          subject: activity.subject,
          error: activityError.message,
        });
      }
    }

    // Check for activities that were requested but not found
    const foundActivityIds = activitiesToReassign.map(
      (activity) => activity.activityId
    );
    const notFoundActivityIds = activityIds.filter(
      (id) => !foundActivityIds.includes(id)
    );

    notFoundActivityIds.forEach((activityId) => {
      reassignResults.skipped.push({
        activityId: activityId,
        reason: "Activity not found or no permission to reassign",
      });
    });

    console.log("Bulk reassign results:", reassignResults);

    res.status(200).json({
      message: `Bulk reassign to ${assignedTo} operation completed`,
      results: reassignResults,
      summary: {
        total: activityIds.length,
        successful: reassignResults.successful.length,
        failed: reassignResults.failed.length,
        skipped: reassignResults.skipped.length,
      },
    });
  } catch (error) {
    console.error("Error in bulk reassign activities:", error);
    res.status(500).json({
      message: "Internal server error during bulk reassign",
      error: error.message,
    });
  }
};

exports.getActivityFilterFields = async (req, res) => {
  try {
    // Helper function to convert field type to readable format
    const getFieldType = (sequelizeType) => {
      if (!sequelizeType) return 'text';
      
      const typeString = sequelizeType.toString().toLowerCase();
      
      if (typeString.includes('integer') || typeString.includes('bigint') || typeString.includes('decimal') || typeString.includes('float') || typeString.includes('double')) {
        return 'number';
      } else if (typeString.includes('boolean')) {
        return 'boolean';
      } else if (typeString.includes('date') || typeString.includes('time')) {
        return 'date';
      } else if (typeString.includes('json')) {
        return 'json';
      } else if (typeString.includes('enum')) {
        return 'select';
      } else {
        return 'text';
      }
    };

    // Helper function to generate label from field name
    const generateLabel = (fieldName) => {
      return fieldName
        .replace(/([A-Z])/g, ' $1') // Add space before capital letters
        .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
        .replace(/\s+/g, ' ') // Clean up multiple spaces
        .trim();
    };

    // Get all Activity model fields
    const activityFields = Object.keys(Activity.rawAttributes);
    
    // Convert Activity model fields to the required format
    const fields = activityFields.map(fieldName => {
      const fieldInfo = Activity.rawAttributes[fieldName];
      return {
        value: fieldName,
        label: generateLabel(fieldName),
        type: getFieldType(fieldInfo.type),
        isStandard: true,
        entity: 'activity'
      };
    });

    // Fetch custom fields for Activity entity
    let customFields = [];
    if (req.adminId) {
      try {
        customFields = await CustomField.findAll({
          where: {
            entityType: { [Op.in]: ["activity", "both"] },
            isActive: true,
            [Op.or]: [
              { masterUserID: req.adminId },
              { fieldSource: "default" },
              { fieldSource: "system" },
              { fieldSource: "custom" },
            ],
          },
          attributes: [
            "fieldId",
            "fieldName", 
            "fieldLabel",
            "fieldType",
            "isRequired",
            "isImportant",
            "fieldSource",
            "entityType",
          ],
          order: [["fieldName", "ASC"]],
        });
      } catch (customFieldError) {
        console.error("Error fetching custom fields:", customFieldError);
      }
    }

    // Add custom fields to the fields array
    const customFieldsFormatted = customFields.map(field => ({
      value: field.fieldName,
      label: field.fieldLabel || generateLabel(field.fieldName),
      type: field.fieldType || 'text',
      isCustomField: true,
      fieldId: field.fieldId,
      isRequired: field.isRequired,
      isImportant: field.isImportant,
      fieldSource: field.fieldSource,
      entityType: field.entityType,
      entity: 'activity'
    }));

    // Combine standard and custom fields
    const allFields = [...fields, ...customFieldsFormatted];

    res.status(200).json({ 
      fields: allFields,
      standardFieldsCount: fields.length,
      customFieldsCount: customFields.length,
      totalFieldsCount: allFields.length,
      message: "Activity filter fields fetched successfully"
    });
  } catch (error) {
    console.error("Error fetching activity filter fields:", error);
    res.status(500).json({ 
      message: "Internal server error", 
      error: error.message 
    });
  }
};

