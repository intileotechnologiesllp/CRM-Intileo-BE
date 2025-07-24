const { Op } = require("sequelize");
const Sequelize = require("sequelize");
const Deal = require("../models/deals/dealsModels");
const Person = require("../models/leads/leadPersonModel");
const Organization = require("../models/leads/leadOrganizationModel");
const Lead = require("../models/leads/leadsModel");
const Activity = require("../models/activity/activityModel");
const Email = require("../models/email/emailModel");
const CustomField = require("../models/customFieldModel");
const CustomFieldValue = require("../models/customFieldValueModel");
const RecentSearch = require("../models/recentSearchModel");
const { sequelize } = require("../models");
const { cleanupDuplicateSearches } = require("../utils/recentSearchCleanup");

exports.globalSearch = async (req, res) => {
  try {
    const {
      q: searchTerm,
      types = "all", // all, deals, people, organizations, leads, activities, emails
      limit = 10,
      offset = 0,
      includeInactive = false,
      saveEmptySearches = false, // New parameter to control saving searches with no results
    } = req.query;

    if (!searchTerm || searchTerm.trim().length < 2) {
      return res.status(400).json({
        message: "Search term must be at least 2 characters long",
      });
    }

    const searchQuery = searchTerm.trim();
    const searchTypes =
      types === "all"
        ? ["deals", "people", "organizations", "leads", "activities", "emails"]
        : types.split(",").map((t) => t.trim());

    console.log("=== GLOBAL SEARCH DEBUG ===");
    console.log("Search term:", searchQuery);
    console.log("Search types:", searchTypes);
    console.log("Admin ID:", req.adminId);
    console.log("Request headers:", req.headers);
    console.log("Full query params:", req.query);

    // Test database connectivity and data availability
    try {
      console.log("=== DATABASE CONNECTIVITY TEST ===");
      const totalPeople = await Person.count({
        where: { masterUserID: req.adminId },
      });
      const totalLeads = await Lead.count({
        where: { masterUserID: req.adminId },
      });
      const totalDeals = await Deal.count({
        where: { masterUserID: req.adminId },
      });
      const totalOrganizations = await Organization.count({
        where: { masterUserID: req.adminId },
      });

      console.log("Total people for adminId", req.adminId, ":", totalPeople);
      console.log("Total leads for adminId", req.adminId, ":", totalLeads);
      console.log("Total deals for adminId", req.adminId, ":", totalDeals);
      console.log(
        "Total organizations for adminId",
        req.adminId,
        ":",
        totalOrganizations
      );

      // Check if we have any john data
      const johnInPeople = await Person.findAll({
        where: {
          contactPerson: { [Op.like]: `%john%` },
          masterUserID: req.adminId,
        },
        attributes: ["personId", "contactPerson", "email", "masterUserID"],
        limit: 5,
      });

      const johnInLeads = await Lead.findAll({
        where: {
          [Op.or]: [
            { title: { [Op.like]: `%john%` } },
            { contactPerson: { [Op.like]: `%john%` } },
            { email: { [Op.like]: `%john%` } },
          ],
          masterUserID: req.adminId,
        },
        attributes: [
          "leadId",
          "title",
          "contactPerson",
          "email",
          "masterUserID",
        ],
        limit: 5,
      });

      console.log(
        "John in people (case insensitive):",
        johnInPeople.length,
        johnInPeople.map((p) => ({
          contactPerson: p.contactPerson,
          email: p.email,
        }))
      );
      console.log(
        "John in leads (case insensitive):",
        johnInLeads.length,
        johnInLeads.map((l) => ({
          title: l.title,
          contactPerson: l.contactPerson,
          email: l.email,
        }))
      );
    } catch (dbError) {
      console.error("Database connectivity test failed:", dbError);
    }

    const results = {
      query: searchQuery,
      totalResults: 0,
      results: {
        deals: [],
        people: [],
        organizations: [],
        leads: [],
        activities: [],
        emails: [],
      },
      summary: {
        deals: 0,
        people: 0,
        organizations: 0,
        leads: 0,
        activities: 0,
        emails: 0,
      },
    };

    // Search in Deals
    if (searchTypes.includes("deals")) {
      try {
        const dealSearchConditions = {
          [Op.or]: [
            { title: { [Op.like]: `%${searchQuery}%` } },
            { pipeline: { [Op.like]: `%${searchQuery}%` } },
            { pipelineStage: { [Op.like]: `%${searchQuery}%` } },
            { sourceChannel: { [Op.like]: `%${searchQuery}%` } },
            { serviceType: { [Op.like]: `%${searchQuery}%` } },
            { projectLocation: { [Op.like]: `%${searchQuery}%` } },
            { organizationCountry: { [Op.like]: `%${searchQuery}%` } },
            { esplProposalNo: { [Op.like]: `%${searchQuery}%` } },
            { sourceOrgin: { [Op.like]: `%${searchQuery}%` } },
            // Search by value if it's a number
            ...(isNaN(searchQuery) ? [] : [{ value: parseFloat(searchQuery) }]),
          ],
          masterUserID: req.adminId,
        };

        if (!includeInactive) {
          dealSearchConditions.isArchived = false;
        }

        const deals = await Deal.findAll({
          where: dealSearchConditions,
          include: [
            {
              model: Person,
              as: "Person",
              attributes: ["personId", "contactPerson", "email", "phone"],
              required: false,
            },
            {
              model: Organization,
              as: "Organization",
              attributes: ["leadOrganizationId", "organization"], // Removed "email" as it doesn't exist
              required: false,
            },
          ],
          limit: parseInt(limit),
          offset: parseInt(offset),
          order: [["updatedAt", "DESC"]],
        });

        results.results.deals = deals.map((deal) => ({
          id: deal.dealId,
          dealId: deal.dealId, // Add explicit dealId field
          type: "deal",
          title: deal.title,
          subtitle: `${deal.pipeline} • ${deal.pipelineStage}`,
          value: deal.value,
          currency: deal.currency,
          status: deal.status,
          person: deal.Person
            ? {
                name: deal.Person.contactPerson,
                email: deal.Person.email,
                phone: deal.Person.phone,
              }
            : null,
          organization: deal.Organization
            ? {
                name: deal.Organization.organization,
                email: null, // Remove email as it doesn't exist in Organization table
              }
            : null,
          createdAt: deal.createdAt,
          updatedAt: deal.updatedAt,
          matchedFields: getMatchedFields(deal, searchQuery, [
            "title",
            "pipeline",
            "pipelineStage",
            "sourceChannel",
            "serviceType",
            "projectLocation",
            "organizationCountry",
            "esplProposalNo",
            "sourceOrgin",
          ]),
        }));

        results.summary.deals = deals.length;
      } catch (error) {
        console.error("Error searching deals:", error);
      }
    }

    // Search in People
    if (searchTypes.includes("people")) {
      try {
        console.log("=== PEOPLE SEARCH DEBUG ===");
        console.log("Searching for:", searchQuery);
        console.log("Admin ID for people search:", req.adminId);

        // First, let's check what people data exists for this user
        const allPeople = await Person.findAll({
          where: { masterUserID: req.adminId },
          attributes: [
            "personId",
            "contactPerson",
            "email",
            "phone",
            "jobTitle",
            "organization",
            "notes",
          ],
          limit: 5,
        });

        console.log(
          "All people for this user (first 5):",
          allPeople.map((p) => ({
            personId: p.personId,
            contactPerson: p.contactPerson,
            email: p.email,
            phone: p.phone,
            jobTitle: p.jobTitle,
            organization: p.organization,
            notes: p.notes,
          }))
        );

        // Use case-insensitive search for text fields (MySQL compatible)
        const peopleSearchConditions = {
          [Op.or]: [
            Sequelize.where(
              Sequelize.fn("LOWER", Sequelize.col("contactPerson")),
              "LIKE",
              `%${searchQuery.toLowerCase()}%`
            ),
            Sequelize.where(
              Sequelize.fn("LOWER", Sequelize.col("email")),
              "LIKE",
              `%${searchQuery.toLowerCase()}%`
            ),
            { phone: { [Op.like]: `%${searchQuery}%` } },
            Sequelize.where(
              Sequelize.fn("LOWER", Sequelize.col("jobTitle")),
              "LIKE",
              `%${searchQuery.toLowerCase()}%`
            ),
            Sequelize.where(
              Sequelize.fn("LOWER", Sequelize.col("organization")),
              "LIKE",
              `%${searchQuery.toLowerCase()}%`
            ),
            Sequelize.where(
              Sequelize.fn("LOWER", Sequelize.col("notes")),
              "LIKE",
              `%${searchQuery.toLowerCase()}%`
            ),
          ],
          masterUserID: req.adminId,
        };

        console.log(
          "People search conditions:",
          JSON.stringify(peopleSearchConditions, null, 2)
        );

        // Try search without includes first (simpler approach)
        let people = await Person.findAll({
          where: peopleSearchConditions,
          attributes: [
            "personId",
            "contactPerson",
            "email",
            "phone",
            "jobTitle",
            "organization",
            "notes",
            "createdAt",
            "updatedAt",
            "leadOrganizationId", // Include for potential organization lookup
          ],
          limit: parseInt(limit),
          offset: parseInt(offset),
          order: [["updatedAt", "DESC"]],
        });

        console.log("People search query executed successfully");
        console.log("People found:", people.length);

        if (people.length > 0) {
          console.log(
            "People data:",
            people.map((p) => ({
              id: p.personId,
              contactPerson: p.contactPerson,
              email: p.email,
              phone: p.phone,
              jobTitle: p.jobTitle,
              organization: p.organization,
              notes: p.notes,
              masterUserID: p.masterUserID,
            }))
          );
        } else {
          console.log("No people found matching the search criteria");

          // Let's try a simpler search to see if data exists
          const simplePeopleSearch = await Person.findAll({
            where: {
              masterUserID: req.adminId,
              contactPerson: { [Op.iLike]: `%${searchQuery}%` },
            },
            limit: 3,
          });

          console.log(
            "Simple contactPerson search results:",
            simplePeopleSearch.length
          );
          if (simplePeopleSearch.length > 0) {
            console.log(
              "Simple search found:",
              simplePeopleSearch.map((p) => ({
                personId: p.personId,
                contactPerson: p.contactPerson,
                masterUserID: p.masterUserID,
              }))
            );
          }
        }

        // For organizations, do a separate query if needed
        const organizationLookup = {};
        if (people.length > 0) {
          const orgIds = people
            .filter((p) => p.leadOrganizationId)
            .map((p) => p.leadOrganizationId);

          if (orgIds.length > 0) {
            try {
              const organizations = await Organization.findAll({
                where: { leadOrganizationId: { [Op.in]: orgIds } },
                attributes: ["leadOrganizationId", "organization"],
              });

              organizations.forEach((org) => {
                organizationLookup[org.leadOrganizationId] = org;
              });

              console.log(
                "Organization lookup completed:",
                Object.keys(organizationLookup).length
              );
            } catch (orgError) {
              console.warn("Organization lookup failed:", orgError.message);
            }
          }
        }

        results.results.people = people.map((person) => ({
          id: person.personId,
          personId: person.personId,
          type: "person",
          title: person.contactPerson,
          subtitle: person.jobTitle || person.organization || "Contact",
          email: person.email,
          phone: person.phone,
          jobTitle: person.jobTitle,
          organization: organizationLookup[person.leadOrganizationId]
            ? {
                name: organizationLookup[person.leadOrganizationId]
                  .organization,
                id: person.leadOrganizationId,
              }
            : person.organization
            ? { name: person.organization }
            : null,
          location: null,
          createdAt: person.createdAt,
          updatedAt: person.updatedAt,
          matchedFields: getMatchedFields(person, searchQuery, [
            "contactPerson",
            "email",
            "phone",
            "jobTitle",
            "organization",
            "notes",
          ]),
        }));

        results.summary.people = people.length;

        console.log("People search completed successfully");
        console.log("Final people results count:", people.length);
        console.log("Final people summary:", results.summary.people);
      } catch (error) {
        console.error("Error searching people:", error);
        console.error("Error details:", error.message);
        console.error("Error stack:", error.stack);

        // Fallback: try the most basic search possible
        try {
          console.log("Attempting fallback basic people search...");
          const basicPeople = await Person.findAll({
            where: {
              masterUserID: req.adminId,
              contactPerson: { [Op.like]: `%${searchQuery}%` },
            },
            limit: parseInt(limit),
          });

          results.results.people = basicPeople.map((person) => ({
            id: person.personId,
            personId: person.personId,
            type: "person",
            title: person.contactPerson,
            subtitle: "Contact",
            email: person.email,
            phone: person.phone,
            createdAt: person.createdAt,
            updatedAt: person.updatedAt,
            matchedFields: ["contactPerson"],
          }));

          results.summary.people = basicPeople.length;
          console.log(
            "Fallback search successful:",
            basicPeople.length,
            "results"
          );
        } catch (fallbackError) {
          console.error("Fallback search also failed:", fallbackError.message);
          results.results.people = [];
          results.summary.people = 0;
        }
      }
    }

    // Search in Organizations
    if (searchTypes.includes("organizations")) {
      try {
        const organizations = await Organization.findAll({
          where: {
            [Op.or]: [
              { organization: { [Op.like]: `%${searchQuery}%` } },
              { address: { [Op.like]: `%${searchQuery}%` } },
              // Removed columns that don't exist: email, phone, website, industry, city, country
            ],
            masterUserID: req.adminId,
          },
          limit: parseInt(limit),
          offset: parseInt(offset),
          order: [["updatedAt", "DESC"]],
        });

        results.results.organizations = organizations.map((org) => ({
          id: org.leadOrganizationId,
          leadOrganizationId: org.leadOrganizationId, // Add explicit leadOrganizationId field
          type: "organization",
          title: org.organization,
          subtitle: "Organization", // Removed industry as it doesn't exist
          email: null, // Removed as it doesn't exist
          phone: null, // Removed as it doesn't exist
          website: null, // Removed as it doesn't exist
          location: null, // Removed as city/country don't exist
          address: org.address,
          createdAt: org.createdAt,
          updatedAt: org.updatedAt,
          matchedFields: getMatchedFields(org, searchQuery, [
            "organization",
            "address",
            // Removed non-existent fields
          ]),
        }));

        results.summary.organizations = organizations.length;
      } catch (error) {
        console.error("Error searching organizations:", error);
      }
    }

    // Search in Leads
    if (searchTypes.includes("leads")) {
      try {
        console.log("=== LEADS SEARCH DEBUG ===");
        console.log("Searching for:", searchQuery);
        console.log("Admin ID for leads search:", req.adminId);

        const leadsSearchConditions = {
          [Op.or]: [
            { title: { [Op.like]: `%${searchQuery}%` } },
            { contactPerson: { [Op.like]: `%${searchQuery}%` } },
            { email: { [Op.like]: `%${searchQuery}%` } },
            { phone: { [Op.like]: `%${searchQuery}%` } },
            { organization: { [Op.like]: `%${searchQuery}%` } },
            { sourceChannel: { [Op.like]: `%${searchQuery}%` } },
            // Removed leadSource as it doesn't exist
            { status: { [Op.like]: `%${searchQuery}%` } },
          ],
          masterUserID: req.adminId,
        };

        console.log(
          "Leads search conditions:",
          JSON.stringify(leadsSearchConditions, null, 2)
        );

        const leads = await Lead.findAll({
          where: leadsSearchConditions,
          limit: parseInt(limit),
          offset: parseInt(offset),
          order: [["updatedAt", "DESC"]],
        });

        console.log("Leads found:", leads.length);
        console.log(
          "Leads data:",
          leads.map((l) => ({
            id: l.leadId,
            title: l.title,
            contactPerson: l.contactPerson,
            email: l.email,
            masterUserID: l.masterUserID,
          }))
        );

        results.results.leads = leads.map((lead) => ({
          id: lead.leadId,
          leadId: lead.leadId, // Add explicit leadId field
          type: "lead",
          title: lead.title,
          subtitle: `${lead.organization || "No Organization"} • ${
            lead.status
          }`,
          contactPerson: lead.contactPerson,
          email: lead.email,
          phone: lead.phone,
          organization: lead.organization,
          sourceChannel: lead.sourceChannel,
          leadSource: null, // Removed as it doesn't exist
          status: lead.status,
          createdAt: lead.createdAt,
          updatedAt: lead.updatedAt,
          matchedFields: getMatchedFields(lead, searchQuery, [
            "title",
            "contactPerson",
            "email",
            "phone",
            "organization",
            "sourceChannel",
            // Removed leadSource as it doesn't exist
            "status",
          ]),
        }));

        results.summary.leads = leads.length;
      } catch (error) {
        console.error("Error searching leads:", error);
        console.error("Error details:", error.message);
        console.error("Error stack:", error.stack);
      }
    }

    // Search in Activities
    if (searchTypes.includes("activities")) {
      try {
        const activities = await Activity.findAll({
          where: {
            [Op.or]: [
              { subject: { [Op.like]: `%${searchQuery}%` } },
              { description: { [Op.like]: `%${searchQuery}%` } },
              { type: { [Op.like]: `%${searchQuery}%` } },
              { location: { [Op.like]: `%${searchQuery}%` } },
            ],
            masterUserID: req.adminId,
          },
          limit: parseInt(limit),
          offset: parseInt(offset),
          order: [["startDateTime", "DESC"]],
        });

        results.results.activities = activities.map((activity) => ({
          id: activity.activityId,
          activityId: activity.activityId, // Add explicit activityId field
          type: "activity",
          title: activity.subject,
          subtitle: `${activity.type} • ${
            activity.startDateTime
              ? new Date(activity.startDateTime).toLocaleDateString()
              : "No Date"
          }`,
          description: activity.description,
          activityType: activity.type,
          location: activity.location,
          startDateTime: activity.startDateTime,
          endDateTime: activity.endDateTime,
          dealId: activity.dealId,
          leadId: activity.leadId,
          createdAt: activity.createdAt,
          updatedAt: activity.updatedAt,
          matchedFields: getMatchedFields(activity, searchQuery, [
            "subject",
            "description",
            "type",
            "location",
          ]),
        }));

        results.summary.activities = activities.length;
      } catch (error) {
        console.error("Error searching activities:", error);
      }
    }

    // Search in Emails
    if (searchTypes.includes("emails")) {
      try {
        const emails = await Email.findAll({
          where: {
            [Op.or]: [
              { subject: { [Op.like]: `%${searchQuery}%` } },
              { sender: { [Op.like]: `%${searchQuery}%` } },
              { senderName: { [Op.like]: `%${searchQuery}%` } },
              { recipient: { [Op.like]: `%${searchQuery}%` } },
              { body: { [Op.like]: `%${searchQuery}%` } },
            ],
            masterUserID: req.adminId,
          },
          attributes: [
            "emailID",
            "subject",
            "sender",
            "senderName",
            "recipient",
            "createdAt",
            "updatedAt",
            "dealId",
            "leadId",
            "isRead",
          ],
          limit: parseInt(limit),
          offset: parseInt(offset),
          order: [["createdAt", "DESC"]],
        });

        results.results.emails = emails.map((email) => ({
          id: email.emailID,
          emailID: email.emailID, // Add explicit emailID field
          type: "email",
          title: email.subject || "No Subject",
          subtitle: `From: ${email.senderName || email.sender} • To: ${
            email.recipient
          }`,
          sender: email.sender,
          senderName: email.senderName,
          recipient: email.recipient,
          isRead: email.isRead,
          dealId: email.dealId,
          leadId: email.leadId,
          createdAt: email.createdAt,
          updatedAt: email.updatedAt,
          matchedFields: getMatchedFields(email, searchQuery, [
            "subject",
            "sender",
            "senderName",
            "recipient",
          ]),
        }));

        results.summary.emails = emails.length;
      } catch (error) {
        console.error("Error searching emails:", error);
      }
    }

    // Search in Custom Fields
    if (searchTypes.includes("all") || searchTypes.includes("custom")) {
      try {
        const customFieldValues = await CustomFieldValue.findAll({
          where: {
            value: { [Op.like]: `%${searchQuery}%` },
            masterUserID: req.adminId,
          },
          include: [
            {
              model: CustomField,
              as: "CustomField",
              attributes: ["fieldName", "fieldLabel", "entityType"],
            },
          ],
          limit: parseInt(limit),
          offset: parseInt(offset),
          order: [["updatedAt", "DESC"]],
        });

        // Group custom field matches by entity
        const customFieldMatches = {};
        customFieldValues.forEach((cfv) => {
          const entityType = cfv.CustomField.entityType;
          if (!customFieldMatches[entityType]) {
            customFieldMatches[entityType] = [];
          }
          customFieldMatches[entityType].push({
            entityId: cfv.entityId,
            fieldName: cfv.CustomField.fieldName,
            fieldLabel: cfv.CustomField.fieldLabel,
            value: cfv.value,
          });
        });

        // Add custom field matches to results
        results.customFieldMatches = customFieldMatches;
      } catch (error) {
        console.error("Error searching custom fields:", error);
      }
    }

    // Calculate total results
    results.totalResults = Object.values(results.summary).reduce(
      (sum, count) => sum + count,
      0
    );

    // Add search metadata
    results.metadata = {
      searchTerm: searchQuery,
      searchTypes: searchTypes,
      limit: parseInt(limit),
      offset: parseInt(offset),
      includeInactive: includeInactive,
      saveEmptySearches: saveEmptySearches,
      executionTime: Date.now() - Date.now(), // This would be calculated properly
      hasMore: results.totalResults >= parseInt(limit),
    };

    console.log("=== SEARCH RESULTS SUMMARY ===");
    console.log("Total results:", results.totalResults);
    console.log("Results by type:", results.summary);

    // Only save recent search if there are actual results OR if saveEmptySearches is enabled
    const shouldSaveSearch =
      results.totalResults > 0 ||
      saveEmptySearches === "true" ||
      saveEmptySearches === true;

    if (shouldSaveSearch) {
      saveRecentSearch(
        req.adminId,
        searchQuery,
        searchTypes,
        results.totalResults,
        results // Pass the full results object
      );
    } else {
      console.log(
        "No results found and saveEmptySearches is disabled - not saving to recent searches"
      );
    }

    res.status(200).json(results);
  } catch (error) {
    console.error("Global search error:", error);
    res.status(500).json({
      message: "Internal server error during search",
      error: error.message,
    });
  }
};

// Helper function to identify which fields matched the search
function getMatchedFields(record, searchQuery, fieldsToCheck) {
  const matchedFields = [];
  const lowerSearchQuery = searchQuery.toLowerCase();

  fieldsToCheck.forEach((field) => {
    const fieldValue = record[field];
    if (
      fieldValue &&
      typeof fieldValue === "string" &&
      fieldValue.toLowerCase().includes(lowerSearchQuery)
    ) {
      matchedFields.push(field);
    }
  });

  return matchedFields;
}

// Helper function to save recent search
async function saveRecentSearch(
  adminId,
  searchTerm,
  searchTypes,
  resultsCount,
  searchResults = null
) {
  try {
    // Check if this exact search was already performed recently (within last hour)
    const recentSearch = await RecentSearch.findOne({
      where: {
        masterUserID: adminId,
        searchTerm: searchTerm,
        searchedAt: {
          [Op.gte]: new Date(Date.now() - 60 * 60 * 1000), // Last hour
        },
      },
    });

    // Prepare results data for storage (limit to prevent database overflow)
    const resultsData = searchResults
      ? {
          summary: searchResults.summary,
          results: {
            deals: searchResults.results.deals.slice(0, 5), // Store only top 5 results per type
            people: searchResults.results.people.slice(0, 5),
            organizations: searchResults.results.organizations.slice(0, 5),
            leads: searchResults.results.leads.slice(0, 5),
            activities: searchResults.results.activities.slice(0, 3),
            emails: searchResults.results.emails.slice(0, 3),
          },
        }
      : null;

    if (recentSearch) {
      // Update existing recent search
      await recentSearch.update({
        searchTypes: JSON.stringify(searchTypes),
        resultsCount: resultsCount,
        searchResults: resultsData ? JSON.stringify(resultsData) : null,
        searchedAt: new Date(),
      });
    } else {
      // Create new recent search
      await RecentSearch.create({
        masterUserID: adminId,
        searchTerm: searchTerm,
        searchTypes: JSON.stringify(searchTypes),
        resultsCount: resultsCount,
        searchResults: resultsData ? JSON.stringify(resultsData) : null,
        searchedAt: new Date(),
      });
    }

    // Clean up old searches (keep only last 50 searches per user)
    const recentSearches = await RecentSearch.findAll({
      where: { masterUserID: adminId },
      order: [["searchedAt", "DESC"]],
      limit: 50,
    });

    if (recentSearches.length === 50) {
      const oldestKeptSearch = recentSearches[recentSearches.length - 1];
      await RecentSearch.destroy({
        where: {
          masterUserID: adminId,
          searchedAt: {
            [Op.lt]: oldestKeptSearch.searchedAt,
          },
        },
      });
    }

    // Periodically clean up duplicates (every 10th search)
    if (Math.random() < 0.1) {
      // 10% chance
      try {
        await cleanupDuplicateSearches(adminId);
      } catch (duplicateCleanupError) {
        console.warn(
          "Failed to cleanup duplicate searches:",
          duplicateCleanupError.message
        );
      }
    }
  } catch (error) {
    console.error("Error saving recent search:", error);
    // Don't throw error as this is not critical for the main search functionality
  }
}

// Get search suggestions/autocomplete
exports.getSearchSuggestions = async (req, res) => {
  try {
    const { q: searchTerm, limit = 5 } = req.query;

    if (!searchTerm || searchTerm.trim().length < 2) {
      return res.status(400).json({
        message: "Search term must be at least 2 characters long",
      });
    }

    const suggestions = [];

    // Get deal titles
    const deals = await Deal.findAll({
      where: {
        title: { [Op.like]: `%${searchTerm}%` },
        masterUserID: req.adminId,
      },
      attributes: ["title"],
      limit: parseInt(limit),
      order: [["updatedAt", "DESC"]],
    });

    deals.forEach((deal) => {
      suggestions.push({
        text: deal.title,
        type: "deal",
        category: "Deals",
      });
    });

    // Get person names
    const people = await Person.findAll({
      where: {
        contactPerson: { [Op.like]: `%${searchTerm}%` },
        masterUserID: req.adminId,
      },
      attributes: ["contactPerson"],
      limit: parseInt(limit),
      order: [["updatedAt", "DESC"]],
    });

    people.forEach((person) => {
      suggestions.push({
        text: person.contactPerson,
        type: "person",
        category: "People",
      });
    });

    // Get organization names
    const organizations = await Organization.findAll({
      where: {
        organization: { [Op.like]: `%${searchTerm}%` },
        masterUserID: req.adminId,
      },
      attributes: ["organization"],
      limit: parseInt(limit),
      order: [["updatedAt", "DESC"]],
    });

    organizations.forEach((org) => {
      suggestions.push({
        text: org.organization,
        type: "organization",
        category: "Organizations",
      });
    });

    // Remove duplicates and limit results
    const uniqueSuggestions = suggestions
      .filter(
        (item, index, self) =>
          index ===
          self.findIndex((s) => s.text === item.text && s.type === item.type)
      )
      .slice(0, parseInt(limit));

    res.status(200).json({
      query: searchTerm,
      suggestions: uniqueSuggestions,
    });
  } catch (error) {
    console.error("Search suggestions error:", error);
    res.status(500).json({
      message: "Internal server error during search suggestions",
      error: error.message,
    });
  }
};

// Get recent searches
exports.getRecentSearches = async (req, res) => {
  try {
    const {
      limit = 10,
      includeEmptySearches = false, // New parameter to include/exclude searches with 0 results
    } = req.query;

    console.log("=== GET RECENT SEARCHES ===");
    console.log("Admin ID:", req.adminId);
    console.log("Limit:", limit);
    console.log("Include empty searches:", includeEmptySearches);

    // Build where condition
    const whereCondition = {
      masterUserID: req.adminId,
    };

    // Exclude searches with zero results unless explicitly requested
    if (includeEmptySearches !== "true" && includeEmptySearches !== true) {
      whereCondition.resultsCount = {
        [Op.gt]: 0,
      };
    }

    // Get recent searches for the current user
    const recentSearches = await RecentSearch.findAll({
      where: whereCondition,
      order: [["searchedAt", "DESC"]],
      limit: parseInt(limit),
      attributes: [
        "id",
        "searchTerm",
        "searchTypes",
        "resultsCount",
        "searchResults",
        "searchedAt",
      ],
    });

    console.log("Recent searches found:", recentSearches.length);

    // Format the response
    const formattedSearches = recentSearches.map((search) => {
      // Parse search results if they exist
      let parsedResults = null;
      if (search.searchResults) {
        try {
          parsedResults = JSON.parse(search.searchResults);
        } catch (error) {
          console.warn(
            "Failed to parse search results for search ID:",
            search.id
          );
        }
      }

      // Parse searchTypes properly
      let parsedSearchTypes = ["all"];
      if (search.searchTypes) {
        try {
          // If it's already an array, use it as is
          if (Array.isArray(search.searchTypes)) {
            parsedSearchTypes = search.searchTypes;
          }
          // If it's a string, try to parse it as JSON
          else if (typeof search.searchTypes === "string") {
            parsedSearchTypes = JSON.parse(search.searchTypes);
          }
        } catch (error) {
          console.warn(
            "Failed to parse search types for search ID:",
            search.id,
            "Value:",
            search.searchTypes
          );
          // Fallback to default
          parsedSearchTypes = ["all"];
        }
      }

      return {
        id: search.id,
        searchTerm: search.searchTerm,
        searchTypes: parsedSearchTypes,
        resultsCount: search.resultsCount,
        searchResults: parsedResults,
        searchedAt: search.searchedAt,
        timeAgo: getTimeAgo(search.searchedAt),
      };
    });

    // Group by date for better UX
    const groupedSearches = groupSearchesByDate(formattedSearches);

    res.status(200).json({
      recentSearches: formattedSearches,
      groupedSearches: groupedSearches,
      totalCount: recentSearches.length,
      metadata: {
        adminId: req.adminId,
        limit: parseInt(limit),
        includeEmptySearches: includeEmptySearches,
        hasMore: recentSearches.length >= parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Recent searches error:", error);
    res.status(500).json({
      message: "Internal server error getting recent searches",
      error: error.message,
    });
  }
};

// Helper function to get time ago string
function getTimeAgo(date) {
  const now = new Date();
  const searchDate = new Date(date);
  const diffInMs = now - searchDate;
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMinutes < 1) {
    return "Just now";
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes > 1 ? "s" : ""} ago`;
  } else if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`;
  } else if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`;
  } else {
    return searchDate.toLocaleDateString();
  }
}

// Helper function to group searches by date
function groupSearchesByDate(searches) {
  const grouped = {};

  searches.forEach((search) => {
    const searchDate = new Date(search.searchedAt);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let groupKey;
    if (searchDate.toDateString() === today.toDateString()) {
      groupKey = "Today";
    } else if (searchDate.toDateString() === yesterday.toDateString()) {
      groupKey = "Yesterday";
    } else {
      groupKey = searchDate.toLocaleDateString();
    }

    if (!grouped[groupKey]) {
      grouped[groupKey] = [];
    }

    grouped[groupKey].push(search);
  });

  return grouped;
}

// Clear recent searches
exports.clearRecentSearches = async (req, res) => {
  try {
    const { searchId } = req.params;

    console.log("=== CLEAR RECENT SEARCHES ===");
    console.log("Admin ID:", req.adminId);
    console.log("Search ID:", searchId);

    if (searchId && searchId !== "undefined") {
      // Clear specific search
      const deleted = await RecentSearch.destroy({
        where: {
          id: parseInt(searchId),
          masterUserID: req.adminId,
        },
      });

      if (deleted === 0) {
        return res.status(404).json({
          message: "Recent search not found",
        });
      }

      res.status(200).json({
        message: "Recent search cleared successfully",
        deletedCount: deleted,
      });
    } else {
      // Clear all searches for the user
      const deleted = await RecentSearch.destroy({
        where: {
          masterUserID: req.adminId,
        },
      });

      res.status(200).json({
        message: "All recent searches cleared successfully",
        deletedCount: deleted,
      });
    }
  } catch (error) {
    console.error("Clear recent searches error:", error);
    res.status(500).json({
      message: "Error clearing recent searches",
      error: error.message,
    });
  }
};

// Get recent search statistics
exports.getRecentSearchStats = async (req, res) => {
  try {
    const { getRecentSearchStats } = require("../utils/recentSearchCleanup");

    console.log("=== GET RECENT SEARCH STATS ===");
    console.log("Admin ID:", req.adminId);

    // Get overall stats
    const overallStats = await getRecentSearchStats();

    // Get user-specific stats
    const userStats = await RecentSearch.findAll({
      where: { masterUserID: req.adminId },
      attributes: [
        [
          RecentSearch.sequelize.fn("COUNT", RecentSearch.sequelize.col("id")),
          "totalSearches",
        ],
        [
          RecentSearch.sequelize.fn(
            "COUNT",
            RecentSearch.sequelize.fn(
              "DISTINCT",
              RecentSearch.sequelize.col("searchTerm")
            )
          ),
          "uniqueTerms",
        ],
        [
          RecentSearch.sequelize.fn(
            "MAX",
            RecentSearch.sequelize.col("searchedAt")
          ),
          "lastSearch",
        ],
        [
          RecentSearch.sequelize.fn(
            "MIN",
            RecentSearch.sequelize.col("searchedAt")
          ),
          "firstSearch",
        ],
      ],
      raw: true,
    });

    // Get most frequent search terms for this user
    const topSearchTerms = await RecentSearch.findAll({
      where: { masterUserID: req.adminId },
      attributes: [
        "searchTerm",
        [
          RecentSearch.sequelize.fn(
            "COUNT",
            RecentSearch.sequelize.col("searchTerm")
          ),
          "frequency",
        ],
        [
          RecentSearch.sequelize.fn(
            "MAX",
            RecentSearch.sequelize.col("searchedAt")
          ),
          "lastUsed",
        ],
      ],
      group: ["searchTerm"],
      order: [
        [
          RecentSearch.sequelize.fn(
            "COUNT",
            RecentSearch.sequelize.col("searchTerm")
          ),
          "DESC",
        ],
      ],
      limit: 10,
      raw: true,
    });

    res.status(200).json({
      userStats: userStats[0] || {
        totalSearches: 0,
        uniqueTerms: 0,
        lastSearch: null,
        firstSearch: null,
      },
      topSearchTerms,
      overallStats,
      adminId: req.adminId,
    });
  } catch (error) {
    console.error("Get recent search stats error:", error);
    res.status(500).json({
      message: "Error getting recent search statistics",
      error: error.message,
    });
  }
};

// Clean up searches with zero results
exports.cleanupEmptySearches = async (req, res) => {
  try {
    console.log("=== CLEANUP EMPTY SEARCHES ===");
    console.log("Admin ID:", req.adminId);

    // Remove searches with zero results for the current user
    const deleted = await RecentSearch.destroy({
      where: {
        masterUserID: req.adminId,
        resultsCount: 0,
      },
    });

    console.log("Deleted empty searches:", deleted);

    res.status(200).json({
      message: "Empty searches cleaned up successfully",
      deletedCount: deleted,
      adminId: req.adminId,
    });
  } catch (error) {
    console.error("Cleanup empty searches error:", error);
    res.status(500).json({
      message: "Error cleaning up empty searches",
      error: error.message,
    });
  }
};

// Manual cleanup of recent searches
exports.cleanupRecentSearches = async (req, res) => {
  try {
    const {
      daysToKeep = 30,
      maxPerUser = 50,
      cleanupDuplicates = true,
      userOnly = true,
    } = req.body;

    console.log("=== MANUAL RECENT SEARCH CLEANUP ===");
    console.log("Admin ID:", req.adminId);
    console.log("Days to keep:", daysToKeep);
    console.log("Max per user:", maxPerUser);
    console.log("Cleanup duplicates:", cleanupDuplicates);
    console.log("User only:", userOnly);

    const {
      cleanupRecentSearches,
      cleanupDuplicateSearches,
    } = require("../utils/recentSearchCleanup");

    let results = {
      oldSearchesDeleted: 0,
      duplicatesDeleted: 0,
      totalDeleted: 0,
    };

    // Clean up old searches
    const cleanupResult = await cleanupRecentSearches({
      daysToKeep,
      maxPerUser,
      adminId: userOnly ? req.adminId : null,
    });

    if (cleanupResult.success) {
      results.oldSearchesDeleted = cleanupResult.deletedCount;
      results.totalDeleted += cleanupResult.deletedCount;
    }

    // Clean up duplicates if requested
    if (cleanupDuplicates) {
      const duplicateResult = await cleanupDuplicateSearches(req.adminId);
      if (duplicateResult.success) {
        results.duplicatesDeleted = duplicateResult.deletedCount;
        results.totalDeleted += duplicateResult.deletedCount;
      }
    }

    res.status(200).json({
      message: "Recent search cleanup completed successfully",
      results,
      settings: {
        daysToKeep,
        maxPerUser,
        cleanupDuplicates,
        userOnly,
      },
    });
  } catch (error) {
    console.error("Manual cleanup recent searches error:", error);
    res.status(500).json({
      message: "Error during recent search cleanup",
      error: error.message,
    });
  }
};

// Test endpoint for debugging person search issues
exports.testPersonSearch = async (req, res) => {
  try {
    const { searchTerm = "john", adminId } = req.query;
    const userAdminId = adminId || req.adminId;

    console.log("=== PERSON SEARCH TEST ===");
    console.log("Search term:", searchTerm);
    console.log("Admin ID:", userAdminId);

    // Test 1: Check database connection
    const { sequelize } = require("../models");

    // Test 2: Count total people
    const totalPeople = await Person.count({
      where: { masterUserID: userAdminId },
    });

    // Test 3: Get sample people
    const samplePeople = await Person.findAll({
      where: { masterUserID: userAdminId },
      limit: 5,
      attributes: [
        "personId",
        "contactPerson",
        "email",
        "phone",
        "jobTitle",
        "organization",
      ],
    });

    // Test 4: Basic search
    const basicSearch = await Person.findAll({
      where: {
        masterUserID: userAdminId,
        contactPerson: { [Op.like]: `%${searchTerm}%` },
      },
      limit: 10,
    });

    // Test 5: Case-insensitive search (if database supports it)
    let caseInsensitiveSearch = [];
    try {
      caseInsensitiveSearch = await Person.findAll({
        where: {
          masterUserID: userAdminId,
          contactPerson: { [Op.iLike]: `%${searchTerm}%` },
        },
        limit: 10,
      });
    } catch (iLikeError) {
      console.log("iLike not supported, trying LOWER function");
      // Fallback for databases that don't support iLike
      try {
        caseInsensitiveSearch = await Person.findAll({
          where: {
            masterUserID: userAdminId,
            [Op.where]: [
              sequelize.fn("LOWER", sequelize.col("contactPerson")),
              { [Op.like]: `%${searchTerm.toLowerCase()}%` },
            ],
          },
          limit: 10,
        });
      } catch (lowerError) {
        console.log("LOWER function also failed, using basic search");
        caseInsensitiveSearch = basicSearch;
      }
    }

    // Test 6: Multiple field search
    const multiFieldSearch = await Person.findAll({
      where: {
        masterUserID: userAdminId,
        [Op.or]: [
          { contactPerson: { [Op.like]: `%${searchTerm}%` } },
          { email: { [Op.like]: `%${searchTerm}%` } },
          { organization: { [Op.like]: `%${searchTerm}%` } },
        ],
      },
      limit: 10,
    });

    res.json({
      testResults: {
        totalPeople,
        samplePeople: samplePeople.map((p) => ({
          personId: p.personId,
          contactPerson: p.contactPerson,
          email: p.email,
          organization: p.organization,
        })),
        basicSearch: basicSearch.length,
        caseInsensitiveSearch: caseInsensitiveSearch.length,
        multiFieldSearch: multiFieldSearch.length,
        basicSearchResults: basicSearch.map((p) => ({
          personId: p.personId,
          contactPerson: p.contactPerson,
          email: p.email,
        })),
        caseInsensitiveSearchResults: caseInsensitiveSearch.map((p) => ({
          personId: p.personId,
          contactPerson: p.contactPerson,
          email: p.email,
        })),
        multiFieldSearchResults: multiFieldSearch.map((p) => ({
          personId: p.personId,
          contactPerson: p.contactPerson,
          email: p.email,
          organization: p.organization,
        })),
      },
      searchConfig: {
        searchTerm,
        adminId: userAdminId,
        databaseDialect: "mysql",
      },
    });
  } catch (error) {
    console.error("Person search test error:", error);
    res.status(500).json({
      error: error.message,
      stack: error.stack,
    });
  }
};
