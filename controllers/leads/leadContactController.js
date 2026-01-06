// Update check status for organization columns and custom fields
exports.updateOrganizationColumnChecks = async (req, res) => {
  const {OrganizationColumnPreference, CustomField,  } = req.models;
  // Expecting: { columns: [ { key: "columnName", check: true/false }, ... ] }
  const { columns } = req.body;

  if (!Array.isArray(columns)) {
    return res.status(400).json({ message: "Columns array is required." });
  }

  try {
    const { Op } = require("sequelize");

    // Find the global OrganizationColumnPreference record
    let pref = await OrganizationColumnPreference.findOne();
    if (!pref) {
      return res.status(404).json({ message: "Preferences not found." });
    }

    // Parse columns if stored as string
    let prefColumns =
      typeof pref.columns === "string"
        ? JSON.parse(pref.columns)
        : pref.columns;

    // Get custom fields to validate incoming custom field columns
    let customFields = [];
    if (req.adminId) {
      try {
        customFields = await CustomField.findAll({
          where: {
            entityType: { [Op.in]: ["organization", "both"] },
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
            "check",
          ],
        });
      } catch (customFieldError) {
        console.error("Error fetching custom fields:", customFieldError);
      }
    }

    // Create a map of custom field names for quick lookup
    const customFieldMap = {};
    customFields.forEach((field) => {
      customFieldMap[field.fieldName] = {
        fieldId: field.fieldId,
        fieldLabel: field.fieldLabel,
        fieldType: field.fieldType,
        isRequired: field.isRequired,
        isImportant: field.isImportant,
        fieldSource: field.fieldSource,
        entityType: field.entityType,
      };
    });

    // Update check status for existing columns
    prefColumns = prefColumns.map((col) => {
      const found = columns.find((c) => c.key === col.key);
      if (found) {
        return { ...col, check: !!found.check };
      }
      return col;
    });

    // Handle new custom field columns that don't exist in preferences yet
    const existingKeys = new Set(prefColumns.map((col) => col.key));

    columns.forEach((incomingCol) => {
      // If this column doesn't exist in preferences but is a custom field, add it
      if (
        !existingKeys.has(incomingCol.key) &&
        customFieldMap[incomingCol.key]
      ) {
        const customFieldInfo = customFieldMap[incomingCol.key];
        prefColumns.push({
          key: incomingCol.key,
          label: customFieldInfo.fieldLabel,
          type: customFieldInfo.fieldType,
          isCustomField: true,
          fieldId: customFieldInfo.fieldId,
          isRequired: customFieldInfo.isRequired,
          isImportant: customFieldInfo.isImportant,
          fieldSource: customFieldInfo.fieldSource,
          entityType: customFieldInfo.entityType,
          check: !!incomingCol.check,
        });
      }
    });

    // Update check field in CustomField table for custom fields
    const customFieldUpdates = [];
    columns.forEach((incomingCol) => {
      if (customFieldMap[incomingCol.key]) {
        const customField = customFields.find(
          (f) => f.fieldName === incomingCol.key
        );
        if (customField && customField.check !== !!incomingCol.check) {
          customFieldUpdates.push({
            fieldId: customField.fieldId,
            check: !!incomingCol.check,
          });
        }
      }
    });

    // Perform bulk update of CustomField check values
    if (customFieldUpdates.length > 0) {
      for (const update of customFieldUpdates) {
        await CustomField.update(
          { check: update.check },
          {
            where: {
              fieldId: update.fieldId,
              [Op.or]: [
                { masterUserID: req.adminId },
                { fieldSource: "default" },
                { fieldSource: "system" },
                { fieldSource: "custom" },
              ],
            },
          }
        );
      }
    }

    pref.columns = prefColumns;
    await pref.save();

    res.status(200).json({
      message: "Organization columns updated",
      columns: pref.columns,
      customFieldsProcessed: customFields.length,
      customFieldsUpdated: customFieldUpdates.length,
      totalColumns: prefColumns.length,
    });
  } catch (error) {
    console.error("Error updating organization columns:", error);
    res.status(500).json({ message: "Error updating organization columns" });
  }
};

// Update check status for person columns and custom fields, also updates organization columns
exports.updatePersonColumnChecks = async (req, res) => {
  const {OrganizationColumnPreference, CustomField, PersonColumnPreference } = req.models;
  // Expecting: { 
  //   columns: [ { key: "columnName", check: true/false, entityType?: "person"|"organization" }, ... ],
  //   entityType?: "person"|"organization" // Global entityType for all columns if not specified per column
  // }
  const { columns, entityType: globalEntityType } = req.body;

  if (!Array.isArray(columns)) {
    return res.status(400).json({ message: "Columns array is required." });
  }

  try {
  
    const { Op } = require("sequelize");

    // Separate columns by entityType
    const personColumns = [];
    const organizationColumns = [];

    columns.forEach(col => {
      const entityType = col.entityType || globalEntityType || "person"; // Default to person if not specified
      if (entityType === "organization") {
        organizationColumns.push(col);
      } else {
        personColumns.push(col);
      }
    });

    let results = {};

    // Process Person columns if any
    if (personColumns.length > 0) {
      // Find the global PersonColumnPreference record
      let personPref = await PersonColumnPreference.findOne();
      if (!personPref) {
        return res.status(404).json({ message: "Person preferences not found." });
      }

      // Parse person columns if stored as string
      let personPrefColumns =
        typeof personPref.columns === "string"
          ? JSON.parse(personPref.columns)
          : personPref.columns;

      // Get custom fields for person only to validate incoming custom field columns
      let personCustomFields = [];
      if (req.adminId) {
        try {
          // Get person custom fields only
          personCustomFields = await CustomField.findAll({
            where: {
              entityType: { [Op.in]: ["person", "both"] },
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
              "check",
            ],
          });
        } catch (customFieldError) {
          console.error("Error fetching person custom fields:", customFieldError);
        }
      }

      // Create map of person custom field names for quick lookup
      const personCustomFieldMap = {};
      personCustomFields.forEach((field) => {
        personCustomFieldMap[field.fieldName] = {
          fieldId: field.fieldId,
          fieldLabel: field.fieldLabel,
          fieldType: field.fieldType,
          isRequired: field.isRequired,
          isImportant: field.isImportant,
          fieldSource: field.fieldSource,
          entityType: field.entityType,
        };
      });

      // Update check status for existing person columns
      personPrefColumns = personPrefColumns.map((col) => {
        const found = personColumns.find((c) => c.key === col.key);
        if (found) {
          return { ...col, check: !!found.check };
        }
        return col;
      });

      // Handle new custom field columns that don't exist in person preferences yet
      const existingPersonKeys = new Set(personPrefColumns.map((col) => col.key));

      personColumns.forEach((incomingCol) => {
        // Add new person custom fields only
        if (
          !existingPersonKeys.has(incomingCol.key) &&
          personCustomFieldMap[incomingCol.key]
        ) {
          const customFieldInfo = personCustomFieldMap[incomingCol.key];
          personPrefColumns.push({
            key: incomingCol.key,
            label: customFieldInfo.fieldLabel,
            type: customFieldInfo.fieldType,
            isCustomField: true,
            fieldId: customFieldInfo.fieldId,
            isRequired: customFieldInfo.isRequired,
            isImportant: customFieldInfo.isImportant,
            fieldSource: customFieldInfo.fieldSource,
            entityType: customFieldInfo.entityType,
            check: !!incomingCol.check,
          });
        }
      });

      // Update check field in CustomField table for person custom fields only
      const personCustomFieldUpdates = [];
      personColumns.forEach((incomingCol) => {
        // Check person custom fields only
        if (personCustomFieldMap[incomingCol.key]) {
          const customField = personCustomFields.find(
            (f) => f.fieldName === incomingCol.key
          );
          if (customField && customField.check !== !!incomingCol.check) {
            personCustomFieldUpdates.push({
              fieldId: customField.fieldId,
              check: !!incomingCol.check,
            });
          }
        }
      });

      // Perform bulk update of CustomField check values for person fields only
      if (personCustomFieldUpdates.length > 0) {
        for (const update of personCustomFieldUpdates) {
          await CustomField.update(
            { check: update.check },
            {
              where: {
                fieldId: update.fieldId,
                entityType: { [Op.in]: ["person", "both"] },
                [Op.or]: [
                  { masterUserID: req.adminId },
                  { fieldSource: "default" },
                  { fieldSource: "system" },
                  { fieldSource: "custom" },
                ],
              },
            }
          );
        }
      }

      // Save person preferences only
      personPref.columns = personPrefColumns;
      await personPref.save();

      results.person = {
        columns: personPref.columns,
        customFieldsProcessed: personCustomFields.length,
        customFieldsUpdated: personCustomFieldUpdates.length,
        totalColumns: personPrefColumns.length,
      };
    }

    // Process Organization columns if any
    if (organizationColumns.length > 0) {
      // Find the global OrganizationColumnPreference record
      let orgPref = await OrganizationColumnPreference.findOne();
      if (!orgPref) {
        return res.status(404).json({ message: "Organization preferences not found." });
      }

      // Parse organization columns if stored as string
      let orgPrefColumns =
        typeof orgPref.columns === "string"
          ? JSON.parse(orgPref.columns)
          : orgPref.columns;

      // Get custom fields for organization only to validate incoming custom field columns
      let orgCustomFields = [];
      if (req.adminId) {
        try {
          // Get organization custom fields only
          orgCustomFields = await CustomField.findAll({
            where: {
              entityType: { [Op.in]: ["organization", "both"] },
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
              "check",
            ],
          });
        } catch (customFieldError) {
          console.error("Error fetching organization custom fields:", customFieldError);
        }
      }

      // Create map of organization custom field names for quick lookup
      const orgCustomFieldMap = {};
      orgCustomFields.forEach((field) => {
        orgCustomFieldMap[field.fieldName] = {
          fieldId: field.fieldId,
          fieldLabel: field.fieldLabel,
          fieldType: field.fieldType,
          isRequired: field.isRequired,
          isImportant: field.isImportant,
          fieldSource: field.fieldSource,
          entityType: field.entityType,
        };
      });

      // Update check status for existing organization columns
      orgPrefColumns = orgPrefColumns.map((col) => {
        const found = organizationColumns.find((c) => c.key === col.key);
        if (found) {
          return { ...col, check: !!found.check };
        }
        return col;
      });

      // Handle new custom field columns that don't exist in organization preferences yet
      const existingOrgKeys = new Set(orgPrefColumns.map((col) => col.key));

      organizationColumns.forEach((incomingCol) => {
        // Add new organization custom fields only
        if (
          !existingOrgKeys.has(incomingCol.key) &&
          orgCustomFieldMap[incomingCol.key]
        ) {
          const customFieldInfo = orgCustomFieldMap[incomingCol.key];
          orgPrefColumns.push({
            key: incomingCol.key,
            label: customFieldInfo.fieldLabel,
            type: customFieldInfo.fieldType,
            isCustomField: true,
            fieldId: customFieldInfo.fieldId,
            isRequired: customFieldInfo.isRequired,
            isImportant: customFieldInfo.isImportant,
            fieldSource: customFieldInfo.fieldSource,
            entityType: customFieldInfo.entityType,
            check: !!incomingCol.check,
          });
        }
      });

      // Update check field in CustomField table for organization custom fields only
      const orgCustomFieldUpdates = [];
      organizationColumns.forEach((incomingCol) => {
        // Check organization custom fields only
        if (orgCustomFieldMap[incomingCol.key]) {
          const customField = orgCustomFields.find(
            (f) => f.fieldName === incomingCol.key
          );
          if (customField && customField.check !== !!incomingCol.check) {
            orgCustomFieldUpdates.push({
              fieldId: customField.fieldId,
              check: !!incomingCol.check,
            });
          }
        }
      });

      // Perform bulk update of CustomField check values for organization fields only
      if (orgCustomFieldUpdates.length > 0) {
        for (const update of orgCustomFieldUpdates) {
          await CustomField.update(
            { check: update.check },
            {
              where: {
                fieldId: update.fieldId,
                entityType: { [Op.in]: ["organization", "both"] },
                [Op.or]: [
                  { masterUserID: req.adminId },
                  { fieldSource: "default" },
                  { fieldSource: "system" },
                  { fieldSource: "custom" },
                ],
              },
            }
          );
        }
      }

      // Save organization preferences only
      orgPref.columns = orgPrefColumns;
      await orgPref.save();

      results.organization = {
        columns: orgPref.columns,
        customFieldsProcessed: orgCustomFields.length,
        customFieldsUpdated: orgCustomFieldUpdates.length,
        totalColumns: orgPrefColumns.length,
      };
    }

    // Prepare response based on what was updated
    let message = "";
    if (personColumns.length > 0 && organizationColumns.length > 0) {
      message = "Person and organization columns updated successfully";
    } else if (personColumns.length > 0) {
      message = "Person columns updated successfully";
    } else if (organizationColumns.length > 0) {
      message = "Organization columns updated successfully";
    } else {
      message = "No columns to update";
    }

    res.status(200).json({
      message,
      results,
      totalPersonColumns: personColumns.length,
      totalOrganizationColumns: organizationColumns.length,
    });
  } catch (error) {
    console.error("Error updating columns:", error);
    res.status(500).json({ message: "Error updating columns" });
  }
};

// Update check status for person columns and custom fields ONLY (does not update organization columns)


exports.getOrganizationColumnPreference = async (req, res) => {
  const {OrganizationColumnPreference, CustomField, PersonColumnPreference } = req.models;
  try {
  
    const { Op } = require("sequelize");
    const pref = await OrganizationColumnPreference.findOne({ where: {} });

    let columns = [];
    if (pref) {
      columns = typeof pref.columns === "string" ? JSON.parse(pref.columns) : pref.columns;
    }

    // Optionally: parse filterConfig for each column if needed
    columns = columns.map((col) => {
      if (col.filterConfig) {
        col.filterConfig = typeof col.filterConfig === "string" ? JSON.parse(col.filterConfig) : col.filterConfig;
      }
      return col;
    });

    // Fetch custom fields for organizations (only if user is authenticated)
    let customFields = [];
    if (req.adminId) {
      try {
        customFields = await CustomField.findAll({
          where: {
            entityType: { [Op.in]: ["organization", "both"] },
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
            "check",
          ],
          order: [["fieldName", "ASC"]],
        });
      } catch (customFieldError) {
        console.error("Error fetching custom fields:", customFieldError);
      }
    } else {
      console.warn("No adminId found in request - skipping custom fields");
    }

    // Create a map of available custom field names from CustomFields table
    const availableCustomFieldNames = new Set(customFields.map(field => field.fieldName));

    // Filter out custom field columns that don't exist in CustomFields table
    const validColumns = columns.filter(col => {
      if (!col.fieldSource || col.fieldSource !== "custom") {
        return true;
      }
      const isValid = availableCustomFieldNames.has(col.key);
      if (!isValid) {
        console.log(`Removing invalid custom field from preferences: ${col.key}`);
      }
      return isValid;
    });

    columns = validColumns;

    // Format custom fields for column preferences
    const customFieldColumns = customFields.map((field) => ({
      key: field.fieldName,
      label: field.fieldLabel,
      type: field.fieldType,
      isCustomField: true,
      fieldId: field.fieldId,
      isRequired: field.isRequired,
      isImportant: field.isImportant,
      fieldSource: field.fieldSource,
      entityType: field.entityType,
      check: field.check || false,
    }));

    customFieldColumns.forEach((customCol) => {
      const existingCol = columns.find((col) => col.key === customCol.key);
      if (existingCol) {
        customCol.check = existingCol.check;
      }
    });

    const allColumns = [...columns, ...customFieldColumns];
    const uniqueColumns = [];
    const seenKeys = new Set();
    allColumns.forEach((col) => {
      if (!seenKeys.has(col.key)) {
        seenKeys.add(col.key);
        uniqueColumns.push(col);
      }
    });

    const originalColumnsCount = pref ? (typeof pref.columns === "string" ? JSON.parse(pref.columns).length : pref.columns.length) : 0;
    const filteredColumnsCount = columns.length;
    if (pref && originalColumnsCount > filteredColumnsCount) {
      try {
        pref.columns = uniqueColumns;
        await pref.save();
        console.log(`Updated preferences: removed ${originalColumnsCount - filteredColumnsCount} invalid custom fields`);
      } catch (saveError) {
        console.error("Error saving cleaned preferences:", saveError);
      }
    }

    res.status(200).json({
      columns: uniqueColumns,
      customFieldsCount: customFields.length,
      message: "Organization column preferences with custom fields fetched successfully",
      hasCustomFields: customFields.length > 0,
      userAuthenticated: !!req.adminId,
      cleanedInvalidFields: originalColumnsCount > filteredColumnsCount,
      removedFieldsCount: originalColumnsCount - filteredColumnsCount,
    });
  } catch (error) {
    console.error("Error fetching organization column preferences:", error);
    res.status(500).json({
      message: "Error fetching organization preferences",
      error: error.message,
      userAuthenticated: !!req.adminId,
    });
  }
};

// Get person column preferences with custom fields
exports.getPersonColumnPreference = async (req, res) => {
   const {OrganizationColumnPreference, CustomField, PersonColumnPreference } = req.models;
  try {
    const { Op } = require("sequelize");
    const pref = await PersonColumnPreference.findOne({ where: {} });

    let columns = [];
    if (pref) {
      columns = typeof pref.columns === "string" ? JSON.parse(pref.columns) : pref.columns;
    }

    // Optionally: parse filterConfig for each column if needed
    columns = columns.map((col) => {
      if (col.filterConfig) {
        col.filterConfig = typeof col.filterConfig === "string" ? JSON.parse(col.filterConfig) : col.filterConfig;
      }
      return col;
    });

    // Fetch custom fields for persons (only if user is authenticated)
    let customFields = [];
    if (req.adminId) {
      try {
        customFields = await CustomField.findAll({
          where: {
            entityType: { [Op.in]: ["person", "both"] },
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
            "check",
          ],
          order: [["fieldName", "ASC"]],
        });
      } catch (customFieldError) {
        console.error("Error fetching custom fields:", customFieldError);
      }
    } else {
      console.warn("No adminId found in request - skipping custom fields");
    }

    // Create a map of available custom field names from CustomFields table
    const availableCustomFieldNames = new Set(customFields.map(field => field.fieldName));

    // Filter out custom field columns that don't exist in CustomFields table
    const validColumns = columns.filter(col => {
      if (!col.fieldSource || col.fieldSource !== "custom") {
        return true;
      }
      const isValid = availableCustomFieldNames.has(col.key);
      if (!isValid) {
        console.log(`Removing invalid custom field from preferences: ${col.key}`);
      }
      return isValid;
    });

    columns = validColumns;

    // Format custom fields for column preferences
    const customFieldColumns = customFields.map((field) => ({
      key: field.fieldName,
      label: field.fieldLabel,
      type: field.fieldType,
      isCustomField: true,
      fieldId: field.fieldId,
      isRequired: field.isRequired,
      isImportant: field.isImportant,
      fieldSource: field.fieldSource,
      entityType: field.entityType,
      check: field.check || false,
    }));

    customFieldColumns.forEach((customCol) => {
      const existingCol = columns.find((col) => col.key === customCol.key);
      if (existingCol) {
        customCol.check = existingCol.check;
      }
    });

    const allColumns = [...columns, ...customFieldColumns];
    const uniqueColumns = [];
    const seenKeys = new Set();
    allColumns.forEach((col) => {
      if (!seenKeys.has(col.key)) {
        seenKeys.add(col.key);
        uniqueColumns.push(col);
      }
    });

    const originalColumnsCount = pref ? (typeof pref.columns === "string" ? JSON.parse(pref.columns).length : pref.columns.length) : 0;
    const filteredColumnsCount = columns.length;
    if (pref && originalColumnsCount > filteredColumnsCount) {
      try {
        pref.columns = uniqueColumns;
        await pref.save();
        console.log(`Updated preferences: removed ${originalColumnsCount - filteredColumnsCount} invalid custom fields`);
      } catch (saveError) {
        console.error("Error saving cleaned preferences:", saveError);
      }
    }

    res.status(200).json({
      columns: uniqueColumns,
      customFieldsCount: customFields.length,
      message: "Person column preferences with custom fields fetched successfully",
      hasCustomFields: customFields.length > 0,
      userAuthenticated: !!req.adminId,
      cleanedInvalidFields: originalColumnsCount > filteredColumnsCount,
      removedFieldsCount: originalColumnsCount - filteredColumnsCount,
    });
  } catch (error) {
    console.error("Error fetching person column preferences:", error);
    res.status(500).json({
      message: "Error fetching person preferences",
      error: error.message,
      userAuthenticated: !!req.adminId,
    });
  }
};

// Get both organization and person column preferences in separate arrays
exports.getBothColumnPreferences = async (req, res) => {
   const {OrganizationColumnPreference, CustomField, PersonColumnPreference } = req.models;
  try {
  
    const { Op } = require("sequelize");

    // Fetch organization preferences
    const orgPref = await OrganizationColumnPreference.findOne({ where: {} });
    let orgColumns = [];
    if (orgPref) {
      orgColumns = typeof orgPref.columns === "string" ? JSON.parse(orgPref.columns) : orgPref.columns;
    }

    // Fetch person preferences
    const personPref = await PersonColumnPreference.findOne({ where: {} });
    let personColumns = [];
    if (personPref) {
      personColumns = typeof personPref.columns === "string" ? JSON.parse(personPref.columns) : personPref.columns;
    }

    // Parse filterConfig for each column if needed and add entityType
    orgColumns = orgColumns.map((col) => {
      if (col.filterConfig) {
        col.filterConfig = typeof col.filterConfig === "string" ? JSON.parse(col.filterConfig) : col.filterConfig;
      }
      // Add entityType for organization columns
      col.entityType = "organization";
      return col;
    });

    personColumns = personColumns.map((col) => {
      if (col.filterConfig) {
        col.filterConfig = typeof col.filterConfig === "string" ? JSON.parse(col.filterConfig) : col.filterConfig;
      }
      // Add entityType for person columns
      col.entityType = "person";
      return col;
    });

    // Fetch custom fields for both organizations and persons (only if user is authenticated)
    let orgCustomFields = [];
    let personCustomFields = [];
    
    if (req.adminId) {
      try {
        // Organization custom fields
        orgCustomFields = await CustomField.findAll({
          where: {
            entityType: { [Op.in]: ["organization", "both"] },
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
            "check",
          ],
          order: [["fieldName", "ASC"]],
        });

        // Person custom fields
        personCustomFields = await CustomField.findAll({
          where: {
            entityType: { [Op.in]: ["person", "both"] },
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
            "check",
          ],
          order: [["fieldName", "ASC"]],
        });
      } catch (customFieldError) {
        console.error("Error fetching custom fields:", customFieldError);
      }
    } else {
      console.warn("No adminId found in request - skipping custom fields");
    }

    // Process organization columns
    const availableOrgCustomFieldNames = new Set(orgCustomFields.map(field => field.fieldName));
    const validOrgColumns = orgColumns.filter(col => {
      if (!col.fieldSource || col.fieldSource !== "custom") {
        return true;
      }
      const isValid = availableOrgCustomFieldNames.has(col.key);
      if (!isValid) {
        console.log(`Removing invalid organization custom field from preferences: ${col.key}`);
      }
      return isValid;
    });

    // Process person columns
    const availablePersonCustomFieldNames = new Set(personCustomFields.map(field => field.fieldName));
    const validPersonColumns = personColumns.filter(col => {
      if (!col.fieldSource || col.fieldSource !== "custom") {
        return true;
      }
      const isValid = availablePersonCustomFieldNames.has(col.key);
      if (!isValid) {
        console.log(`Removing invalid person custom field from preferences: ${col.key}`);
      }
      return isValid;
    });

    // Format organization custom fields for column preferences
    const orgCustomFieldColumns = orgCustomFields.map((field) => ({
      key: field.fieldName,
      label: field.fieldLabel,
      type: field.fieldType,
      isCustomField: true,
      fieldId: field.fieldId,
      isRequired: field.isRequired,
      isImportant: field.isImportant,
      fieldSource: field.fieldSource,
      entityType: "organization", // Set entityType as organization for org custom fields
      check: field.check || false,
    }));

    orgCustomFieldColumns.forEach((customCol) => {
      const existingCol = validOrgColumns.find((col) => col.key === customCol.key);
      if (existingCol) {
        customCol.check = existingCol.check;
      }
    });

    // Format person custom fields for column preferences
    const personCustomFieldColumns = personCustomFields.map((field) => ({
      key: field.fieldName,
      label: field.fieldLabel,
      type: field.fieldType,
      isCustomField: true,
      fieldId: field.fieldId,
      isRequired: field.isRequired,
      isImportant: field.isImportant,
      fieldSource: field.fieldSource,
      entityType: "person", // Set entityType as person for person custom fields
      check: field.check || false,
    }));

    personCustomFieldColumns.forEach((customCol) => {
      const existingCol = validPersonColumns.find((col) => col.key === customCol.key);
      if (existingCol) {
        customCol.check = existingCol.check;
      }
    });

    // Combine and deduplicate organization columns
    const allOrgColumns = [...validOrgColumns, ...orgCustomFieldColumns];
    const uniqueOrgColumns = [];
    const seenOrgKeys = new Set();
    allOrgColumns.forEach((col) => {
      if (!seenOrgKeys.has(col.key)) {
        seenOrgKeys.add(col.key);
        uniqueOrgColumns.push(col);
      }
    });

    // Combine and deduplicate person columns
    const allPersonColumns = [...validPersonColumns, ...personCustomFieldColumns];
    const uniquePersonColumns = [];
    const seenPersonKeys = new Set();
    allPersonColumns.forEach((col) => {
      if (!seenPersonKeys.has(col.key)) {
        seenPersonKeys.add(col.key);
        uniquePersonColumns.push(col);
      }
    });

    // Update preferences if needed (cleanup invalid fields)
    const originalOrgColumnsCount = orgPref ? (typeof orgPref.columns === "string" ? JSON.parse(orgPref.columns).length : orgPref.columns.length) : 0;
    const filteredOrgColumnsCount = validOrgColumns.length;
    if (orgPref && originalOrgColumnsCount > filteredOrgColumnsCount) {
      try {
        orgPref.columns = uniqueOrgColumns;
        await orgPref.save();
        console.log(`Updated organization preferences: removed ${originalOrgColumnsCount - filteredOrgColumnsCount} invalid custom fields`);
      } catch (saveError) {
        console.error("Error saving cleaned organization preferences:", saveError);
      }
    }

    const originalPersonColumnsCount = personPref ? (typeof personPref.columns === "string" ? JSON.parse(personPref.columns).length : personPref.columns.length) : 0;
    const filteredPersonColumnsCount = validPersonColumns.length;
    if (personPref && originalPersonColumnsCount > filteredPersonColumnsCount) {
      try {
        personPref.columns = uniquePersonColumns;
        await personPref.save();
        console.log(`Updated person preferences: removed ${originalPersonColumnsCount - filteredPersonColumnsCount} invalid custom fields`);
      } catch (saveError) {
        console.error("Error saving cleaned person preferences:", saveError);
      }
    }

    res.status(200).json({
      organizationColumns: uniqueOrgColumns,
      personColumns: uniquePersonColumns,
      organizationCustomFieldsCount: orgCustomFields.length,
      personCustomFieldsCount: personCustomFields.length,
      message: "Both organization and person column preferences with custom fields fetched successfully",
      hasOrganizationCustomFields: orgCustomFields.length > 0,
      hasPersonCustomFields: personCustomFields.length > 0,
      userAuthenticated: !!req.adminId,
      organizationCleanedInvalidFields: originalOrgColumnsCount > filteredOrgColumnsCount,
      organizationRemovedFieldsCount: originalOrgColumnsCount - filteredOrgColumnsCount,
      personCleanedInvalidFields: originalPersonColumnsCount > filteredPersonColumnsCount,
      personRemovedFieldsCount: originalPersonColumnsCount - filteredPersonColumnsCount,
    });
  } catch (error) {
    console.error("Error fetching both column preferences:", error);
    res.status(500).json({
      message: "Error fetching both column preferences",
      error: error.message,
      userAuthenticated: !!req.adminId,
    });
  }
};

// Save all organization fields with check status to OrganizationColumnPreference
exports.saveAllOrganizationFieldsWithCheck = async (req, res) => {
   const {OrganizationColumnPreference, CustomField, LeadOrganization } = req.models;
  let Organization;
  try {
    Organization = LeadOrganization
  } catch (e) {
    Organization = null;
  }

  // Get all field names from Organization model
  const orgFields = Organization ? Object.keys(Organization.rawAttributes) : [];
  // Exclude fields that are likely IDs (case-insensitive, ends with 'id' or is 'id')
  const filteredFieldNames = orgFields.filter(
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
    let pref = await OrganizationColumnPreference.findOne();
    if (!pref) {
      // Create the record if it doesn't exist
      pref = await OrganizationColumnPreference.create({ columns: columnsToSave });
    } else {
      // Update the existing record
      pref.columns = columnsToSave;
      await pref.save();
    }
    res
      .status(200)
      .json({ message: "All organization columns saved", columns: pref.columns });
  } catch (error) {
    console.log("Error saving all organization columns:", error);
    res.status(500).json({ message: "Error saving all organization columns" });
  }
};

// Save all person fields with check status to PersonColumnPreference
exports.saveAllPersonFieldsWithCheck = async (req, res) => {
  const {PersonColumnPreference, CustomField, LeadPerson } = req.models;
  let Person;
  try {
    Person = LeadPerson;
  } catch (e) {
    Person = null;
  }

  // Get all field names from Person model
  const personFields = Person ? Object.keys(Person.rawAttributes) : [];
  // Exclude fields that are likely IDs (case-insensitive, ends with 'id' or is 'id')
  const filteredFieldNames = personFields.filter(
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
    let pref = await PersonColumnPreference.findOne();
    if (!pref) {
      // Create the record if it doesn't exist
      pref = await PersonColumnPreference.create({ columns: columnsToSave });
    } else {
      // Update the existing record
      pref.columns = columnsToSave;
      await pref.save();
    }
    res
      .status(200)
      .json({ message: "All person columns saved", columns: pref.columns });
  } catch (error) {
    console.log("Error saving all person columns:", error);
    res.status(500).json({ message: "Error saving all person columns" });
  }
};
// Bulk update organizations with custom fields (accepts { leadOrganizationId: [], updateData: {} })
exports.bulkUpdateOrganizations = async (req, res) => {
  const {PersonColumnPreference, CustomField, CustomFieldValue, LeadOrganization } = req.models;
  const { leadOrganizationId, updateData } = req.body; // { leadOrganizationId: [1,2,3], updateData: { field1: value1, ... } }
  const adminId = req.adminId;
  const entityType = "organization";
  
  // Get the client connection from request (attached by middleware)
  const clientConnection = req.clientConnection;
  
  if (!clientConnection) {
    return res.status(500).json({
      message: "No database connection available. Please login again.",
    });
  }

  if (
    !Array.isArray(leadOrganizationId) ||
    leadOrganizationId.length === 0 ||
    !updateData ||
    typeof updateData !== "object" ||
    Object.keys(updateData).length === 0
  ) {
    return res.status(400).json({
      message:
        "'leadOrganizationId' array and 'updateData' object are required.",
    });
  }

  const results = [];
  // Get all organization model fields
  const orgFields = Object.keys(LeadOrganization.rawAttributes);
  for (const orgId of leadOrganizationId) {
    const fields = { ...updateData };
    const transaction = await clientConnection.transaction();
    try {
      // Admins can update any organization, others only their own
      let organization;
      if (req.role === "admin") {
        organization = await LeadOrganization.findOne({
          where: { leadOrganizationId: orgId },
          transaction,
        });
      } else {
        organization = await LeadOrganization.findOne({
          where: { leadOrganizationId: orgId, masterUserID: adminId },
          transaction,
        });
      }
      if (!organization) {
        await transaction.rollback();
        results.push({
          leadOrganizationId: orgId,
          success: false,
          error: "Organization not found.",
        });
        continue;
      }
      const updatedValues = [];
      const validationErrors = [];

      // Separate standard and custom fields
      const standardFieldUpdates = {};
      const customFieldUpdates = {};
      for (const [fieldKey, value] of Object.entries(fields)) {
        if (orgFields.includes(fieldKey)) {
          standardFieldUpdates[fieldKey] = value;
        } else {
          customFieldUpdates[fieldKey] = value;
        }
      }

      // Update standard fields if any
      if (Object.keys(standardFieldUpdates).length > 0) {
        await organization.update(standardFieldUpdates, { transaction });
        // Add updated standard fields to updatedValues for response
        for (const [fieldKey, value] of Object.entries(standardFieldUpdates)) {
          updatedValues.push({
            fieldName: fieldKey,
            value,
            isStandard: true,
          });
        }
      }

      // Update custom fields as before
      for (const [fieldKey, value] of Object.entries(customFieldUpdates)) {
        let customField;
        if (isNaN(fieldKey)) {
          customField = await CustomField.findOne({
            where: { fieldName: fieldKey, masterUserID: adminId, entityType },
            transaction,
          });
        } else {
          customField = await CustomField.findOne({
            where: { fieldId: fieldKey, masterUserID: adminId, entityType },
            transaction,
          });
        }
        if (!customField) continue;
        if (
          customField.isRequired &&
          (value === null || value === "" || value === undefined)
        ) {
          validationErrors.push(
            `Field \"${customField.fieldLabel}\" is required.`
          );
          continue;
        }
        let processedValue = value;
        if (
          customField.fieldType === "number" &&
          value !== null &&
          value !== ""
        ) {
          processedValue = parseFloat(value);
          if (isNaN(processedValue)) {
            validationErrors.push(
              `Invalid number value for field \"${customField.fieldLabel}\".`
            );
            continue;
          }
        }
        if (customField.fieldType === "email" && value) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            validationErrors.push(
              `Invalid email format for field \"${customField.fieldLabel}\".`
            );
            continue;
          }
        }
        if (customField.fieldType === "select" && customField.options) {
          const validOptions = Array.isArray(customField.options)
            ? customField.options
            : [];
          if (value && !validOptions.includes(value)) {
            validationErrors.push(
              `Invalid option \"${value}\" for field \"${customField.fieldLabel}\".`
            );
            continue;
          }
        }
        let fieldValue = await CustomFieldValue.findOne({
          where: {
            fieldId: customField.fieldId,
            entityId: orgId.toString(),
            entityType,
            masterUserID: adminId,
          },
          transaction,
        });
        if (fieldValue) {
          await fieldValue.update({ value: processedValue }, { transaction });
        } else {
          fieldValue = await CustomFieldValue.create(
            {
              fieldId: customField.fieldId,
              entityId: orgId.toString(),
              entityType,
              value: processedValue,
              masterUserID: adminId,
            },
            { transaction }
          );
        }
        updatedValues.push({
          fieldId: customField.fieldId,
          fieldName: customField.fieldName,
          fieldLabel: customField.fieldLabel,
          fieldType: customField.fieldType,
          value: processedValue,
          isRequired: customField.isRequired,
          isImportant: customField.isImportant,
        });
      }

      if (validationErrors.length > 0) {
        await transaction.rollback();
        results.push({
          leadOrganizationId: orgId,
          success: false,
          errors: validationErrors,
        });
        continue;
      }
      await transaction.commit();
      results.push({
        leadOrganizationId: orgId,
        success: true,
        updatedFields: updatedValues,
      });
    } catch (error) {
      await transaction.rollback();
      results.push({
        leadOrganizationId: orgId,
        success: false,
        error: error.message,
      });
    }
  }
  res.status(200).json({
    message: "Bulk update completed.",
    results,
    total: results.length,
    successCount: results.filter((r) => r.success).length,
    failureCount: results.filter((r) => !r.success).length,
  });
};

// Bulk update persons with custom fields (accepts { personId: [], updateData: {} })
exports.bulkUpdatePersons = async (req, res) => {
  const {PersonColumnPreference, CustomField, CustomFieldValue, LeadPerson } = req.models;
  const { personId, updateData } = req.body; // { personId: [1,2,3], updateData: { field1: value1, ... } }
  const adminId = req.adminId;
  const entityType = "person";

  // Get the client connection from request (attached by middleware)
  const clientConnection = req.clientConnection;
  
  if (!clientConnection) {
    return res.status(500).json({
      message: "No database connection available. Please login again.",
    });
  }

  if (
    !Array.isArray(personId) ||
    personId.length === 0 ||
    !updateData ||
    typeof updateData !== "object" ||
    Object.keys(updateData).length === 0
  ) {
    return res.status(400).json({
      message: "'personId' array and 'updateData' object are required.",
    });
  }

  const results = [];
  // Get all person model fields
  const personFields = Object.keys(LeadPerson.rawAttributes);
  for (const pId of personId) {
    const fields = { ...updateData };
    const transaction = await clientConnection.transaction();
    try {
      // Admins can update any person, others only their own
      let person;
      if (req.role === "admin") {
        person = await LeadPerson.findOne({
          where: { personId: pId },
          transaction,
        });
      } else {
        person = await LeadPerson.findOne({
          where: { personId: pId, masterUserID: adminId },
          transaction,
        });
      }
      if (!person) {
        await transaction.rollback();
        results.push({
          personId: pId,
          success: false,
          error: "Person not found.",
        });
        continue;
      }
      const updatedValues = [];
      const validationErrors = [];

      // Separate standard and custom fields
      const standardFieldUpdates = {};
      const customFieldUpdates = {};
      for (const [fieldKey, value] of Object.entries(fields)) {
        if (personFields.includes(fieldKey)) {
          standardFieldUpdates[fieldKey] = value;
        } else {
          customFieldUpdates[fieldKey] = value;
        }
      }

      // Update standard fields if any
      if (Object.keys(standardFieldUpdates).length > 0) {
        await person.update(standardFieldUpdates, { transaction });
        // Add updated standard fields to updatedValues for response
        for (const [fieldKey, value] of Object.entries(standardFieldUpdates)) {
          updatedValues.push({
            fieldName: fieldKey,
            value,
            isStandard: true,
          });
        }
      }

      // Update custom fields as before
      for (const [fieldKey, value] of Object.entries(customFieldUpdates)) {
        let customField;
        if (isNaN(fieldKey)) {
          customField = await CustomField.findOne({
            where: { fieldName: fieldKey, masterUserID: adminId, entityType },
            transaction,
          });
        } else {
          customField = await CustomField.findOne({
            where: { fieldId: fieldKey, masterUserID: adminId, entityType },
            transaction,
          });
        }
        if (!customField) continue;
        if (
          customField.isRequired &&
          (value === null || value === "" || value === undefined)
        ) {
          validationErrors.push(
            `Field \"${customField.fieldLabel}\" is required.`
          );
          continue;
        }
        let processedValue = value;
        if (
          customField.fieldType === "number" &&
          value !== null &&
          value !== ""
        ) {
          processedValue = parseFloat(value);
          if (isNaN(processedValue)) {
            validationErrors.push(
              `Invalid number value for field \"${customField.fieldLabel}\".`
            );
            continue;
          }
        }
        if (customField.fieldType === "email" && value) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            validationErrors.push(
              `Invalid email format for field \"${customField.fieldLabel}\".`
            );
            continue;
          }
        }
        if (customField.fieldType === "select" && customField.options) {
          const validOptions = Array.isArray(customField.options)
            ? customField.options
            : [];
          if (value && !validOptions.includes(value)) {
            validationErrors.push(
              `Invalid option \"${value}\" for field \"${customField.fieldLabel}\".`
            );
            continue;
          }
        }
        let fieldValue = await CustomFieldValue.findOne({
          where: {
            fieldId: customField.fieldId,
            entityId: pId.toString(),
            entityType,
            masterUserID: adminId,
          },
          transaction,
        });
        if (fieldValue) {
          await fieldValue.update({ value: processedValue }, { transaction });
        } else {
          fieldValue = await CustomFieldValue.create(
            {
              fieldId: customField.fieldId,
              entityId: pId.toString(),
              entityType,
              value: processedValue,
              masterUserID: adminId,
            },
            { transaction }
          );
        }
        updatedValues.push({
          fieldId: customField.fieldId,
          fieldName: customField.fieldName,
          fieldLabel: customField.fieldLabel,
          fieldType: customField.fieldType,
          value: processedValue,
          isRequired: customField.isRequired,
          isImportant: customField.isImportant,
        });
      }

      if (validationErrors.length > 0) {
        await transaction.rollback();
        results.push({
          personId: pId,
          success: false,
          errors: validationErrors,
        });
        continue;
      }
      await transaction.commit();
      results.push({
        personId: pId,
        success: true,
        updatedFields: updatedValues,
      });
    } catch (error) {
      await transaction.rollback();
      results.push({ personId: pId, success: false, error: error.message });
    }
  }
  res.status(200).json({
    message: "Bulk update completed.",
    results,
    total: results.length,
    successCount: results.filter((r) => r.success).length,
    failureCount: results.filter((r) => !r.success).length,
  });
};

exports.getOrganizationsAndPersons = async (req, res) => {
  const {PersonColumnPreference, CustomField, CustomFieldValue, LeadDetail, LeadPerson, LeadOrganization, MasterUser, OrganizationColumnPreference, Deal, Lead, LeadFilter, Activity, Product, DealProduct, } = req.models;
  try {
    // Import required models at the beginning of the function

    // Pagination and search for organizations
    const orgPage = parseInt(req.query.orgPage) || 1;
    const orgLimit = parseInt(req.query.orgLimit) || 20;
    const orgOffset = (orgPage - 1) * orgLimit;
    const orgSearch = req.query.orgSearch || "";

    // Pagination and search for persons
    const personPage = parseInt(req.query.personPage) || 1;
    const personLimit = parseInt(req.query.personLimit) || 20;
    const personOffset = (personPage - 1) * personLimit;
    const personSearch = req.query.personSearch || "";

    // Sorting parameters
    const sortBy = req.query.sortBy || "createdAt";
    const sortOrder = req.query.sortOrder || "DESC";

    // Timeline activity filters - similar to Pipedrive interface
    const activityFilters = req.query.activityFilters ? 
      (Array.isArray(req.query.activityFilters) ? req.query.activityFilters : req.query.activityFilters.split(',')) 
      : ['deals', 'emails', 'notes', 'meeting', 'task', 'deadline'];
    
    const includeTimeline = req.query.includeTimeline === 'true' || req.query.includeTimeline === true;
    
    // Timeline granularity options (weekly, monthly, quarterly)
    const timelineGranularity = req.query.timelineGranularity || 'quarterly'; // weekly, monthly, quarterly
    
    // Date range filtering options (similar to Pipedrive's dropdown)
    const dateRangeFilter = req.query.dateRangeFilter || '12-months-back'; // 1-month-back, 3-months-back, 6-months-back, 12-months-back
    
    // Calculate start date based on date range filter
    let calculatedStartDate;
    const now = new Date();
    switch (dateRangeFilter) {
      case '1-month-back':
        calculatedStartDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      case '3-months-back':
        calculatedStartDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        break;
      case '6-months-back':
        calculatedStartDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        break;
      case '12-months-back':
      default:
        calculatedStartDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
    }
    
    const timelineStartDate = req.query.timelineStartDate || calculatedStartDate.toISOString();
    const timelineEndDate = req.query.timelineEndDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(); // 1 year from now
    
    // Overdue activities tracking flag
    const includeOverdueCount = req.query.includeOverdueCount === 'true' || req.query.includeOverdueCount === true || includeTimeline;

    // Dynamic filter config (from body or query)
    let filterConfig = null;
    let filterIdRaw = null;
    if (req.body && req.body.filterId !== undefined) {
      filterIdRaw = req.body.filterId;
    } else if (req.query && req.query.filterId !== undefined) {
      filterIdRaw = req.query.filterId;
    }
    if (filterIdRaw !== null && filterIdRaw !== undefined) {
      if (typeof filterIdRaw === "string" && /^\d+$/.test(filterIdRaw)) {
        const filterRow = await LeadFilter.findByPk(parseInt(filterIdRaw));
        if (filterRow && filterRow.filterConfig) {
          // Parse the filterConfig if it's a JSON string from database
          if (typeof filterRow.filterConfig === "string") {
            try {
              filterConfig = JSON.parse(filterRow.filterConfig);
              console.log(
                "[DEBUG] Parsed filterConfig from DB string:",
                JSON.stringify(filterConfig, null, 2)
              );
            } catch (e) {
              console.log(
                "[DEBUG] Error parsing filterConfig string from DB:",
                e.message
              );
              filterConfig = null;
            }
          } else {
            filterConfig = filterRow.filterConfig;
          }
        }
      } else if (typeof filterIdRaw === "number") {
        const filterRow = await LeadFilter.findByPk(filterIdRaw);
        if (filterRow && filterRow.filterConfig) {
          // Parse the filterConfig if it's a JSON string from database
          if (typeof filterRow.filterConfig === "string") {
            try {
              filterConfig = JSON.parse(filterRow.filterConfig);
              console.log(
                "[DEBUG] Parsed filterConfig from DB string:",
                JSON.stringify(filterConfig, null, 2)
              );
            } catch (e) {
              console.log(
                "[DEBUG] Error parsing filterConfig string from DB:",
                e.message
              );
              filterConfig = null;
            }
          } else {
            filterConfig = filterRow.filterConfig;
          }
        }
      } else {
        try {
          filterConfig =
            typeof filterIdRaw === "string"
              ? JSON.parse(filterIdRaw)
              : filterIdRaw;
        } catch (e) {
          filterConfig = null;
        }
      }
    }

    let organizationWhere = {};
    let personWhere = {};
    let leadWhere = {};
    let dealWhere = {};
    let activityWhere = {};
    let productWhere = {};
    let dealProductWhere = {};

    const { Op } = require("sequelize");
    const Sequelize = require("sequelize");

    // Debug: print filterConfig
    console.log("[DEBUG] filterConfig:", JSON.stringify(filterConfig, null, 2));
    console.log("[DEBUG] Available model fields:");
    console.log("[DEBUG] - Lead fields:", Object.keys(Lead.rawAttributes));
    console.log("[DEBUG] - Person fields:", Object.keys(Person.rawAttributes));
    console.log(
      "[DEBUG] - Organization fields:",
      Object.keys(LeadOrganization.rawAttributes)
    );
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
      between: Op.between,
      notBetween: Op.notBetween,
    };
    const operatorMap = {
      is: "eq",
      "is not": "ne",
      "is empty": "isEmpty",
      "is not empty": "isNotEmpty",
      contains: "like",
      "does not contain": "notLike",
      "is exactly or earlier than": "lte",
      "is earlier than": "lt",
      "is exactly or later than": "gte",
      "not equals": "ne",
      "greater than": "gt",
      "greater than or equal": "gte",
      "less than": "lt",
      "less than or equal": "lte",
    };

    // Helper function to build a single condition - following the pattern from other APIs
    function buildCondition(cond) {
      console.log(
        "[DEBUG] buildCondition called with:",
        JSON.stringify(cond, null, 2)
      );

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
        between: Op.between,
        notBetween: Op.notBetween,
      };

      let operator = cond.operator;
      console.log("[DEBUG] Original operator:", operator);

      if (operatorMap[operator]) {
        operator = operatorMap[operator];
        console.log("[DEBUG] Mapped operator:", operator);
      }

      // Handle "is empty" and "is not empty"
      if (operator === "isEmpty" || operator === "is empty") {
        const result = { [cond.field]: { [Op.is]: null } };
        console.log(
          "[DEBUG] isEmpty condition result:",
          JSON.stringify(result, null, 2)
        );
        return result;
      }
      if (operator === "isNotEmpty" || operator === "is not empty") {
        const result = { [cond.field]: { [Op.not]: null, [Op.ne]: "" } };
        console.log(
          "[DEBUG] isNotEmpty condition result:",
          JSON.stringify(result, null, 2)
        );
        return result;
      }

      // Handle "contains" and "does not contain" for text fields
      if (operator === "like" || operator === "contains") {
        const result = { [cond.field]: { [Op.like]: `%${cond.value}%` } };
        console.log(
          "[DEBUG] like condition result:",
          JSON.stringify(result, null, 2)
        );
        return result;
      }
      if (operator === "notLike" || operator === "does not contain") {
        const result = { [cond.field]: { [Op.notLike]: `%${cond.value}%` } };
        console.log(
          "[DEBUG] notLike condition result:",
          JSON.stringify(result, null, 2)
        );
        return result;
      }

      // Default condition
      const finalOperator = ops[operator] || Op.eq;
      console.log("[DEBUG] Final operator symbol:", finalOperator.toString());
      console.log("[DEBUG] Condition value:", cond.value);
      console.log("[DEBUG] Condition field:", cond.field);

      const result = {
        [cond.field]: {
          [finalOperator]: cond.value,
        },
      };

      // Special logging for sequelize operators (they don't serialize well with JSON.stringify)
      console.log("[DEBUG] Default condition result:", {
        field: cond.field,
        operator: finalOperator.toString(),
        value: cond.value,
        resultStructure: `{ ${cond.field}: { ${finalOperator.toString()}: "${
          cond.value
        }" } }`,
      });

      // Additional validation
      if (cond.value === undefined || cond.value === null) {
        console.log("[DEBUG] WARNING: cond.value is undefined or null!");
      }

      return result;
    }

    // Get model field names for validation
    const personFields = Object.keys(Person.rawAttributes);
    const leadFields = Object.keys(Lead.rawAttributes);
    const dealFields = Object.keys(Deal.rawAttributes);
    const organizationFields = Object.keys(Organization.rawAttributes);

    let activityFields = [];
    try {
      activityFields = Object.keys(Activity.rawAttributes);
    } catch (e) {
      console.log("[DEBUG] Activity model not available:", e.message);
    }

    let productFields = [];
    let dealProductFields = [];
    try {
      productFields = Object.keys(Product.rawAttributes);
      dealProductFields = Object.keys(DealProduct.rawAttributes);
    } catch (e) {
      console.log("[DEBUG] Product models not available:", e.message);
    }

    console.log("[DEBUG] Available fields:");
    console.log("- Person fields:", personFields.slice(0, 5), "...");
    console.log("- Lead fields:", leadFields.slice(0, 5), "...");
    console.log("- Deal fields:", dealFields.slice(0, 5), "...");
    console.log(
      "- Organization fields:",
      organizationFields.slice(0, 5),
      "..."
    );
    console.log("- Activity fields:", activityFields.slice(0, 5), "...");
    console.log("- Product fields:", productFields.slice(0, 5), "...");
    console.log("- DealProduct fields:", dealProductFields.slice(0, 5), "...");

    // If filterConfig is provided, build AND/OR logic for all entities
    if (filterConfig && typeof filterConfig === "object") {
      // AND conditions
      if (Array.isArray(filterConfig.all) && filterConfig.all.length > 0) {
        console.log("[DEBUG] Processing 'all' conditions:", filterConfig.all);

        filterConfig.all.forEach(function (cond) {
          console.log(`[DEBUG] Processing AND condition:`, cond);

          if (cond.entity) {
            // Entity is explicitly specified
            switch (cond.entity.toLowerCase()) {
              case "person":
                if (personFields.includes(cond.field)) {
                  if (!personWhere[Op.and]) personWhere[Op.and] = [];
                  personWhere[Op.and].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Person AND condition for field: ${cond.field}`
                  );
                }
                break;
              case "lead":
                if (leadFields.includes(cond.field)) {
                  if (!leadWhere[Op.and]) leadWhere[Op.and] = [];
                  leadWhere[Op.and].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Lead AND condition for field: ${cond.field}`
                  );
                }
                break;
              case "deal":
                if (dealFields.includes(cond.field)) {
                  if (!dealWhere[Op.and]) dealWhere[Op.and] = [];
                  dealWhere[Op.and].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Deal AND condition for field: ${cond.field}`
                  );
                }
                break;
              case "organization":
                if (organizationFields.includes(cond.field)) {
                  if (!organizationWhere[Op.and])
                    organizationWhere[Op.and] = [];
                  organizationWhere[Op.and].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Organization AND condition for field: ${cond.field}`
                  );
                }
                break;
              case "activity":
                if (activityFields.includes(cond.field)) {
                  if (!activityWhere[Op.and]) activityWhere[Op.and] = [];
                  activityWhere[Op.and].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Activity AND condition for field: ${cond.field}`
                  );
                }
                break;
              case "product":
                if (productFields.includes(cond.field)) {
                  if (!productWhere[Op.and]) productWhere[Op.and] = [];
                  productWhere[Op.and].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Product AND condition for field: ${cond.field}`
                  );
                }
                break;
              case "dealproduct":
                if (dealProductFields.includes(cond.field)) {
                  if (!dealProductWhere[Op.and]) dealProductWhere[Op.and] = [];
                  dealProductWhere[Op.and].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added DealProduct AND condition for field: ${cond.field}`
                  );
                }
                break;
              default:
                console.log(`[DEBUG] Unknown entity: ${cond.entity}`);
            }
          } else {
            // Auto-detect entity based on field name
            if (personFields.includes(cond.field)) {
              if (!personWhere[Op.and]) personWhere[Op.and] = [];
              personWhere[Op.and].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Person AND condition for field: ${cond.field}`
              );
            } else if (leadFields.includes(cond.field)) {
              if (!leadWhere[Op.and]) leadWhere[Op.and] = [];
              leadWhere[Op.and].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Lead AND condition for field: ${cond.field}`
              );
            } else if (dealFields.includes(cond.field)) {
              if (!dealWhere[Op.and]) dealWhere[Op.and] = [];
              dealWhere[Op.and].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Deal AND condition for field: ${cond.field}`
              );
            } else if (organizationFields.includes(cond.field)) {
              if (!organizationWhere[Op.and]) organizationWhere[Op.and] = [];
              organizationWhere[Op.and].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Organization AND condition for field: ${cond.field}`
              );
            } else if (activityFields.includes(cond.field)) {
              if (!activityWhere[Op.and]) activityWhere[Op.and] = [];
              activityWhere[Op.and].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Activity AND condition for field: ${cond.field}`
              );
            } else {
              console.log(
                `[DEBUG] Field '${cond.field}' not found in any entity`
              );
            }
          }
        });
      }

      // OR conditions
      if (Array.isArray(filterConfig.any) && filterConfig.any.length > 0) {
        console.log("[DEBUG] Processing 'any' conditions:", filterConfig.any);

        filterConfig.any.forEach(function (cond) {
          console.log(`[DEBUG] Processing OR condition:`, cond);

          if (cond.entity) {
            // Entity is explicitly specified
            switch (cond.entity.toLowerCase()) {
              case "person":
                if (personFields.includes(cond.field)) {
                  if (!personWhere[Op.or]) personWhere[Op.or] = [];
                  personWhere[Op.or].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Person OR condition for field: ${cond.field}`
                  );
                }
                break;
              case "lead":
                if (leadFields.includes(cond.field)) {
                  if (!leadWhere[Op.or]) leadWhere[Op.or] = [];
                  leadWhere[Op.or].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Lead OR condition for field: ${cond.field}`
                  );
                }
                break;
              case "deal":
                if (dealFields.includes(cond.field)) {
                  if (!dealWhere[Op.or]) dealWhere[Op.or] = [];
                  dealWhere[Op.or].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Deal OR condition for field: ${cond.field}`
                  );
                }
                break;
              case "organization":
                if (organizationFields.includes(cond.field)) {
                  if (!organizationWhere[Op.or]) organizationWhere[Op.or] = [];
                  organizationWhere[Op.or].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Organization OR condition for field: ${cond.field}`
                  );
                }
                break;
              case "activity":
                if (activityFields.includes(cond.field)) {
                  if (!activityWhere[Op.or]) activityWhere[Op.or] = [];
                  activityWhere[Op.or].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Activity OR condition for field: ${cond.field}`
                  );
                }
                break;
              default:
                console.log(`[DEBUG] Unknown entity: ${cond.entity}`);
            }
          } else {
            // Auto-detect entity based on field name
            if (personFields.includes(cond.field)) {
              if (!personWhere[Op.or]) personWhere[Op.or] = [];
              personWhere[Op.or].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Person OR condition for field: ${cond.field}`
              );
            } else if (leadFields.includes(cond.field)) {
              if (!leadWhere[Op.or]) leadWhere[Op.or] = [];
              leadWhere[Op.or].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Lead OR condition for field: ${cond.field}`
              );
            } else if (dealFields.includes(cond.field)) {
              if (!dealWhere[Op.or]) dealWhere[Op.or] = [];
              dealWhere[Op.or].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Deal OR condition for field: ${cond.field}`
              );
            } else if (organizationFields.includes(cond.field)) {
              if (!organizationWhere[Op.or]) organizationWhere[Op.or] = [];
              organizationWhere[Op.or].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Organization OR condition for field: ${cond.field}`
              );
            } else if (activityFields.includes(cond.field)) {
              if (!activityWhere[Op.or]) activityWhere[Op.or] = [];
              activityWhere[Op.or].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Activity OR condition for field: ${cond.field}`
              );
            } else {
              console.log(
                `[DEBUG] Field '${cond.field}' not found in any entity`
              );
            }
          }
        });
      }
    } else {
      // Fallback to search logic if no filterConfig
      if (orgSearch) {
        organizationWhere[Op.or] = [
          { organization: { [Op.like]: `%${orgSearch}%` } },
          { organizationLabels: { [Op.like]: `%${orgSearch}%` } },
          { address: { [Op.like]: `%${orgSearch}%` } },
        ];
      }
      
      if (personSearch) {
        // If personSearch is a single character, search by first letter
        if (personSearch.length === 1) {
          personWhere.contactPerson = { [Op.like]: `${personSearch}%` };
        } else {
          personWhere[Op.or] = [
            { contactPerson: { [Op.like]: `%${personSearch}%` } },
            { email: { [Op.like]: `%${personSearch}%` } },
            { phone: { [Op.like]: `%${personSearch}%` } },
            { jobTitle: { [Op.like]: `%${personSearch}%` } },
            { personLabels: { [Op.like]: `%${personSearch}%` } },
            { organization: { [Op.like]: `%${personSearch}%` } },
          ];
        }
      }
    }

    // Debug: log all where clauses
    console.log("[DEBUG] Final where clauses:");
    console.log("- personWhere:", JSON.stringify(personWhere, null, 2));
    console.log("- leadWhere:", JSON.stringify(leadWhere, null, 2));
    console.log("- leadWhere keys:", Object.keys(leadWhere));
    console.log("- leadWhere[Op.and]:", leadWhere[Op.and]);
    console.log("- dealWhere:", JSON.stringify(dealWhere, null, 2));
    console.log(
      "- organizationWhere:",
      JSON.stringify(organizationWhere, null, 2)
    );
    console.log("- activityWhere:", JSON.stringify(activityWhere, null, 2));

    // Apply Lead filters to get relevant organization IDs
    let leadFilteredOrgIds = [];
    const hasLeadFilters =
      leadWhere[Op.and]?.length > 0 ||
      leadWhere[Op.or]?.length > 0 ||
      Object.keys(leadWhere).some((key) => typeof key === "string");

    if (hasLeadFilters) {
      console.log("[DEBUG] Applying Lead filters to find organizations");
      console.log("[DEBUG] leadWhere has filters:", {
        andConditions: leadWhere[Op.and]?.length || 0,
        orConditions: leadWhere[Op.or]?.length || 0,
        stringKeys: Object.keys(leadWhere).filter(
          (key) => typeof key === "string"
        ),
      });

      let leadFilterResults = [];
      if (req.role === "admin") {
        leadFilterResults = await Lead.findAll({
          where: leadWhere,
          attributes: ["leadOrganizationId", "organization"],
          raw: true,
        });
      } else {
        leadFilterResults = await Lead.findAll({
          where: {
            ...leadWhere,
            [Op.or]: [{ masterUserID: req.adminId }, { ownerId: req.adminId }],
          },
          attributes: ["leadOrganizationId", "organization"],
          raw: true,
        });
      }

      console.log(
        "[DEBUG] Lead filter results:",
        leadFilterResults.length,
        "leads found"
      );

      // Get organization IDs from leads
      leadFilteredOrgIds = leadFilterResults
        .map((lead) => lead.leadOrganizationId)
        .filter(Boolean);

      // Also get organization names directly from leads that don't have leadOrganizationId but have organization name
      const leadOrgNames = leadFilterResults
        .map((lead) => lead.organization)
        .filter(Boolean);

      console.log("[DEBUG] Lead-filtered org IDs:", leadFilteredOrgIds);
      console.log("[DEBUG] Lead organization names:", leadOrgNames);

      // If we have organization names from leads, also find organizations by name
      if (leadOrgNames.length > 0) {
        const orgsByName = await LeadOrganization.findAll({
          where: {
            organization: { [Op.in]: leadOrgNames },
          },
          attributes: ["leadOrganizationId"],
          raw: true,
        });

        const additionalOrgIds = orgsByName.map(
          (org) => org.leadOrganizationId
        );
        leadFilteredOrgIds = [
          ...new Set([...leadFilteredOrgIds, ...additionalOrgIds]),
        ];

        console.log(
          "[DEBUG] Additional org IDs from lead org names:",
          additionalOrgIds
        );
        console.log(
          "[DEBUG] Combined lead-filtered org IDs:",
          leadFilteredOrgIds
        );
      }
    }

    // Apply Activity filters to get relevant organization IDs
    let activityFilteredOrgIds = [];
    const hasActivityFilters =
      activityWhere[Op.and]?.length > 0 ||
      activityWhere[Op.or]?.length > 0 ||
      Object.keys(activityWhere).some((key) => typeof key === "string");

    if (hasActivityFilters) {
      console.log("[DEBUG] Applying Activity filters to find organizations");
      console.log("[DEBUG] activityWhere has filters:", {
        andConditions: activityWhere[Op.and]?.length || 0,
        orConditions: activityWhere[Op.or]?.length || 0,
        stringKeys: Object.keys(activityWhere).filter(
          (key) => typeof key === "string"
        ),
      });

      try {
        let activityFilterResults = [];

        if (req.role === "admin") {
          activityFilterResults = await Activity.findAll({
            where: activityWhere,
            attributes: ["leadOrganizationId", "organization"],
            raw: true,
          });
        } else {
          activityFilterResults = await Activity.findAll({
            where: {
              ...activityWhere,
              [Op.or]: [
                { masterUserID: req.adminId },
                { assignedTo: req.adminId },
              ],
            },
            attributes: ["leadOrganizationId", "organization"],
            raw: true,
          });
        }

        console.log(
          "[DEBUG] Activity filter results:",
          activityFilterResults.length,
          "activities found"
        );

        // Get organization IDs from activities
        activityFilteredOrgIds = activityFilterResults
          .map((activity) => activity.leadOrganizationId)
          .filter(Boolean);

        // Also get organization names directly from activities that don't have leadOrganizationId but have organization name
        const activityOrgNames = activityFilterResults
          .map((activity) => activity.organization)
          .filter(Boolean);

        console.log(
          "[DEBUG] Activity-filtered org IDs:",
          activityFilteredOrgIds
        );
        console.log("[DEBUG] Activity organization names:", activityOrgNames);

        // If we have organization names from activities, also find organizations by name
        if (activityOrgNames.length > 0) {
          const orgsByName = await LeadOrganization.findAll({
            where: {
              organization: { [Op.in]: activityOrgNames },
            },
            attributes: ["leadOrganizationId"],
            raw: true,
          });

          const additionalOrgIds = orgsByName.map(
            (org) => org.leadOrganizationId
          );
          activityFilteredOrgIds = [
            ...new Set([...activityFilteredOrgIds, ...additionalOrgIds]),
          ];

          console.log(
            "[DEBUG] Additional org IDs from activity org names:",
            additionalOrgIds
          );
          console.log(
            "[DEBUG] Combined activity-filtered org IDs:",
            activityFilteredOrgIds
          );
        }
      } catch (e) {
        console.log("[DEBUG] Error applying Activity filters:", e.message);
      }
    }

    // Apply Person filters to get relevant organization IDs
    let personFilteredOrgIds = [];
    const hasPersonFilters =
      personWhere[Op.and]?.length > 0 ||
      personWhere[Op.or]?.length > 0 ||
      Object.keys(personWhere).some((key) => typeof key === "string");

    if (hasPersonFilters) {
      console.log("[DEBUG] Applying Person filters to find organizations");
      console.log("[DEBUG] personWhere has filters:", {
        andConditions: personWhere[Op.and]?.length || 0,
        orConditions: personWhere[Op.or]?.length || 0,
        stringKeys: Object.keys(personWhere).filter(
          (key) => typeof key === "string"
        ),
      });

      let personFilterResults = [];
      if (req.role === "admin") {
        personFilterResults = await LeadPerson.findAll({
          where: personWhere,
          attributes: ["leadOrganizationId", "organization"],
          raw: true,
        });
      }else {
        personFilterResults = await LeadPerson.findAll({
          where: {
            ...personWhere,
            [Op.or]: [{ masterUserID: req.adminId }],
          },
          attributes: ["leadOrganizationId", "organization"],
          raw: true,
        });
      }

      console.log(
        "[DEBUG] Person filter results:",
        personFilterResults.length,
        "persons found"
      );

      // Get organization IDs from persons
      personFilteredOrgIds = personFilterResults
        .map((person) => person.leadOrganizationId)
        .filter(Boolean);

      // Also get organization names directly from persons that don't have leadOrganizationId but have organization name
      const personOrgNames = personFilterResults
        .map((person) => person.organization)
        .filter(Boolean);

      console.log("[DEBUG] Person-filtered org IDs:", personFilteredOrgIds);
      console.log("[DEBUG] Person organization names:", personOrgNames);

      // If we have organization names from persons, also find organizations by name
      if (personOrgNames.length > 0) {
        const orgsByName = await Organization.findAll({
          where: {
            organization: { [Op.in]: personOrgNames },
          },
          attributes: ["leadOrganizationId"],
          raw: true,
        });

        const additionalOrgIds = orgsByName.map(
          (org) => org.leadOrganizationId
        );
        personFilteredOrgIds = [
          ...new Set([...personFilteredOrgIds, ...additionalOrgIds]),
        ];

        console.log(
          "[DEBUG] Additional org IDs from person org names:",
          additionalOrgIds
        );
        console.log(
          "[DEBUG] Combined person-filtered org IDs:",
          personFilteredOrgIds
        );
      }
    }

    // Apply Deal filters to get relevant organization IDs
    let dealFilteredOrgIds = [];
    const hasDealFilters =
      dealWhere[Op.and]?.length > 0 ||
      dealWhere[Op.or]?.length > 0 ||
      Object.keys(dealWhere).some((key) => typeof key === "string");

    if (hasDealFilters) {
      console.log("[DEBUG] Applying Deal filters to find organizations");
      console.log("[DEBUG] dealWhere has filters:", {
        andConditions: dealWhere[Op.and]?.length || 0,
        orConditions: dealWhere[Op.or]?.length || 0,
        stringKeys: Object.keys(dealWhere).filter(
          (key) => typeof key === "string"
        ),
      });

      let dealFilterResults = [];
      if (req.role === "admin") {
        dealFilterResults = await Deal.findAll({
          where: dealWhere,
          attributes: ["leadOrganizationId", "organization"],
          raw: true,
        });
      } else {
        dealFilterResults = await Deal.findAll({
          where: {
            ...dealWhere,
            [Op.or]: [{ masterUserID: req.adminId }, { ownerId: req.adminId }],
          },
          attributes: ["leadOrganizationId", "organization"],
          raw: true,
        });
      }

      console.log(
        "[DEBUG] Deal filter results:",
        dealFilterResults.length,
        "deals found"
      );

      // Get organization IDs from deals
      dealFilteredOrgIds = dealFilterResults
        .map((deal) => deal.leadOrganizationId)
        .filter(Boolean);

      // Also get organization names directly from deals that don't have leadOrganizationId but have organization name
      const dealOrgNames = dealFilterResults
        .map((deal) => deal.organization)
        .filter(Boolean);

      console.log("[DEBUG] Deal-filtered org IDs:", dealFilteredOrgIds);
      console.log("[DEBUG] Deal organization names:", dealOrgNames);

      // If we have organization names from deals, also find organizations by name
      if (dealOrgNames.length > 0) {
        const orgsByName = await LeadOrganization.findAll({
          where: {
            organization: { [Op.in]: dealOrgNames },
          },
          attributes: ["leadOrganizationId"],
          raw: true,
        });

        const additionalOrgIds = orgsByName.map(
          (org) => org.leadOrganizationId
        );
        dealFilteredOrgIds = [
          ...new Set([...dealFilteredOrgIds, ...additionalOrgIds]),
        ];

        console.log(
          "[DEBUG] Additional org IDs from deal org names:",
          additionalOrgIds
        );
        console.log(
          "[DEBUG] Combined deal-filtered org IDs:",
          dealFilteredOrgIds
        );
      }
    }

    // Apply Organization filters directly
    let orgFilteredOrgIds = [];
    const hasOrgFilters =
      organizationWhere[Op.and]?.length > 0 ||
      organizationWhere[Op.or]?.length > 0 ||
      Object.keys(organizationWhere).some((key) => typeof key === "string");

    if (hasOrgFilters) {
      console.log(
        "[DEBUG] Applying Organization filters to find organizations"
      );
      console.log("[DEBUG] organizationWhere has filters:", {
        andConditions: organizationWhere[Op.and]?.length || 0,
        orConditions: organizationWhere[Op.or]?.length || 0,
        stringKeys: Object.keys(organizationWhere).filter(
          (key) => typeof key === "string"
        ),
      });

      let orgFilterResults = [];
      if (req.role === "admin") {
        orgFilterResults = await LeadOrganization.findAll({
          where: organizationWhere,
          attributes: ["leadOrganizationId"],
          raw: true,
        });
      }
      else {
        orgFilterResults = await LeadOrganization.findAll({
          where: {
            ...organizationWhere,
            [Op.or]: [{ masterUserID: req.adminId }, { ownerId: req.adminId }],
          },
          attributes: ["leadOrganizationId"],
          raw: true,
        });
      }

      console.log(
        "[DEBUG] Organization filter results:",
        orgFilterResults.length,
        "organizations found"
      );

      // Get organization IDs from organizations
      orgFilteredOrgIds = orgFilterResults
        .map((org) => org.leadOrganizationId)
        .filter(Boolean);

      console.log("[DEBUG] Organization-filtered org IDs:", orgFilteredOrgIds);
    }

    // Apply Product filters to get relevant organization IDs (through deals)
    let productFilteredOrgIds = [];
    const hasProductFilters =
      productWhere[Op.and]?.length > 0 ||
      productWhere[Op.or]?.length > 0 ||
      Object.keys(productWhere).some((key) => typeof key === "string");
    const hasDealProductFilters =
      dealProductWhere[Op.and]?.length > 0 ||
      dealProductWhere[Op.or]?.length > 0 ||
      Object.keys(dealProductWhere).some((key) => typeof key === "string");

    if (hasProductFilters || hasDealProductFilters) {
      console.log("[DEBUG] Applying Product filters to find organizations through deals");
      console.log("[DEBUG] productWhere:", JSON.stringify(productWhere, null, 2));
      console.log("[DEBUG] dealProductWhere:", JSON.stringify(dealProductWhere, null, 2));

      try {
        const Product = require("../../models/product/productModel");
        const DealProduct = require("../../models/product/dealProductModel");
        
        // Build the include chain: Deal -> DealProduct -> Product
        const dealInclude = [];
        
        if (hasProductFilters || hasDealProductFilters) {
          const dealProductInclude = {
            model: DealProduct,
            as: "dealProducts",
            required: true,
            attributes: []
          };
          
          // Add DealProduct WHERE conditions if they exist
          if (hasDealProductFilters) {
            dealProductInclude.where = dealProductWhere;
          }
          
          // Add Product include with WHERE conditions if they exist
          if (hasProductFilters) {
            dealProductInclude.include = [{
              model: Product,
              as: "product",
              where: productWhere,
              required: true,
              attributes: []
            }];
          } else {
            // Just include product without filter
            dealProductInclude.include = [{
              model: Product,
              as: "product",
              required: true,
              attributes: []
            }];
          }
          
          dealInclude.push(dealProductInclude);
        }
        
        // Query deals that have matching products
        let dealsWithProducts = [];
        if (req.role === "admin") {
          dealsWithProducts = await Deal.findAll({
            include: dealInclude,
            attributes: ["leadOrganizationId"],
            raw: false
          });
        } else {
          dealsWithProducts = await Deal.findAll({
            where: {
              [Op.or]: [
                { masterUserID: req.adminId },
                { ownerId: req.adminId }
              ]
            },
            include: dealInclude,
            attributes: ["leadOrganizationId"],
            raw: false
          });
        }
        
        console.log(
          "[DEBUG] Product filter results:",
          dealsWithProducts.length,
          "deals found with matching products"
        );
        
        // Get organization IDs directly from deals
        productFilteredOrgIds = dealsWithProducts
          .map((deal) => deal.leadOrganizationId)
          .filter(Boolean);
        
        productFilteredOrgIds = [...new Set(productFilteredOrgIds)];
        
        console.log(
          "[DEBUG] Product-filtered org IDs:",
          productFilteredOrgIds.length
        );
      } catch (e) {
        console.log("[DEBUG] Error applying Product filters:", e.message);
        console.error("[DEBUG] Full error:", e);
      }
    }

    // Role-based filtering logic for organizations - same as getLeads API
    let orgWhere = {};
    if (orgSearch) {
      // If orgSearch is a single character, search by first letter
      if (orgSearch.length === 1) {
        orgWhere = {
          organization: { [Op.like]: `${orgSearch}%` }
        };
      } else {
        orgWhere = {
          [Op.or]: [
            { organization: { [Op.like]: `%${orgSearch}%` } },
            { organizationLabels: { [Op.like]: `%${orgSearch}%` } },
            { address: { [Op.like]: `%${orgSearch}%` } },
          ],
        };
      }
    }

    // Merge organizationWhere from filters with orgWhere from search
    if (Object.keys(organizationWhere).length > 0) {
      orgWhere = { ...orgWhere, ...organizationWhere };
    }

    // Apply Lead, Activity, Person, Deal, and Organization filters by restricting to organizations found in those entities
    const allFilteredOrgIds = [
      ...new Set([
        ...leadFilteredOrgIds,
        ...activityFilteredOrgIds,
        ...personFilteredOrgIds,
        ...dealFilteredOrgIds,
        ...orgFilteredOrgIds,
        ...productFilteredOrgIds,
      ]),
    ];

    if (allFilteredOrgIds.length > 0) {
      console.log(
        "[DEBUG] Applying combined filters: restricting to org IDs:",
        allFilteredOrgIds
      );
      console.log(
        "[DEBUG] - From leads:",
        leadFilteredOrgIds.length,
        "org IDs"
      );
      console.log(
        "[DEBUG] - From activities:",
        activityFilteredOrgIds.length,
        "org IDs"
      );
      console.log(
        "[DEBUG] - From persons:",
        personFilteredOrgIds.length,
        "org IDs"
      );
      console.log(
        "[DEBUG] - From deals:",
        dealFilteredOrgIds.length,
        "org IDs"
      );
      console.log(
        "[DEBUG] - From organizations:",
        orgFilteredOrgIds.length,
        "org IDs"
      );

      if (Object.keys(orgWhere).length > 0) {
        // Combine with existing filters using AND
        orgWhere = {
          [Op.and]: [
            orgWhere,
            { leadOrganizationId: { [Op.in]: allFilteredOrgIds } },
          ],
        };
      } else {
        // Only entity filters apply
        orgWhere = { leadOrganizationId: { [Op.in]: allFilteredOrgIds } };
      }
    } else if (
      hasLeadFilters ||
      hasActivityFilters ||
      hasPersonFilters ||
      hasDealFilters ||
      hasOrgFilters ||
      hasProductFilters ||
      hasDealProductFilters
    ) {
      // If entity filters were applied but no matching organizations found, return empty results
      console.log(
        "[DEBUG] Entity filters applied but no matching organizations found - returning empty results"
      );
      return res.status(200).json({
        totalRecords: 0,
        totalPages: 0,
        currentPage: orgPage,
        organizations: [],
      });
    }

    console.log("[DEBUG] Final orgWhere:", JSON.stringify(orgWhere, null, 2));

    // Prepare sorting options
    const validSortFields = Object.keys(LeadOrganization.rawAttributes);
    const validSortOrders = ["ASC", "DESC"];
    
    // Validate sortBy parameter
    const finalSortBy = validSortFields.includes(sortBy) ? sortBy : "createdAt";
    
    // Validate sortOrder parameter
    const finalSortOrder = validSortOrders.includes(sortOrder.toUpperCase()) 
      ? sortOrder.toUpperCase() 
      : "DESC";
    
    console.log(`[DEBUG] Sorting by: ${finalSortBy} ${finalSortOrder}`);

    // Fetch organizations using EXACT same logic as getLeads API
    let organizations = [];
    if (req.role === "admin"&&!req.query.masterUserID) {
      organizations = await LeadOrganization.findAll({
        where: orgWhere,
        order: [[finalSortBy, finalSortOrder]],
        raw: true,
      });
    }else if (req.query.masterUserID) {
      orgWhere.masterUserID = req.query.masterUserID;
      organizations = await LeadOrganization.findAll({
        where:orgWhere,
        order: [[finalSortBy, finalSortOrder]],
        raw: true,
      });
    }else {
      organizations = await LeadOrganization.findAll({
        where: {
          ...orgWhere,
          [Op.or]: [{ masterUserID: req.adminId }, { ownerId: req.adminId }],
        },
        order: [[finalSortBy, finalSortOrder]],
        raw: true,
      });
    }

    console.log(
      "[DEBUG] Found",
      organizations.length,
      "organizations after filtering"
    );
    if (organizations.length > 0) {
      console.log(
        "[DEBUG] Sample organizations:",
        organizations.slice(0, 3).map((o) => ({
          id: o.leadOrganizationId,
          name: o.organization,
          createdAt: o.createdAt,
        }))
      );
    }

    const orgIds = organizations.map((o) => o.leadOrganizationId);

    // Merge personWhere from filters with role-based filtering - similar to getPersonsAndOrganizations API
    let finalPersonWhere = { ...personWhere };

    // Fetch persons using pagination logic similar to getPersonsAndOrganizations API
    let personQueryResult = { count: 0, rows: [] };
    if (req.role === "admin" && !req.query.masterUserID) {
      personQueryResult = await LeadPerson.findAndCountAll({
        where: finalPersonWhere,
        order: [[sortBy, sortOrder]], 
        limit: personLimit,
        offset: personOffset,
        raw: true,
      });
    } else if (req.query.masterUserID) {
      // If masterUserID is provided, filter by that as well
      finalPersonWhere.masterUserID = req.query.masterUserID;
      personQueryResult = await LeadPerson.findAndCountAll({
        where: finalPersonWhere,
        order: [[sortBy, sortOrder]], 
        limit: personLimit,
        offset: personOffset,
        raw: true,
      });
    } else {
      const roleBasedPersonFilter = {
        [Op.or]: [
          { masterUserID: req.adminId },
          { leadOrganizationId: orgIds },
        ],
      };

      // Merge filter conditions with role-based access control
      if (Object.keys(finalPersonWhere).length > 0) {
        finalPersonWhere = {
          [Op.and]: [finalPersonWhere, roleBasedPersonFilter],
        };
      } else {
        finalPersonWhere = roleBasedPersonFilter;
      }

      personQueryResult = await LeadPerson.findAndCountAll({
        where: finalPersonWhere,
        order: [[sortBy, sortOrder]], 
        limit: personLimit,
        offset: personOffset,
        raw: true,
      });
    }

    // Extract persons and total count from query result
    let persons = personQueryResult.rows;
    const totalPersonsCount = personQueryResult.count;

    console.log("[DEBUG] persons count:", persons.length);
    console.log("[DEBUG] total persons count from DB:", totalPersonsCount);

    // Build a map: { [leadOrganizationId]: [ { personId, contactPerson }, ... ] } - same as getLeads API
    const orgPersonsMap = {};
    persons.forEach((p) => {
      if (p.leadOrganizationId) {
        if (!orgPersonsMap[p.leadOrganizationId])
          orgPersonsMap[p.leadOrganizationId] = [];
        orgPersonsMap[p.leadOrganizationId].push({
          personId: p.personId,
          contactPerson: p.contactPerson,
        });
      }
    });

    // Get all unique ownerIds from persons and organizations - same as getLeads API
    const orgOwnerIds = organizations.map((o) => o.ownerId).filter(Boolean);
    const personOwnerIds = persons.map((p) => p.ownerId).filter(Boolean);
    const ownerIds = [...new Set([...orgOwnerIds, ...personOwnerIds])];

    // Fetch owner names from MasterUser - same as getLeads API
    const owners = await MasterUser.findAll({
      where: { masterUserID: ownerIds },
      attributes: ["masterUserID", "name"],
      raw: true,
    });
    const orgMap = {};
    organizations.forEach((org) => {
      orgMap[org.leadOrganizationId] = org;
    });
    const ownerMap = {};
    owners.forEach((o) => {
      ownerMap[o.masterUserID] = o.name;
    });

    // Add ownerName to organizations - same as getLeads API
    organizations = organizations.map((o) => ({
      ...o,
      ownerName: ownerMap[o.ownerId] || null,
    }));

    // Count leads for each organization - same as getLeads API
    const leadCounts = await Lead.findAll({
      attributes: [
        "personId",
        "leadOrganizationId",
        [Sequelize.fn("COUNT", Sequelize.col("leadId")), "leadCount"],
      ],
      where: {
        [Op.or]: [{ leadOrganizationId: orgIds }],
      },
      group: ["personId", "leadOrganizationId"],
      raw: true,
    });

    // Build maps for quick lookup
    const orgLeadCountMap = {};
    leadCounts.forEach((lc) => {
      if (lc.leadOrganizationId)
        orgLeadCountMap[lc.leadOrganizationId] = parseInt(lc.leadCount, 10);
    });

    // Get checked columns from OrganizationColumnPreference
    let checkedStandardColumns = new Set();
    let checkedCustomFieldNames = new Set();
    const columnPref = await OrganizationColumnPreference.findOne();
    if (columnPref) {
      const prefColumns = typeof columnPref.columns === "string" ? JSON.parse(columnPref.columns) : columnPref.columns;
      prefColumns.forEach(col => {
        if (col.check === true) {
          if (col.fieldSource === "custom") {
            checkedCustomFieldNames.add(col.key);
          } else {
            checkedStandardColumns.add(col.key);
          }
        }
      });
    }

    // Filter organizations to only include checked fields
    organizations = organizations.map(org => {
      const filteredOrg = {};
      
      // Always include these essential fields regardless of check status
      const essentialFields = ["leadOrganizationId", "ownerId", "createdAt", "updatedAt"];
      essentialFields.forEach(field => {
        if (org[field] !== undefined) {
          filteredOrg[field] = org[field];
        }
      });

      // Include checked standard fields
      Object.keys(org).forEach(key => {
        if (checkedStandardColumns.has(key)) {
          filteredOrg[key] = org[key];
        }
      });

      // Always include these computed fields
      filteredOrg.ownerName = ownerMap[org.ownerId] || null;
      filteredOrg.leadCount = orgLeadCountMap[org.leadOrganizationId] || 0;
      filteredOrg.persons = orgPersonsMap[org.leadOrganizationId] || [];
      
      return filteredOrg;
    });

    // Fetch custom field values for all organizations - same as getLeads API
    const orgIdsForCustomFields = organizations.map(
      (o) => o.leadOrganizationId
    );
    let orgCustomFieldValues = [];
    if (orgIdsForCustomFields.length > 0) {
      orgCustomFieldValues = await CustomFieldValue.findAll({
        where: {
          entityId: orgIdsForCustomFields,
          entityType: "organization",
        },
        raw: true,
      });
    }

    // Fetch all custom fields for organization entity
    const allOrgCustomFields = await CustomField.findAll({
      where: {
        entityType: { [Sequelize.Op.in]: ["organization", "both"] },
        isActive: true,
      },
      raw: true,
    });

    const orgCustomFieldIdToName = {};
    allOrgCustomFields.forEach((cf) => {
      if (checkedCustomFieldNames.has(cf.fieldName)) {
        orgCustomFieldIdToName[cf.fieldId] = cf.fieldName;
      }
    });

    // Map orgId to their custom field values as { fieldName: value }
    const orgCustomFieldsMap = {};
    orgCustomFieldValues.forEach((cfv) => {
      const fieldName = orgCustomFieldIdToName[cfv.fieldId];
      if (fieldName && !orgCustomFieldsMap[cfv.entityId]) {
        orgCustomFieldsMap[cfv.entityId] = {};
        orgCustomFieldsMap[cfv.entityId][fieldName] = cfv.value;
      }
    });

    // Attach custom fields as direct properties to each organization - same as getLeads API
    organizations = organizations.map((o) => {
      const customFields = orgCustomFieldsMap[o.leadOrganizationId] || {};
      return { ...o, ...customFields };
    });

    // Get the persons associated with the organizations for timeline enrichment
    let personsForTimeline = [];
    
    // Fetch and apply person column preferences for filtering
    const personColumnPref = await PersonColumnPreference.findOne({ where: {} });
    
    // Helper function to filter person data based on column preferences
    const filterPersonDataByColumnPreference = (personData, columnPreference) => {
      if (!columnPreference || !columnPreference.columns) {
        return personData;
      }

      let columns = [];
      if (columnPreference.columns) {
        columns = typeof columnPreference.columns === "string" 
          ? JSON.parse(columnPreference.columns) 
          : columnPreference.columns;
      }

      // Filter to only include columns where check is true
      const checkedColumns = columns.filter(col => col.check === true);
      const allowedFields = checkedColumns.map(col => col.key);

      // Always include essential fields regardless of preferences
      const essentialFields = ['personId', 'leadOrganizationId', 'organization', 'ownerName', 'contactPerson'];
      const finalAllowedFields = [...new Set([...allowedFields, ...essentialFields])];

      return personData.map(person => {
        const filteredPerson = {};
        finalAllowedFields.forEach(field => {
          if (person.hasOwnProperty(field)) {
            filteredPerson[field] = person[field];
          }
        });
        return filteredPerson;
      });
    };

    // Apply person column filtering to all persons
    persons = filterPersonDataByColumnPreference(persons, personColumnPref);
    
    if (includeTimeline && persons.length > 0) {
      console.log('[DEBUG] Preparing persons for timeline enrichment in getOrganizationsAndPersons...');
      
      // Format persons for timeline enrichment
      personsForTimeline = persons.map(p => ({
        ...p,
        ownerName: ownerMap[p.ownerId] || null,
      }));

      console.log('[DEBUG] Calling enrichPersonsWithTimeline for', personsForTimeline.length, 'persons...');
      
      try {
        const enrichedPersons = await enrichPersonsWithTimeline(
          personsForTimeline, 
          activityFilters, 
          timelineStartDate, 
          timelineEndDate,
          req.adminId,
          req.role,
          timelineGranularity,
          includeOverdueCount, Activity, Email, Deal, ActivityType
        );

        console.log('[DEBUG] Timeline enrichment completed for', enrichedPersons.length, 'persons');

        // Update the persons array in orgPersonsMap with timeline data
        enrichedPersons.forEach(enrichedPerson => {
          if (enrichedPerson.leadOrganizationId && orgPersonsMap[enrichedPerson.leadOrganizationId]) {
            // Find and update the person in the organization's persons array
            const personIndex = orgPersonsMap[enrichedPerson.leadOrganizationId].findIndex(
              p => p.personId === enrichedPerson.personId
            );
            if (personIndex !== -1) {
              orgPersonsMap[enrichedPerson.leadOrganizationId][personIndex] = {
                ...orgPersonsMap[enrichedPerson.leadOrganizationId][personIndex],
                timelineActivities: enrichedPerson.timelineActivities,
                overdueStats: enrichedPerson.overdueStats,
                availableActivityTypes: enrichedPerson.availableActivityTypes
              };
            }
          }
        });

        // Update organizations with enriched persons data
        organizations = organizations.map(org => ({
          ...org,
          persons: orgPersonsMap[org.leadOrganizationId] || []
        }));

        console.log('[DEBUG] Updated organizations with timeline-enriched persons');
      } catch (error) {
        console.error('[DEBUG] Error enriching persons with timeline:', error);
        // Continue without timeline data if enrichment fails
      }
    } else {
      console.log('[DEBUG] Timeline enrichment skipped - includeTimeline:', includeTimeline, 'personsLength:', persons.length);
    }

    // Return organizations in enhanced format with timeline support and person pagination
    res.status(200).json({
      // Organization pagination metadata
      totalRecords: organizations.length,
      totalPages: Math.ceil(organizations.length / orgLimit),
      currentPage: orgPage,
      sortBy: finalSortBy,
      sortOrder: finalSortOrder,
      organizations: organizations, // Return organizations with timeline-enriched persons
      
      // Person pagination metadata (similar to getPersonsAndOrganizations)
      personPagination: {
        totalRecords: totalPersonsCount,
        totalPages: Math.ceil(totalPersonsCount / personLimit),
        currentPage: personPage,
        limit: personLimit
      },
      
      // Timeline metadata (similar to getPersonsAndOrganizations)
      activityFilters: activityFilters, // Active timeline filters
      timelineEnabled: includeTimeline, // Whether timeline data was included
      timelineRange: includeTimeline ? { startDate: timelineStartDate, endDate: timelineEndDate } : null,
      timelineGranularity: timelineGranularity, // weekly, monthly, quarterly
      dateRangeFilter: dateRangeFilter, // 1-month-back, 3-months-back, 6-months-back, 12-months-back
      overdueTrackingEnabled: includeOverdueCount, // Whether overdue activity counting is enabled
      
      // Summary statistics
      summary: {
        currentPageOrganizationCount: organizations.length,
        currentPagePersonCount: persons.length,
        totalOrganizationCount: organizations.length,
        totalPersonCount: totalPersonsCount,
        totalDatabaseCount: organizations.length + totalPersonsCount
      }
    });
  } catch (error) {
    console.error("Error fetching organizations and persons:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
// Get organizations with persons, leadCount, and ownerName, supporting dynamic filtering

const { Op } = require("sequelize");
const Sequelize = require("sequelize");
const Email = require("../../models/email/emailModel");
const LeadNote = require("../../models/leads/leadNoteModel");
const DealNote = require("../../models/deals/delasNoteModel");
// const PersonNote = require("../../models/leads/personNoteModel");
const MasterUser = require("../../models/master/masterUserModel");
const Attachment = require("../../models/email/attachmentModel");
const OrganizationNote = require("../../models/leads/organizationNoteModel");
const PersonNote = require("../../models/leads/personNoteModel");
const Deal = require("../../models/deals/dealsModels");
const Organization = require("../../models/leads/leadOrganizationModel");
const Person = require("../../models/leads/leadPersonModel");
const Lead = require("../../models/leads/leadsModel")
const Activities = require("../../models/activity/activityModel")
const CustomField = require("../../models/customFieldModel");
const CustomFieldValue = require("../../models/customFieldValueModel");
const UserCredential = require("../../models/email/userCredentialModel"); // Add UserCredential model
const sequelize = require("../../config/db");

/**
 * Create a person with support for multiple emails and phones
 * Request body format:
 * {
 *   contactPerson: "John Doe", // Required
 *   email: "john@example.com", // Optional if emails array is provided
 *   emails: [                  // Optional array format
 *     { email: "john@work.com", type: "Work" },
 *     { email: "john@personal.com", type: "Personal" }
 *   ],
 *   phone: "1234567890",      // Optional if phones array is provided
 *   phones: [                 // Optional array format
 *     { phone: "1234567890", type: "Work" },
 *     { phone: "0987654321", type: "Mobile" }
 *   ],
 *   organization: "Company Name",
 *   jobTitle: "Manager",
 *   notes: "Additional notes",
 *   // ... other standard fields
 * }
 */
exports.createPerson = async (req, res) => {
  const {Email, LeadNote, DealNote, MasterUser, Attachment, OrganizationNote, PersonNote, Deal, LeadOrganization, LeadPerson, Lead, Activity, CustomField, CustomFieldValue, UserCredential} = req.models;
  try {
    const masterUserID = req.adminId;
    if (!req.body || !req.body.contactPerson) {
      return res
        .status(400)
        .json({ 
          statusCode: 400,
          message: "Contact person is required." 
        });
    }
    
    const {
      contactPerson,
      email,
      emails, // Array of email objects: [{ email: "test@example.com", type: "Work" }]
      phone,
      phones, // Array of phone objects: [{ phone: "123456789", type: "Work" }]
      notes,
      postalAddress,
      birthday,
      jobTitle,
      personLabels,
      organization, // may be undefined or empty
      // Activity ID to link existing activity (similar to emailID)
      activityId,
      ...rest
    } = req.body;

    // Handle multiple emails - use emails array if provided, otherwise use single email
    let emailList = [];
    if (emails && Array.isArray(emails) && emails.length > 0) {
      emailList = emails.filter(emailObj => emailObj.email && typeof emailObj.email === 'string' && emailObj.email.trim());
    } else if (email && typeof email === 'string' && email.trim()) {
      emailList = [{ email: email.trim(), type: 'Work' }]; // Default type
    }

    // Require at least one email
    if (emailList.length === 0) {
      return res.status(400).json({ 
        statusCode: 400,
        message: "At least one email address is required." 
      });
    }

    // Handle multiple phones - use phones array if provided, otherwise use single phone
    let phoneList = [];
    if (phones && Array.isArray(phones) && phones.length > 0) {
      phoneList = phones.filter(phoneObj => phoneObj.phone && typeof phoneObj.phone === 'string' && phoneObj.phone.trim());
    } else if (phone && typeof phone === 'string' && phone.trim()) {
      phoneList = [{ phone: phone.trim(), type: 'Work' }]; // Default type
    }

    // Use primary email for uniqueness check (first email in the list)
    const primaryEmail = emailList[0].email;
    const primaryPhone = phoneList.length > 0 ? phoneList[0].phone : null;

    // Enhanced email validation for all emails
    for (const emailObj of emailList) {
      const emailToValidate = emailObj.email;
      // Check for basic format and length limit (254 characters)
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      
      if (!emailRegex.test(emailToValidate) || emailToValidate.length > 254) {
        return res.status(400).json({
          statusCode: 400,
          message: `Invalid email format: ${emailToValidate}. Please provide a valid email address.`,
        });
      }
    }

    // Phone number validation for all phones (only numerical values allowed)
    for (const phoneObj of phoneList) {
      const phoneToValidate = phoneObj.phone;
      // Strict validation: only digits and optional plus sign at the beginning
      const phoneRegex = /^\+?\d{7,15}$/;
      
      if (!phoneRegex.test(phoneToValidate.trim())) {
        return res.status(400).json({
          statusCode: 400,
          message: `Invalid phone number format: ${phoneToValidate}. Phone number should contain only digits (7-15 digits) with optional + for country code. No spaces, dashes, or other characters allowed.`,
        });
      }
    }

    // ✅ DUPLICATE VALIDATION REMOVED - Same contact person can now be added multiple times

    let org = null;
    if (organization) {
      // Only create/find organization if provided
      [org] = await LeadOrganization.findOrCreate({
        where: { organization },
        defaults: { organization, masterUserID, ownerId: masterUserID },
      });
    }

    // Get all person model fields
    const personFields = Object.keys(Person.rawAttributes);

    // Split custom fields from standard fields
    const customFields = {};
    for (const key in rest) {
      if (!personFields.includes(key)) {
        customFields[key] = rest[key];
      }
    }

    // Create the person with primary email and phone + arrays in table fields
    const person = await LeadPerson.create({
      contactPerson,
      email: primaryEmail, // Store primary email in the main field
      phone: primaryPhone, // Store primary phone in the main field
      emails: emailList, // Store all emails array directly in table
      phones: phoneList.length > 0 ? phoneList : null, // Store all phones array directly in table
      notes,
      postalAddress,
      birthday,
      jobTitle,
      personLabels,
      organization: org ? org.organization : null,
      leadOrganizationId: org ? org.leadOrganizationId : null,
      masterUserID,
      ownerId: masterUserID, // Automatically set owner to the user creating the person
    });

    // Save custom fields if any
    for (const [fieldKey, value] of Object.entries(customFields)) {
      if (value === undefined || value === null || value === "") continue;
      // Find custom field by fieldId or fieldName
      let customField = await CustomField.findOne({
        where: {
          [Sequelize.Op.or]: [{ fieldId: fieldKey }, { fieldName: fieldKey }],
          entityType: { [Sequelize.Op.in]: ["person", "both"] },
          isActive: true,
        },
      });
      if (customField) {
        await CustomFieldValue.create({
          fieldId: customField.fieldId,
          entityId: person.personId,
          entityType: "person",
          value: value,
          masterUserID,
        });
      }
    }

    // Link activity to person if activityId is provided (similar to emailID linking)
    if (activityId) {
      try {
        console.log(`Linking activity ${activityId} to person ${person.personId}`);
        const activityUpdateResult = await Activity.update(
          { personId: person.personId },
          { where: { activityId: activityId } }
        );
        console.log(`Activity link result: ${activityUpdateResult[0]} rows updated`);

        if (activityUpdateResult[0] === 0) {
          console.warn(`No activity found with activityId: ${activityId}`);
        }
      } catch (activityError) {
        console.error("Error linking activity to person:", activityError);
        // Don't fail the person creation, just log the error
      }
    }

    // Prepare response with multiple emails and phones
    const personResponse = {
      ...person.toJSON(),
      emails: emailList, // Include all emails in response
      phones: phoneList, // Include all phones in response
    };

    const response = {
      statusCode: 201,
      message: activityId 
        ? "Person created and linked to activity successfully" 
        : "Person created successfully",
      person: personResponse
    };

    // Add activity information to response if activity was linked
    if (activityId) {
      response.activityLinked = true;
      response.linkedActivityId = activityId;
    } else {
      response.activityLinked = false;
    }

    res.status(201).json(response);
  } catch (error) {
    console.error("Error creating person:", error);

    // Handle database constraint violations
    if (error.name === "SequelizeUniqueConstraintError") {
      const field = error.errors[0]?.path || "unknown";
      const value = error.errors[0]?.value || "unknown";

      if (field === "email") {
        return res.status(409).json({
          statusCode: 409,
          message: `A person with email address "${value}" already exists.`,
          field: "email",
          value: value,
        });
      }

      return res.status(409).json({
        statusCode: 409,
        message: `A person with this ${field} already exists.`,
        field: field,
        value: value,
      });
    }

    res
      .status(500)
      .json({ 
        statusCode: 500,
        message: "Internal server error", 
        error: error.message 
      });
  }
};

/**
 * Get a person by ID with all emails and phones
 */
exports.getPerson = async (req, res) => {
  const {Email, LeadNote, DealNote, MasterUser, Attachment, OrganizationNote, PersonNote, Deal, LeadOrganization, LeadPerson, Lead, Activity, CustomField, CustomFieldValue, UserCredential} = req.models;
  try {
    const { personId } = req.params;
    const masterUserID = req.adminId;

    // Find the person
    const person = await LeadPerson.findOne({
      where: { 
        personId,
        // Role-based access control
        ...(req.role !== "admin" && { masterUserID })
      }
    });

    if (!person) {
      return res.status(404).json({ message: "Person not found." });
    }

    // Get emails and phones directly from the person record
    let emails = person.emails || [];
    let phones = person.phones || [];

    // If no arrays stored, create from primary email/phone (backward compatibility)
    if (emails.length === 0 && person.email) {
      emails = [{ email: person.email, type: 'Work' }];
    }
    if (phones.length === 0 && person.phone) {
      phones = [{ phone: person.phone, type: 'Work' }];
    }

    // Prepare response
    const personResponse = {
      ...person.toJSON(),
      emails,
      phones,
    };

    res.status(200).json({
      message: "Person fetched successfully",
      person: personResponse
    });

  } catch (error) {
    console.error("Error fetching person:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

exports.createOrganization = async (req, res) => {
  const {Email, LeadNote, DealNote, MasterUser, Attachment, OrganizationNote, PersonNote, Deal, LeadOrganization, LeadPerson, Lead, Activity, CustomField, CustomFieldValue, UserCredential} = req.models;
  try {
    const masterUserID = req.adminId; // Get the master user ID from the request
    const ownerId = req.body.ownerId || masterUserID; // Default to masterUserID if not provided
    if (!req.body || !req.body.organization) {
      return res
        .status(400)
        .json({ 
          statusCode: 400,
          message: "Organization name is required." 
        });
    }
    const { 
      organization, 
      organizationLabels, 
      address, 
      visibleTo, 
      // Activity ID to link existing activity (similar to emailID)
      activityId,
      ...rest 
    } = req.body;

    // Check if organization already exists
    const existingOrg = await LeadOrganization.findOne({ where: { organization } });
    if (existingOrg) {
      return res.status(409).json({
        statusCode: 409,
        message: "Organization already exists.",
        organization: existingOrg,
      });
    }

    // Get all organization model fields
    const orgFields = Object.keys(LeadOrganization.rawAttributes);

    // Split custom fields from standard fields
    const customFields = {};
    for (const key in rest) {
      if (!orgFields.includes(key)) {
        customFields[key] = rest[key];
      }
    }

    // Create the organization
    const org = await LeadOrganization.create({
      organization,
      organizationLabels,
      address,
      visibleTo,
      masterUserID,
      ownerId, // Set the owner ID if provided
    });

    // Save custom fields if any
    const Sequelize = require("sequelize");
    for (const [fieldKey, value] of Object.entries(customFields)) {
      if (value === undefined || value === null || value === "") continue;
      // Find custom field by fieldId or fieldName
      let customField = await CustomField.findOne({
        where: {
          [Sequelize.Op.or]: [{ fieldId: fieldKey }, { fieldName: fieldKey }],
          entityType: { [Sequelize.Op.in]: ["organization", "both"] },
          isActive: true,
        },
      });
      if (customField) {
        await CustomFieldValue.create({
          fieldId: customField.fieldId,
          entityId: org.leadOrganizationId,
          entityType: "organization",
          value: value,
          masterUserID,
        });
      }
    }

    // Link activity to organization if activityId is provided (similar to emailID linking)
    if (activityId) {
      try {
        console.log(`Linking activity ${activityId} to organization ${org.leadOrganizationId}`);
        const activityUpdateResult = await Activity.update(
          { leadOrganizationId: org.leadOrganizationId },
          { where: { activityId: activityId } }
        );
        console.log(`Activity link result: ${activityUpdateResult[0]} rows updated`);

        if (activityUpdateResult[0] === 0) {
          console.warn(`No activity found with activityId: ${activityId}`);
        }
      } catch (activityError) {
        console.error("Error linking activity to organization:", activityError);
        // Don't fail the organization creation, just log the error
      }
    }

    const response = {
      statusCode: 201,
      message: activityId 
        ? "Organization created and linked to activity successfully" 
        : "Organization created successfully",
      organization: org,
    };

    // Add activity information to response if activity was linked
    if (activityId) {
      response.activityLinked = true;
      response.linkedActivityId = activityId;
    } else {
      response.activityLinked = false;
    }

    res.status(201).json(response);
  } catch (error) {
    console.error("Error creating organization:", error);
    res.status(500).json({ 
      statusCode: 500,
      message: "Internal server error" 
    });
  }
};

exports.getContactTimeline = async (req, res) => {
  const {Email, LeadNote, DealNote, MasterUser, Attachment, OrganizationNote, PersonNote, Deal, LeadOrganization, LeadPerson, Lead, Activity, CustomField, CustomFieldValue, UserCredential} = req.models;
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Search
    const search = req.query.search || "";
    const searchFilter = search
      ? {
          [Op.or]: [
            { contactPerson: { [Op.like]: `%${search}%` } },
            { email: { [Op.like]: `%${search}%` } },
            { phone: { [Op.like]: `%${search}%` } },
            { jobTitle: { [Op.like]: `%${search}%` } },
            { personLabels: { [Op.like]: `%${search}%` } },
            { organization: { [Op.like]: `%${search}%` } }, // Assuming organization is a field in Person
          ],
        }
      : {};

    // Date filter (monthsBack)
    const monthsBack = parseInt(req.query.monthsBack) || 3;
    const fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - monthsBack);

    // Main query
    const { count, rows: persons } = await LeadPerson.findAndCountAll({
      where: {
        ...searchFilter,
        createdAt: { [Op.gte]: fromDate },
      },
      include: [
        {
          model: LeadOrganization,
          as: "LeadOrganization",
          attributes: ["leadOrganizationId", "organization"],
        },
      ],
      attributes: [
        "personId",
        "contactPerson",
        "email",
        "phone",
        "jobTitle",
        "personLabels",
        "leadOrganizationId",
        "createdAt",
      ],
      order: [["contactPerson", "ASC"]],
      limit,
      offset,
    });

    res.status(200).json({
      message: "Contact timeline fetched successfully",
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
      filter: { monthsBack, fromDate },
      search,
      persons,
    });
  } catch (error) {
    console.error("Error fetching contact timeline:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getPersonTimeline = async (req, res) => {
  const {Email, LeadNote, DealNote, MasterUser, Attachment, OrganizationNote, PersonNote, Deal, LeadOrganization, LeadPerson, Lead, Activity, CustomField, CustomFieldValue, UserCredential} = req.models;
  const { personId } = req.params;

  // Email optimization parameters
  const { emailPage = 1, emailLimit = 30 } = req.query;
  const emailOffset = (parseInt(emailPage) - 1) * parseInt(emailLimit);
  const MAX_EMAIL_LIMIT = 50;
  const safeEmailLimit = Math.min(parseInt(emailLimit), MAX_EMAIL_LIMIT);

  try {
    const person = await LeadPerson.findByPk(personId, {
      include: [
        {
          model: LeadOrganization,
          as: "LeadOrganization",
          attributes: ["leadOrganizationId", "organization"],
        },
      ],
    });
    if (!person) {
      return res.status(404).json({ message: "Person not found" });
    }

    // Fetch related leads
    const leads = await Lead.findAll({ where: { personId } });
    const deals = await Deal.findAll({ where: { personId } });

    // Optimized email fetching with pagination, essential fields, and visibility filtering
    const leadIds = leads.map((l) => l.leadId);
    
    console.log(`📧 [getPersonTimeline] Fetching emails for person ${personId} with visibility filtering`);
    
    // Get current user's email for visibility filtering
    let currentUserEmail = null;
    try {
      const userCredential = await UserCredential.findOne({
        where: { masterUserID: req.adminId },
        attributes: ['email']
      });
      currentUserEmail = userCredential?.email;
      console.log(`👤 [getPersonTimeline] Current user email: ${currentUserEmail}`);
    } catch (error) {
      console.error('Error fetching user credential:', error);
    }

    // Build email visibility where clause
    let emailVisibilityWhere = {};
    if (currentUserEmail) {
      emailVisibilityWhere = {
        [Op.or]: [
          { visibility: 'shared' },
          { 
            [Op.and]: [
              { visibility: 'private' },
              { userEmail: currentUserEmail }
            ]
          },
          { visibility: { [Op.is]: null } } // Include emails without visibility set (legacy)
        ]
      };
    } else {
      // If no user email found, only show shared emails and emails without visibility set
      emailVisibilityWhere = {
        [Op.or]: [
          { visibility: 'shared' },
          { visibility: { [Op.is]: null } }
        ]
      };
    }

    // Get total email count first with visibility filtering
    const totalEmailsCount = await Email.count({
      where: {
        [Op.and]: [
          {
            [Op.or]: [
              ...(leadIds.length > 0 ? [{ leadId: leadIds }] : []),
              { sender: person.email },
              { recipient: { [Op.like]: `%${person.email}%` } },
            ],
          },
          emailVisibilityWhere
        ]
      },
    });

    // Fetch emails with pagination, essential fields, and visibility filtering
    const emailsByLead =
      leadIds.length > 0
        ? await Email.findAll({
            where: {
              [Op.and]: [
                { leadId: leadIds },
                emailVisibilityWhere
              ]
            },
            attributes: [
              "emailID",
              "messageId",
              "sender",
              "senderName",
              "recipient",
              "cc",
              "bcc",
              "subject",
              "createdAt",
              "folder",
              "isRead",
              "leadId",
              "dealId",
              "visibility",
              "userEmail"
            ],
            order: [["createdAt", "DESC"]],
            limit: Math.ceil(safeEmailLimit / 2),
            offset: Math.floor(emailOffset / 2),
          })
        : [];

    // Fetch emails where person's email is sender or recipient with visibility filtering
    const emailsByAddress = await Email.findAll({
      where: {
        [Op.and]: [
          {
            [Op.or]: [
              { sender: person.email },
              { recipient: { [Op.like]: `%${person.email}%` } },
            ],
          },
          emailVisibilityWhere
        ]
      },
      attributes: [
        "emailID",
        "messageId",
        "sender",
        "senderName",
        "recipient",
        "cc",
        "bcc",
        "subject",
        "createdAt",
        "folder",
        "isRead",
        "leadId",
        "dealId",
        "visibility",
        "userEmail"
      ],
      order: [["createdAt", "DESC"]],
      limit: Math.ceil(safeEmailLimit / 2),
      offset: Math.floor(emailOffset / 2),
    });

    // Merge and deduplicate emails
    const allEmailsMap = new Map();
    emailsByLead.forEach((email) => allEmailsMap.set(email.emailID, email));
    emailsByAddress.forEach((email) => allEmailsMap.set(email.emailID, email));
    const allEmails = Array.from(allEmailsMap.values());

    // Log visibility statistics
    const visibilityStats = allEmails.reduce((stats, email) => {
      const visibility = email.visibility || 'legacy';
      stats[visibility] = (stats[visibility] || 0) + 1;
      return stats;
    }, {});
    console.log(`📊 [getPersonTimeline] Email visibility stats:`, visibilityStats);

    // Limit final email results and add optimization metadata
    const limitedEmails = allEmails.slice(0, safeEmailLimit);

    // Process emails for optimization
    const optimizedEmails = limitedEmails.map((email) => {
      const emailData = email.toJSON();

      // Truncate email body if present (for memory optimization)
      if (emailData.body) {
        emailData.body =
          emailData.body.length > 1000
            ? emailData.body.substring(0, 1000) + "... [truncated]"
            : emailData.body;
      }

      return emailData;
    });

    // Optimized file/attachment fetching with size limits
    const emailIDs = limitedEmails.map((email) => email.emailID);
    let files = [];
    if (emailIDs.length > 0) {
      files = await Attachment.findAll({
        where: { emailID: emailIDs },
        attributes: [
          "attachmentID",
          "emailID",
          "filename",
          "contentType",
          "size",
          "filePath",
          "createdAt",
        ],
        order: [["createdAt", "DESC"]],
        limit: 20, // Limit attachments to prevent large responses
      });

      // Build a map for quick email lookup
      const emailMap = new Map();
      limitedEmails.forEach((email) => emailMap.set(email.emailID, email));

      // Combine each attachment with minimal email data
      files = files.map((file) => {
        const email = emailMap.get(file.emailID);
        return {
          ...file.toJSON(),
          email: email
            ? {
                emailID: email.emailID,
                subject: email.subject,
                createdAt: email.createdAt,
                sender: email.sender,
                senderName: email.senderName,
              }
            : null,
        };
      });
    }

    // Fetch related notes from multiple sources
    const dealIds = deals.map((deal) => deal.dealId);
    
    // Fetch Lead notes
    const leadNotes = leadIds.length > 0 ? await LeadNote.findAll({
      where: { leadId: leadIds },
      limit: 20,
      order: [["createdAt", "DESC"]],
    }) : [];

    // Fetch Deal notes
    const dealNotes = dealIds.length > 0 ? await DealNote.findAll({
      where: { dealId: dealIds },
      limit: 20,
      order: [["createdAt", "DESC"]],
    }) : [];

    // Fetch Person notes
    const personNotes = await PersonNote.findAll({
      where: { personId: personId },
      limit: 20,
      order: [["createdAt", "DESC"]],
    });

    // Combine all notes and add source type
    const allNotes = [
      ...leadNotes.map(note => ({ ...note.toJSON(), sourceType: 'lead' })),
      ...dealNotes.map(note => ({ ...note.toJSON(), sourceType: 'deal' })),
      ...personNotes.map(note => ({ ...note.toJSON(), sourceType: 'person' }))
    ];

    // Sort combined notes by creation date (most recent first) and limit
    const notes = allNotes
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 20);

    // Fetch related activities from multiple sources
    // Fetch Lead activities
    const leadActivities = leadIds.length > 0 ? await Activity.findAll({
      where: { leadId: leadIds },
      limit: 20,
      order: [["createdAt", "DESC"]],
    }) : [];

    // Fetch Deal activities
    const dealActivities = dealIds.length > 0 ? await Activity.findAll({
      where: { dealId: dealIds },
      limit: 20,
      order: [["createdAt", "DESC"]],
    }) : [];

    // Fetch Person activities
    const personActivities = await Activity.findAll({
      where: { personId: personId },
      limit: 20,
      order: [["createdAt", "DESC"]],
    });

    // Combine all activities and add source type
    const allActivities = [
      ...leadActivities.map(activity => ({ ...activity.toJSON(), sourceType: 'lead' })),
      ...dealActivities.map(activity => ({ ...activity.toJSON(), sourceType: 'deal' })),
      ...personActivities.map(activity => ({ ...activity.toJSON(), sourceType: 'person' }))
    ];

    // Sort combined activities by creation date (most recent first) and limit
    const activities = allActivities
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 20);

    // Fetch custom field values for the person
    let personCustomFieldValues = [];
    personCustomFieldValues = await CustomFieldValue.findAll({
      where: {
        entityId: personId,
        entityType: "person",
      },
      raw: true,
    });

    // Fetch all custom fields for person entity
    const allPersonCustomFields = await CustomField.findAll({
      where: {
        entityType: { [Sequelize.Op.in]: ["person", "both"] },
        isActive: true,
      },
      raw: true,
    });

    const personCustomFieldIdToName = {};
    allPersonCustomFields.forEach((cf) => {
      personCustomFieldIdToName[cf.fieldId] = cf.fieldName;
    });

    // Map custom field values as { fieldName: value }
    const personCustomFields = {};
    personCustomFieldValues.forEach((cfv) => {
      const fieldName = personCustomFieldIdToName[cfv.fieldId] || cfv.fieldId;
      personCustomFields[fieldName] = cfv.value;
    });

    // Attach custom fields to person object
    if (Object.keys(personCustomFields).length > 0) {
      person.dataValues = { ...person.dataValues, ...personCustomFields };
    }

    console.log(
      `Person timeline: ${optimizedEmails.length} emails, ${files.length} files, ${notes.length} notes (${leadNotes.length} lead, ${dealNotes.length} deal, ${personNotes.length} person), ${activities.length} activities (${leadActivities.length} lead, ${dealActivities.length} deal, ${personActivities.length} person), ${Object.keys(personCustomFields).length} custom fields`
    );

    res.status(200).json({
      person,
      leads,
      deals,
      emails: optimizedEmails,
      notes,
      activities,
      files,
      // Add metadata for debugging and pagination (maintaining response structure)
      _emailMetadata: {
        totalEmails: totalEmailsCount,
        returnedEmails: optimizedEmails.length,
        emailPage: parseInt(emailPage),
        emailLimit: safeEmailLimit,
        hasMoreEmails: totalEmailsCount > emailOffset + optimizedEmails.length,
        truncatedBodies: optimizedEmails.some(
          (e) => e.body && e.body.includes("[truncated]")
        ),
        // Email visibility information
        visibilityFiltering: {
          currentUserEmail: currentUserEmail,
          visibilityStats: visibilityStats,
          filterApplied: !!currentUserEmail,
          description: currentUserEmail 
            ? "Emails filtered by visibility - showing shared emails and private emails owned by current user"
            : "User email not found - showing only shared emails and legacy emails"
        }
      },
    });
  } catch (error) {
    console.error("Error fetching person timeline:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getOrganizationTimeline = async (req, res) => {
  const {Email, LeadNote, DealNote, MasterUser, Attachment, OrganizationNote, PersonNote, Deal, LeadOrganization, LeadPerson, Lead, Activity, CustomField, CustomFieldValue, UserCredential} = req.models;
  const { organizationId } = req.params;

  // Email optimization parameters
  const { emailPage = 1, emailLimit = 50 } = req.query;
  const emailOffset = (parseInt(emailPage) - 1) * parseInt(emailLimit);
  const MAX_EMAIL_LIMIT = 50;
  const safeEmailLimit = Math.min(parseInt(emailLimit), MAX_EMAIL_LIMIT);

  try {
    // Fetch the organization
    const organization = await LeadOrganization.findByPk(organizationId);
    if (!organization) {
      return res.status(404).json({ message: "Organization not found" });
    }

    // Fetch all persons in this organization
    const persons = await LeadPerson.findAll({
      where: { leadOrganizationId: organizationId },
    });
    // Add array of { personId, contactPerson } to organization object
    organization.dataValues.persons = persons.map((p) => ({
      personId: p.personId,
      contactPerson: p.contactPerson,
    }));

    // Fetch all leads for this organization (directly or via persons)
    const personIds = persons.map((p) => p.personId);
    const leads = await Lead.findAll({
      where: {
        [Op.or]: [
          { leadOrganizationId: organizationId },
          { personId: personIds },
        ],
      },
    });

    // Fetch all deals for this organization
    const deals = await Deal.findAll({
      where: { leadOrganizationId: organizationId },
    });

    // Optimized email fetching with pagination and visibility filtering
    const leadIds = leads.map((l) => l.leadId);
    const personEmails = persons.map((p) => p.email).filter(Boolean);

    console.log(`📧 [getOrganizationTimeline] Fetching emails for organization ${organizationId} with visibility filtering`);
    
    // Get current user's email for visibility filtering
    let currentUserEmail = null;
    try {
      const userCredential = await UserCredential.findOne({
        where: { masterUserID: req.adminId },
        attributes: ['email']
      });
      currentUserEmail = userCredential?.email;
      console.log(`👤 [getOrganizationTimeline] Current user email: ${currentUserEmail}`);
    } catch (error) {
      console.error('Error fetching user credential:', error);
    }

    // Build email visibility where clause
    let emailVisibilityWhere = {};
    if (currentUserEmail) {
      emailVisibilityWhere = {
        [Op.or]: [
          { visibility: 'shared' },
          { 
            [Op.and]: [
              { visibility: 'private' },
              { userEmail: currentUserEmail }
            ]
          },
          { visibility: { [Op.is]: null } } // Include emails without visibility set (legacy)
        ]
      };
    } else {
      // If no user email found, only show shared emails and emails without visibility set
      emailVisibilityWhere = {
        [Op.or]: [
          { visibility: 'shared' },
          { visibility: { [Op.is]: null } }
        ]
      };
    }

    // Get total email count first with visibility filtering
    const emailWhereConditions = [
      ...(leadIds.length > 0 ? [{ leadId: leadIds }] : []),
      ...(personEmails.length > 0
        ? [
            { sender: { [Op.in]: personEmails } },
            {
              recipient: {
                [Op.or]: personEmails.map((email) => ({
                  [Op.like]: `%${email}%`,
                })),
              },
            },
          ]
        : []),
    ];

    const totalEmailsCount =
      emailWhereConditions.length > 0
        ? await Email.count({
            where: {
              [Op.and]: [
                { [Op.or]: emailWhereConditions },
                emailVisibilityWhere
              ]
            },
          })
        : 0;

    // Fetch emails with pagination, essential fields, and visibility filtering
    const emailsByLead =
      leadIds.length > 0
        ? await Email.findAll({
            where: {
              [Op.and]: [
                { leadId: leadIds },
                emailVisibilityWhere
              ]
            },
            attributes: [
              "emailID",
              "messageId",
              "sender",
              "senderName",
              "recipient",
              "cc",
              "bcc",
              "subject",
              "createdAt",
              "folder",
              "isRead",
              "leadId",
              "dealId",
              "visibility",
              "userEmail"
            ],
            order: [["createdAt", "DESC"]],
            limit: Math.ceil(safeEmailLimit / 2),
            offset: Math.floor(emailOffset / 2),
          })
        : [];

    // Fetch emails where any person's email is sender or recipient with visibility filtering
    let emailsByAddress = [];
    if (personEmails.length > 0) {
      emailsByAddress = await Email.findAll({
        where: {
          [Op.and]: [
            {
              [Op.or]: [
                { sender: { [Op.in]: personEmails } },
                {
                  recipient: {
                    [Op.or]: personEmails.map((email) => ({
                      [Op.like]: `%${email}%`,
                    })),
                  },
                },
              ],
            },
            emailVisibilityWhere
          ]
        },
        attributes: [
          "emailID",
          "messageId",
          "sender",
          "senderName",
          "recipient",
          "cc",
          "bcc",
          "subject",
          "createdAt",
          "folder",
          "isRead",
          "leadId",
          "dealId",
          "visibility",
          "userEmail"
        ],
        order: [["createdAt", "DESC"]],
        limit: Math.ceil(safeEmailLimit / 2),
        offset: Math.floor(emailOffset / 2),
      });
    }

    // Merge and deduplicate emails by emailID
    const allEmailsMap = new Map();
    emailsByLead.forEach((email) => allEmailsMap.set(email.emailID, email));
    emailsByAddress.forEach((email) => allEmailsMap.set(email.emailID, email));
    const allEmails = Array.from(allEmailsMap.values());

    // Log visibility statistics
    const visibilityStats = allEmails.reduce((stats, email) => {
      const visibility = email.visibility || 'legacy';
      stats[visibility] = (stats[visibility] || 0) + 1;
      return stats;
    }, {});
    console.log(`📊 [getOrganizationTimeline] Email visibility stats:`, visibilityStats);

    // Limit final email results and add optimization metadata
    const limitedEmails = allEmails.slice(0, safeEmailLimit);

    // Process emails for optimization
    const optimizedEmails = limitedEmails.map((email) => {
      const emailData = email.toJSON();

      // Truncate email body if present (for memory optimization)
      if (emailData.body) {
        emailData.body =
          emailData.body.length > 1000
            ? emailData.body.substring(0, 1000) + "... [truncated]"
            : emailData.body;
      }

      return emailData;
    });

    // Optimized file/attachment fetching with size limits
    const emailIDs = limitedEmails.map((email) => email.emailID);
    let files = [];
    if (emailIDs.length > 0) {
      files = await Attachment.findAll({
        where: { emailID: emailIDs },
        attributes: [
          "attachmentID",
          "emailID",
          "filename",
          "contentType",
          "size",
          "filePath",
          "createdAt",
        ],
        order: [["createdAt", "DESC"]],
        limit: 20, // Limit attachments to prevent large responses
      });

      // Build a map for quick email lookup
      const emailMap = new Map();
      limitedEmails.forEach((email) => emailMap.set(email.emailID, email));

      // Combine each attachment with minimal email data
      files = files.map((file) => {
        const email = emailMap.get(file.emailID);
        return {
          ...file.toJSON(),
          email: email
            ? {
                emailID: email.emailID,
                subject: email.subject,
                createdAt: email.createdAt,
                sender: email.sender,
                senderName: email.senderName,
              }
            : null,
        };
      });
    }

    // Fetch related notes from multiple sources
    const dealIds = deals.map((deal) => deal.dealId);
    
    // Fetch Lead notes
    const leadNotes = leadIds.length > 0 ? await LeadNote.findAll({
      where: { leadId: leadIds },
      limit: 20,
      order: [["createdAt", "DESC"]],
    }) : [];

    // Fetch Deal notes
    const dealNotes = dealIds.length > 0 ? await DealNote.findAll({
      where: { dealId: dealIds },
      limit: 20,
      order: [["createdAt", "DESC"]],
    }) : [];

    // Fetch Person notes for all persons in the organization
    const personNotes = personIds.length > 0 ? await PersonNote.findAll({
      where: { personId: personIds },
      limit: 20,
      order: [["createdAt", "DESC"]],
    }) : [];

    // Fetch Organization notes
    const organizationNotes = await OrganizationNote.findAll({
      where: { leadOrganizationId: organizationId },
      limit: 20,
      order: [["createdAt", "DESC"]],
    });

    // Combine all notes and add source type
    const allNotes = [
      ...leadNotes.map(note => ({ ...note.toJSON(), sourceType: 'lead' })),
      ...dealNotes.map(note => ({ ...note.toJSON(), sourceType: 'deal' })),
      ...personNotes.map(note => ({ ...note.toJSON(), sourceType: 'person' })),
      ...organizationNotes.map(note => ({ ...note.toJSON(), sourceType: 'organization' }))
    ];

    // Sort combined notes by creation date (most recent first) and limit
    const notes = allNotes
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 20);

    // Fetch related activities from multiple sources
    // Fetch Lead activities
    const leadActivities = leadIds.length > 0 ? await Activity.findAll({
      where: { leadId: leadIds },
      limit: 20,
      order: [["createdAt", "DESC"]],
    }) : [];

    // Fetch Deal activities
    const dealActivities = dealIds.length > 0 ? await Activity.findAll({
      where: { dealId: dealIds },
      limit: 20,
      order: [["createdAt", "DESC"]],
    }) : [];

    // Fetch Person activities for all persons in the organization
    const personActivities = personIds.length > 0 ? await Activity.findAll({
      where: { personId: personIds },
      limit: 20,
      order: [["createdAt", "DESC"]],
    }) : [];

    // Fetch Organization activities
    const organizationActivities = await Activity.findAll({
      where: { leadOrganizationId: organizationId },
      limit: 20,
      order: [["createdAt", "DESC"]],
    });

    // Combine all activities and add source type
    const allActivities = [
      ...leadActivities.map(activity => ({ ...activity.toJSON(), sourceType: 'lead' })),
      ...dealActivities.map(activity => ({ ...activity.toJSON(), sourceType: 'deal' })),
      ...personActivities.map(activity => ({ ...activity.toJSON(), sourceType: 'person' })),
      ...organizationActivities.map(activity => ({ ...activity.toJSON(), sourceType: 'organization' }))
    ];

    // Sort combined activities by creation date (most recent first) and limit
    const activities = allActivities
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 20);

    // Fetch custom field values for the organization
    let organizationCustomFieldValues = [];
    organizationCustomFieldValues = await CustomFieldValue.findAll({
      where: {
        entityId: organizationId,
        entityType: "organization",
      },
      raw: true,
    });

    // Fetch all custom fields for organization entity
    const allOrganizationCustomFields = await CustomField.findAll({
      where: {
        entityType: { [Sequelize.Op.in]: ["organization", "both"] },
        isActive: true,
      },
      raw: true,
    });

    const organizationCustomFieldIdToName = {};
    allOrganizationCustomFields.forEach((cf) => {
      organizationCustomFieldIdToName[cf.fieldId] = cf.fieldName;
    });

    // Map custom field values as { fieldName: value }
    const organizationCustomFields = {};
    organizationCustomFieldValues.forEach((cfv) => {
      const fieldName = organizationCustomFieldIdToName[cfv.fieldId] || cfv.fieldId;
      organizationCustomFields[fieldName] = cfv.value;
    });

    // Attach custom fields to organization object
    if (Object.keys(organizationCustomFields).length > 0) {
      Object.assign(organization.dataValues, organizationCustomFields);
    }

    console.log(
      `Organization timeline: ${optimizedEmails.length} emails, ${files.length} files, ${notes.length} notes (${leadNotes.length} lead, ${dealNotes.length} deal, ${personNotes.length} person, ${organizationNotes.length} org), ${activities.length} activities (${leadActivities.length} lead, ${dealActivities.length} deal, ${personActivities.length} person, ${organizationActivities.length} org), ${Object.keys(organizationCustomFields).length} custom fields`
    );

    res.status(200).json({
      organization,
      persons,
      leads,
      deals,
      emails: optimizedEmails,
      notes,
      activities,
      files, // Attachments with related email data
      // Add metadata for debugging and pagination (maintaining response structure)
      _emailMetadata: {
        totalEmails: totalEmailsCount,
        returnedEmails: optimizedEmails.length,
        emailPage: parseInt(emailPage),
        emailLimit: safeEmailLimit,
        hasMoreEmails: totalEmailsCount > emailOffset + optimizedEmails.length,
        truncatedBodies: optimizedEmails.some(
          (e) => e.body && e.body.includes("[truncated]")
        ),
        // Email visibility information
        visibilityFiltering: {
          currentUserEmail: currentUserEmail,
          visibilityStats: visibilityStats,
          filterApplied: !!currentUserEmail,
          description: currentUserEmail 
            ? "Emails filtered by visibility - showing shared emails and private emails owned by current user"
            : "User email not found - showing only shared emails and legacy emails"
        }
      },
    });
  } catch (error) {
    console.error("Error fetching organization timeline:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getPersonFields = async (req, res) => {
  const {Email, LeadNote, DealNote, MasterUser, Attachment, OrganizationNote, PersonNote, Deal, LeadOrganization, LeadPerson, Lead, Activity, CustomField, CustomFieldValue, UserCredential} = req.models;
  try {
    const { Op } = require("sequelize");

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

    // Get all Person model fields
    const personFields = Object.keys(LeadPerson.rawAttributes);
    
    // Convert Person model fields to the required format
    const fields = personFields.map(fieldName => {
      const fieldInfo = LeadPerson.rawAttributes[fieldName];
      return {
        value: fieldName,
        label: generateLabel(fieldName),
        type: getFieldType(fieldInfo.type),
        isStandard: true
      };
    });

    // Fetch custom fields for Person entity
    let customFields = [];
    if (req.adminId) {
      try {
        customFields = await CustomField.findAll({
          where: {
            entityType: { [Op.in]: ["person", "both"] },
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
      entityType: field.entityType
    }));

    // Combine standard and custom fields
    const allFields = [...fields, ...customFieldsFormatted];

    res.status(200).json({ 
      fields: allFields,
      standardFieldsCount: fields.length,
      customFieldsCount: customFields.length,
      totalFieldsCount: allFields.length,
      message: "Person fields fetched successfully"
    });
  } catch (error) {
    console.error("Error fetching person fields:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getOrganizationFields = async (req, res) => {
  const {Email, LeadNote, DealNote, MasterUser, Attachment, OrganizationNote, PersonNote, Deal, LeadOrganization, LeadPerson, Lead, Activity, CustomField, CustomFieldValue, UserCredential} = req.models;
  try {
    const { Op } = require("sequelize");

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

    // Get all Organization model fields
    const organizationFields = Object.keys(LeadOrganization.rawAttributes);
    
    // Convert Organization model fields to the required format
    const fields = organizationFields.map(fieldName => {
      const fieldInfo = LeadOrganization.rawAttributes[fieldName];
      return {
        value: fieldName,
        label: generateLabel(fieldName),
        type: getFieldType(fieldInfo.type),
        isStandard: true
      };
    });

    // Fetch custom fields for Organization entity
    let customFields = [];
    if (req.adminId) {
      try {
        customFields = await CustomField.findAll({
          where: {
            entityType: { [Op.in]: ["organization", "both"] },
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
      entityType: field.entityType
    }));

    // Combine standard and custom fields
    const allFields = [...fields, ...customFieldsFormatted];

    res.status(200).json({ 
      fields: allFields,
      standardFieldsCount: fields.length,
      customFieldsCount: customFields.length,
      totalFieldsCount: allFields.length,
      message: "Organization fields fetched successfully"
    });
  } catch (error) {
    console.error("Error fetching organization fields:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateOrganization = async (req, res) => {
  const {Email, LeadNote, DealNote, MasterUser, Attachment, OrganizationNote, PersonNote, Deal, LeadOrganization, LeadPerson, Lead, Activity, CustomField, CustomFieldValue, UserCredential} = req.models;
  try {
    const { leadOrganizationId } = req.params; // Use leadOrganizationId from params
    const updateFields = req.body;

    // Find the organization by leadOrganizationId
    const org = await LeadOrganization.findByPk(leadOrganizationId);
    if (!org) {
      return res.status(404).json({ message: "Organization not found" });
    }

    // Update all fields provided in req.body
    await org.update(updateFields);

    res.status(200).json({
      message: "Organization updated successfully",
      organization: org,
    });
  } catch (error) {
    console.error("Error updating organization:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
/**
 * Update person with support for multiple emails and phones
 * Request body can include:
 * - emails: [{ email: "new@email.com", type: "Work" }]
 * - phones: [{ phone: "1234567890", type: "Work" }]
 * - Any other standard person fields
 */
exports.updatePerson = async (req, res) => {
  const {Email, LeadNote, DealNote, MasterUser, Attachment, OrganizationNote, PersonNote, Deal, LeadOrganization, LeadPerson, Lead, Activity, CustomField, CustomFieldValue, UserCredential} = req.models;
  try {
    const { personId } = req.params;
    const { emails, phones, email, phone, ...updateFields } = req.body;
    const masterUserID = req.adminId;

    // Find the person
    const person = await LeadPerson.findByPk(personId);
    if (!person) {
      return res.status(404).json({ message: "Person not found" });
    }

    // Handle multiple emails - use emails array if provided, otherwise use single email
    let emailList = [];
    if (emails && Array.isArray(emails) && emails.length > 0) {
      emailList = emails.filter(emailObj => emailObj.email && emailObj.email.trim());
    } else if (email && email.trim()) {
      emailList = [{ email: email.trim(), type: 'Work' }]; // Default type
    }

    // Handle multiple phones - use phones array if provided, otherwise use single phone
    let phoneList = [];
    if (phones && Array.isArray(phones) && phones.length > 0) {
      phoneList = phones.filter(phoneObj => phoneObj.phone && phoneObj.phone.trim());
    } else if (phone && phone.trim()) {
      phoneList = [{ phone: phone.trim(), type: 'Work' }]; // Default type
    }

    // Enhanced email validation for all emails (if emails are being updated)
    if (emailList.length > 0) {
      for (const emailObj of emailList) {
        const emailToValidate = emailObj.email;
        // Check for basic format and length limit (254 characters)
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        
        if (!emailRegex.test(emailToValidate) || emailToValidate.length > 254) {
          return res.status(400).json({
            message: `Invalid email format: ${emailToValidate}. Please provide a valid email address.`,
          });
        }
      }
    }

    // Phone number validation for all phones (only numerical values allowed) - if phones are being updated
    if (phoneList.length > 0) {
      for (const phoneObj of phoneList) {
        const phoneToValidate = phoneObj.phone;
        // Strict validation: only digits and optional plus sign at the beginning
        const phoneRegex = /^\+?\d{7,15}$/;
        
        if (!phoneRegex.test(phoneToValidate.trim())) {
          return res.status(400).json({
            message: `Invalid phone number format: ${phoneToValidate}. Phone number should contain only digits (7-15 digits) with optional + for country code. No spaces, dashes, or other characters allowed.`,
          });
        }
      }
    }

    // If emails are being updated, validate primary email uniqueness
    if (emailList.length > 0) {
      const primaryEmail = emailList[0].email;
      const existingEmailPerson = await LeadPerson.findOne({ 
        where: { 
          email: primaryEmail,
          personId: { [Sequelize.Op.ne]: personId } // Exclude current person
        } 
      });
      if (existingEmailPerson) {
        return res.status(409).json({
          message: "A person with this email address already exists.",
          person: {
            personId: existingEmailPerson.personId,
            contactPerson: existingEmailPerson.contactPerson,
            email: existingEmailPerson.email,
          },
        });
      }
      updateFields.email = primaryEmail;
      updateFields.primaryEmailType = emailList[0].type || 'Work';
    }

    // If phones are being updated, set primary phone
    if (phoneList.length > 0) {
      updateFields.phone = phoneList[0].phone;
      updateFields.primaryPhoneType = phoneList[0].type || 'Work';
    }

    // If ownerId is being updated, also update it in the related organization
    if (updateFields.ownerId && person.leadOrganizationId) {
      const org = await LeadOrganization.findByPk(person.leadOrganizationId);
      if (org) {
        await org.update({ ownerId: updateFields.ownerId });
      }
    }

    // Update all fields provided in req.body for the person
    await person.update(updateFields);

    // Update or create custom field values for multiple emails and phones

    if (emailList.length > 0) {
      // Remove existing emails custom field
      await CustomFieldValue.destroy({
        where: {
          fieldId: 'person_emails',
          entityId: personId,
          entityType: 'person'
        }
      });

      // Store new emails if more than one or if explicitly provided as array
      if (emailList.length > 1 || emails) {
        await CustomFieldValue.create({
          fieldId: 'person_emails',
          entityId: personId,
          entityType: 'person',
          value: JSON.stringify(emailList),
          masterUserID,
        });
      }
    }

    if (phoneList.length > 0) {
      // Remove existing phones custom field
      await CustomFieldValue.destroy({
        where: {
          fieldId: 'person_phones',
          entityId: personId,
          entityType: 'person'
        }
      });

      // Store new phones if more than one or if explicitly provided as array
      if (phoneList.length > 1 || phones) {
        await CustomFieldValue.create({
          fieldId: 'person_phones',
          entityId: personId,
          entityType: 'person',
          value: JSON.stringify(phoneList),
          masterUserID,
        });
      }
    }

    // Fetch ownerName via organization.ownerId and MasterUser
    let ownerName = null;
    if (person.leadOrganizationId) {
      const org = await LeadOrganization.findByPk(person.leadOrganizationId);
      if (org && org.ownerId) {
        const owner = await MasterUser.findByPk(org.ownerId);
        if (owner) {
          ownerName = owner.name;
        }
      }
    }

    // Prepare response with multiple emails and phones
    const personResponse = {
      ...person.toJSON(),
      ownerName,
      emails: emailList.length > 0 ? emailList : undefined,
      phones: phoneList.length > 0 ? phoneList : undefined,
    };

    res.status(200).json({
      message: "Person updated successfully",
      person: personResponse,
    });
  } catch (error) {
    console.error("Error updating person:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Helper function to get person with multiple emails and phones
 * @param {number} personId - The person ID
 * @returns {Object} Person object with emails and phones arrays
 */
const getPersonWithContactInfo = async (personId, CustomFieldValue, LeadPerson) => {
  try {
    const person = await LeadPerson.findByPk(personId);
    if (!person) return null;

    // Get custom field values for emails and phones
    const customFieldValues = await CustomFieldValue.findAll({
      where: {
        entityId: personId,
        entityType: 'person',
        fieldId: ['person_emails', 'person_phones']
      }
    });

    let emails = [];
    let phones = [];

    // Parse custom field values
    customFieldValues.forEach(cfv => {
      if (cfv.fieldId === 'person_emails' && cfv.value) {
        try {
          emails = JSON.parse(cfv.value);
        } catch (e) {
          console.warn('Failed to parse person emails:', e);
        }
      }
      if (cfv.fieldId === 'person_phones' && cfv.value) {
        try {
          phones = JSON.parse(cfv.value);
        } catch (e) {
          console.warn('Failed to parse person phones:', e);
        }
      }
    });

    // If no custom field arrays found, use the primary email/phone
    if (emails.length === 0 && person.email) {
      emails = [{ email: person.email, type: 'Work' }];
    }
    if (phones.length === 0 && person.phone) {
      phones = [{ phone: person.phone, type: 'Work' }];
    }

    return {
      ...person.toJSON(),
      emails,
      phones
    };
  } catch (error) {
    console.error('Error getting person with contact info:', error);
    return null;
  }
};

/**
 * Get a single person by ID with multiple emails and phones
 */
exports.getPerson = async (req, res) => {
  const {Email, LeadNote, DealNote, MasterUser, Attachment, OrganizationNote, PersonNote, Deal, LeadOrganization, LeadPerson, Lead, Activity, CustomField, CustomFieldValue, UserCredential} = req.models;
  try {
    const { personId } = req.params;
    
    const person = await getPersonWithContactInfo(personId, CustomFieldValue, LeadPerson);
    if (!person) {
      return res.status(404).json({ message: "Person not found" });
    }

    res.status(200).json({
      message: "Person retrieved successfully",
      person
    });
  } catch (error) {
    console.error("Error getting person:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.linkPersonToOrganization = async (req, res) => {
  const {LeadPerson, LeadOrganization} = req.models;
  const { personId, leadOrganizationId } = req.body;
  try {
    const person = await LeadPerson.findByPk(personId);
    if (!person) return res.status(404).json({ message: "Person not found" });

    if (
      person.leadOrganizationId &&
      person.leadOrganizationId !== leadOrganizationId
    ) {
      return res.status(400).json({
        message: "Person is already linked to another organization.",
        currentOrganizationId: person.leadOrganizationId,
      });
    }

    // Fetch the organization name
    const organization = await LeadOrganization.findByPk(leadOrganizationId);
    if (!organization) {
      return res.status(404).json({ message: "Organization not found" });
    }

    person.leadOrganizationId = leadOrganizationId;
    person.organization = organization.organization; // Update the organization column
    await person.save();

    res.status(200).json({
      message: "Person linked to organization",
      person,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.addPersonNote = async (req, res) => {
  const {LeadPerson, MasterUser, PersonNote } = req.models;
  const { personId } = req.params; // Get personId from params
  if (!personId) {
    return res.status(400).json({ message: "Person ID is required." });
  }
  const { content } = req.body;
  if (!content || content.trim() === "") {
    return res.status(400).json({ message: "Note content is required." });
  }
  try {
    // Verify person exists
    const person = await LeadPerson.findByPk(personId);
    if (!person) {
      return res.status(404).json({ message: "Person not found." });
    }

    const note = await PersonNote.create({
      personId,
      masterUserID: req.adminId,
      content: content.trim(),
      createdBy: req.adminId,
    });

    // Fetch the created note with creator details
    const noteWithCreator = await PersonNote.findByPk(note.noteId, {
      include: [
        {
          model: MasterUser,
          as: "creator",
          attributes: ["masterUserID", "name"],
        },
      ],
    });

    res.status(201).json({
      message: "Note added to person successfully",
      note: noteWithCreator,
    });
  } catch (error) {
    console.error("Error adding person note:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.addOrganizationNote = async (req, res) => {
  const {LeadOrganization, MasterUser, OrganizationNote } = req.models;
  const { leadOrganizationId } = req.params; // Get leadOrganizationId from params
  if (!leadOrganizationId) {
    return res.status(400).json({ message: "Organization ID is required." });
  }
  const { content } = req.body;
  if (!content || content.trim() === "") {
    return res.status(400).json({ message: "Note content is required." });
  }
  try {
    // Verify organization exists
    const organization = await LeadOrganization.findByPk(leadOrganizationId);
    if (!organization) {
      return res.status(404).json({ message: "Organization not found." });
    }

    const note = await OrganizationNote.create({
      leadOrganizationId,
      masterUserID: req.adminId,
      content: content.trim(),
      createdBy: req.adminId,
    });

    // Fetch the created note with creator details
    const noteWithCreator = await OrganizationNote.findByPk(note.noteId, {
      include: [
        {
          model: MasterUser,
          as: "creator",
          attributes: ["masterUserID", "name"],
        },
      ],
    });

    res.status(201).json({
      message: "Note added to organization successfully",
      note: noteWithCreator,
    });
  } catch (error) {
    console.error("Error adding organization note:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get all notes for a person
exports.getPersonNotes = async (req, res) => {
  const {LeadPerson, MasterUser, PersonNote } = req.models;
  const { personId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    // Verify person exists
    const person = await LeadPerson.findByPk(personId);
    if (!person) {
      return res.status(404).json({ message: "Person not found." });
    }

    const { count, rows: notes } = await PersonNote.findAndCountAll({
      where: { personId },
      include: [
        {
          model: MasterUser,
          as: "creator",
          attributes: ["masterUserID", "name"],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset,
    });

    res.status(200).json({
      message: "Person notes fetched successfully",
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
      notes,
    });
  } catch (error) {
    console.error("Error fetching person notes:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get all notes for an organization
exports.getOrganizationNotes = async (req, res) => {
  const {LeadOrganization, MasterUser, OrganizationNote } = req.models;
  const { leadOrganizationId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    // Verify organization exists
    const organization = await LeadOrganization.findByPk(leadOrganizationId);
    if (!organization) {
      return res.status(404).json({ message: "Organization not found." });
    }

    const { count, rows: notes } = await OrganizationNote.findAndCountAll({
      where: { leadOrganizationId },
      include: [
        {
          model: MasterUser,
          as: "creator",
          attributes: ["masterUserID", "name"],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset,
    });

    res.status(200).json({
      message: "Organization notes fetched successfully",
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
      notes,
    });
  } catch (error) {
    console.error("Error fetching organization notes:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update a person note
exports.updatePersonNote = async (req, res) => {
  const {LeadPerson, MasterUser, PersonNote } = req.models;
  const { personId, noteId } = req.params;
  const { content } = req.body;

  if (!content || content.trim() === "") {
    return res.status(400).json({ message: "Note content is required." });
  }

  try {
    // Find the note
    const note = await PersonNote.findOne({
      where: { noteId, personId },
    });

    if (!note) {
      return res.status(404).json({ message: "Note not found." });
    }

    // Check if user has permission to update (only creator or admin)
    if (note.createdBy !== req.adminId && req.role !== "admin") {
      return res
        .status(403)
        .json({ message: "You don't have permission to update this note." });
    }

    // Update the note
    await note.update({ content: content.trim() });

    // Fetch updated note with creator details
    const updatedNote = await PersonNote.findByPk(noteId, {
      include: [
        {
          model: MasterUser,
          as: "creator",
          attributes: ["masterUserID", "name"],
        },
      ],
    });

    res.status(200).json({
      message: "Person note updated successfully",
      note: updatedNote,
    });
  } catch (error) {
    console.error("Error updating person note:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update an organization note
exports.updateOrganizationNote = async (req, res) => {
  const {LeadOrganization, MasterUser, OrganizationNote } = req.models;
  const { leadOrganizationId, noteId } = req.params;
  const { content } = req.body;

  if (!content || content.trim() === "") {
    return res.status(400).json({ message: "Note content is required." });
  }

  try {
    // Find the note
    const note = await OrganizationNote.findOne({
      where: { noteId, leadOrganizationId },
    });

    if (!note) {
      return res.status(404).json({ message: "Note not found." });
    }

    // Check if user has permission to update (only creator or admin)
    if (note.createdBy !== req.adminId && req.role !== "admin") {
      return res
        .status(403)
        .json({ message: "You don't have permission to update this note." });
    }

    // Update the note
    await note.update({ content: content.trim() });

    // Fetch updated note with creator details
    const updatedNote = await OrganizationNote.findByPk(noteId, {
      include: [
        {
          model: MasterUser,
          as: "creator",
          attributes: ["masterUserID", "name"],
        },
      ],
    });

    res.status(200).json({
      message: "Organization note updated successfully",
      note: updatedNote,
    });
  } catch (error) {
    console.error("Error updating organization note:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete a person note
exports.deletePersonNote = async (req, res) => {
  const {LeadPerson, MasterUser, PersonNote } = req.models;
  const { personId, noteId } = req.params;

  try {
    // Find the note
    const note = await PersonNote.findOne({
      where: { noteId, personId },
    });

    if (!note) {
      return res.status(404).json({ message: "Note not found." });
    }

    // Check if user has permission to delete (only creator or admin)
    if (note.createdBy !== req.adminId && req.role !== "admin") {
      return res
        .status(403)
        .json({ message: "You don't have permission to delete this note." });
    }

    // Delete the note
    await note.destroy();

    res.status(200).json({
      message: "Person note deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting person note:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete an organization note
exports.deleteOrganizationNote = async (req, res) => {
  const {LeadOrganization, MasterUser, OrganizationNote } = req.models;
  const { leadOrganizationId, noteId } = req.params;

  try {
    // Find the note
    const note = await OrganizationNote.findOne({
      where: { noteId, leadOrganizationId },
    });

    if (!note) {
      return res.status(404).json({ message: "Note not found." });
    }

    // Check if user has permission to delete (only creator or admin)
    if (note.createdBy !== req.adminId && req.role !== "admin") {
      return res
        .status(403)
        .json({ message: "You don't have permission to delete this note." });
    }

    // Delete the note
    await note.destroy();

    res.status(200).json({
      message: "Organization note deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting organization note:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// exports.getAllContactPersons = async (req, res) => {
//   try {
//     const { search = "" } = req.query;

//     const where = search
//       ? { contactPerson: { [Op.like]: `%${search}%` } }
//       : {};

//     const persons = await Person.findAll({
//       where,
//       attributes: ["personId", "contactPerson", "email"],
//       order: [["contactPerson", "ASC"]],
//       raw: true
//     });

//     res.status(200).json({
//       contactPersons: persons // Array of { personId, contactPerson }
//     });
//   } catch (error) {
//     console.error("Error fetching contact persons:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// };

exports.getAllContactPersons = async (req, res) => {
  const { LeadPerson, LeadOrganization } = req.models;
  try {
    const { search = "", page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = search ? { contactPerson: { [Op.like]: `%${search}%` } } : {};

    // Include organization using association
    const { count, rows: persons } = await LeadPerson.findAndCountAll({
      where,
      attributes: ["personId", "contactPerson", "email", "leadOrganizationId"],
      include: [
        {
          model: LeadOrganization,
          as: "LeadOrganization", // Make sure this matches your association
          attributes: ["leadOrganizationId", "organization"],
        },
      ],
      order: [["contactPerson", "ASC"]],
      limit: parseInt(limit),
      offset,
    });

    // Format response to include organization info at top level
    const contactPersons = persons.map((person) => ({
      personId: person.personId,
      contactPerson: person.contactPerson,
      email: person.email,
      organization: person.LeadOrganization
        ? {
            leadOrganizationId: person.LeadOrganization.leadOrganizationId,
            organization: person.LeadOrganization.organization,
          }
        : null,
    }));

    res.status(200).json({
      contactPersons,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching contact persons:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getPersonsByOrganization = async (req, res) => {
  const { LeadPerson: Person, LeadOrganization: Organization, MasterUser } = req.models;
  const { leadOrganizationId } = req.params;
  try {
    // Find the organization
    const organization = await Organization.findByPk(leadOrganizationId);
    if (!organization) {
      return res.status(404).json({ message: "Organization not found" });
    }

    // Find all persons linked to this organization
    const persons = await Person.findAll({
      where: { leadOrganizationId },
      attributes: [
        "personId",
        "contactPerson",
        "email",
        "phone",
        "jobTitle",
        "personLabels",
        "organization",
      ],
      order: [["contactPerson", "ASC"]],
    });

    // Fetch ownerName from MasterUser using organization.ownerId
    let ownerName = null;
    if (organization.ownerId) {
      const owner = await MasterUser.findByPk(organization.ownerId);
      if (owner) {
        ownerName = owner.name;
      }
    }

    // Add ownerName to each person object
    const personsWithOwner = persons.map((person) => ({
      ...person.toJSON(),
      ownerName,
    }));

    res.status(200).json({
      organization: organization.organization,
      persons: personsWithOwner,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// Helper function to enrich persons with timeline activities (Pipedrive-style)
const enrichPersonsWithTimeline = async (persons, activityFilters, startDate, endDate, userIdRequesting, userRole, granularity = 'quarterly', includeOverdueCount = true, Activity, Email, Deal, ActivityType) => {
  try {
    console.log('[DEBUG] enrichPersonsWithTimeline called with:', {
      personsCount: persons.length,
      activityFilters,
      startDate,
      endDate,
      userIdRequesting,
      userRole,
      granularity,
      includeOverdueCount
    });

    const { Op } = require("sequelize");
    const Sequelize = require("sequelize");
    
    // Import models dynamically to avoid circular dependencies
    
    const personIds = persons.map(p => p.personId).filter(Boolean);
    const orgIds = persons.map(p => p.leadOrganizationId).filter(Boolean);
    
    console.log('[DEBUG] Extracted IDs:', { personIds, orgIds });
    
    if (personIds.length === 0) {
      console.log('[DEBUG] No person IDs found, returning original persons');
      return persons;
    }

    // Fetch all active ActivityTypes from database
    const activityTypes = await ActivityType.findAll({
      where: { isActive: true },
      attributes: ['activityTypeId', 'name', 'icon'],
      raw: true
    });
    
    console.log('[DEBUG] Found ActivityTypes:', activityTypes.length);
    
    // Create maps for quick lookup
    const activityTypeMap = {};
    const activityTypeCategories = ['deals', 'emails', 'notes']; // Static categories
    
    activityTypes.forEach(type => {
      const typeName = type.name.toLowerCase();
      activityTypeMap[typeName] = type;
      if (!activityTypeCategories.includes(typeName)) {
        activityTypeCategories.push(typeName);
      }
    });
    
    console.log('[DEBUG] Activity type categories:', activityTypeCategories);

    const timelineActivities = {};
    const overdueStats = {};
    
    // Initialize timeline for each person with dynamic categories
    personIds.forEach(personId => {
      const personTimeline = {
        deals: [],
        emails: [],
        notes: [],
        timeline: []
      };
      
      // Add dynamic activity type categories
      activityTypes.forEach(type => {
        const typeName = type.name.toLowerCase();
        personTimeline[typeName] = [];
      });
      
      timelineActivities[personId] = personTimeline;
      
      overdueStats[personId] = {
        overdueCount: 0,
        totalActivitiesCount: 0,
        hasOverdueActivities: false
      };
    });

    console.log('[DEBUG] Initialized timeline activities for persons:', Object.keys(timelineActivities));

    // Fetch Deals if requested
    if (activityFilters.includes('deals')) {
      console.log('[DEBUG] Fetching deals...');
      let dealWhere = {
        [Op.or]: [
          { personId: { [Op.in]: personIds } },
          { leadOrganizationId: { [Op.in]: orgIds } }
        ]
      };
      
      // Add role-based filtering for deals
      if (userRole !== 'admin') {
        dealWhere = {
          [Op.and]: [
            dealWhere,
            { [Op.or]: [{ masterUserID: userIdRequesting }, { ownerId: userIdRequesting }] }
          ]
        };
      }

      console.log('[DEBUG] Deal where clause:', JSON.stringify(dealWhere, null, 2));

      const deals = await Deal.findAll({
        where: dealWhere,
        attributes: [
          'dealId', 'title', 'value', 'currency', 'pipelineStage', 'status',
          'personId', 'leadOrganizationId', 'createdAt', 'updatedAt', 'expectedCloseDate'
        ],
        raw: true
      });

      console.log('[DEBUG] Found deals:', deals.length);
      if (deals.length > 0) {
        console.log('[DEBUG] Sample deal:', deals[0]);
      }

      deals.forEach(deal => {
        const timelineItem = {
          type: 'deal',
          id: deal.dealId,
          title: deal.title,
          value: deal.value,
          currency: deal.currency,
          stage: deal.pipelineStage,
          status: deal.status,
          date: deal.createdAt,
          expectedCloseDate: deal.expectedCloseDate,
          quarter: getQuarter(deal.createdAt)
        };

        if (deal.personId && timelineActivities[deal.personId]) {
          timelineActivities[deal.personId].deals.push(timelineItem);
          timelineActivities[deal.personId].timeline.push(timelineItem);
          console.log('[DEBUG] Added deal to person:', deal.personId);
        }
        
        // Also add to persons in the same organization
        if (deal.leadOrganizationId) {
          personIds.forEach(personId => {
            const person = persons.find(p => p.personId === personId);
            if (person && person.leadOrganizationId === deal.leadOrganizationId && !deal.personId) {
              timelineActivities[personId].deals.push(timelineItem);
              timelineActivities[personId].timeline.push(timelineItem);
              console.log('[DEBUG] Added deal to person via organization:', personId);
            }
          });
        }
      });
    }

    // Fetch Emails if requested
    if (activityFilters.includes('emails')) {
      let emailWhere = {
        createdAt: { [Op.between]: [startDate, endDate] },
        masterUserID: userRole === 'admin' ? { [Op.ne]: null } : userIdRequesting
      };

      const emails = await Email.findAll({
        where: emailWhere,
        attributes: [
          'emailID', 'subject', 'sender', 'senderName', 'recipient', 
          'folder', 'isRead', 'createdAt', 'masterUserID'
        ],
        raw: true
      });

      // Match emails to persons by email address
      emails.forEach(email => {
        const timelineItem = {
          type: 'email',
          id: email.emailID,
          subject: email.subject,
          sender: email.sender,
          senderName: email.senderName,
          recipient: email.recipient,
          folder: email.folder,
          isRead: email.isRead,
          date: email.createdAt,
          quarter: getQuarter(email.createdAt)
        };

        // Match emails to persons by email address
        personIds.forEach(personId => {
          const person = persons.find(p => p.personId === personId);
          if (person && person.email) {
            const personEmail = person.email.toLowerCase();
            const emailSender = (email.sender || '').toLowerCase();
            const emailRecipient = (email.recipient || '').toLowerCase();
            
            if (emailSender.includes(personEmail) || emailRecipient.includes(personEmail)) {
              timelineActivities[personId].emails.push(timelineItem);
              timelineActivities[personId].timeline.push(timelineItem);
            }
          }
        });
      });
    }

    // Fetch Activities with dynamic types if requested
    const requestedActivityTypes = activityFilters.filter(f => 
      !['deals', 'emails', 'notes'].includes(f) && 
      (activityTypeCategories.includes(f) || f === 'meeting' || f === 'task' || f === 'deadline')
    );
    
    if (requestedActivityTypes.length > 0) {
      let activityWhere = {
        [Op.or]: [
          { personId: { [Op.in]: personIds } },
          { leadOrganizationId: { [Op.in]: orgIds } }
        ],
        startDateTime: { [Op.between]: [startDate, endDate] }
      };

      // Add role-based filtering for activities
      if (userRole !== 'admin') {
        activityWhere = {
          ...activityWhere,
          [Op.and]: [
            activityWhere,
            { [Op.or]: [{ masterUserID: userIdRequesting }, { assignedTo: userIdRequesting }] }
          ]
        };
      }

      const activities = await Activity.findAll({
        where: activityWhere,
        attributes: [
          'activityId', 'type', 'subject', 'startDateTime', 'endDateTime',
          'priority', 'location', 'notes', 'isDone', 'dueDate',
          'personId', 'leadOrganizationId', 'createdAt'
        ],
        raw: true
      });

      console.log('[DEBUG] Found activities:', activities.length);

      activities.forEach(activity => {
        const activityType = activity.type.toLowerCase();
        
        // Track overdue activities
        const now = new Date();
        const dueDate = activity.dueDate ? new Date(activity.dueDate) : null;
        const isOverdue = dueDate && dueDate < now && !activity.isDone;
        
        // Get ActivityType metadata
        const activityTypeMeta = activityTypeMap[activityType] || {
          activityTypeId: null,
          name: activity.type,
          icon: 'default'
        };
        
        const timelineItem = {
          type: activityType,
          id: activity.activityId,
          subject: activity.subject,
          startDateTime: activity.startDateTime,
          endDateTime: activity.endDateTime,
          priority: activity.priority,
          location: activity.location,
          notes: activity.notes,
          isDone: activity.isDone,
          dueDate: activity.dueDate,
          date: activity.startDateTime || activity.createdAt,
          quarter: getQuarter(activity.startDateTime || activity.createdAt, granularity),
          isOverdue: isOverdue,
          // Add ActivityType metadata
          activityTypeMeta: {
            id: activityTypeMeta.activityTypeId,
            name: activityTypeMeta.name,
            icon: activityTypeMeta.icon
          }
        };

        if (activity.personId && timelineActivities[activity.personId]) {
          // Track overdue stats for this person
          if (includeOverdueCount) {
            overdueStats[activity.personId].totalActivitiesCount++;
            if (isOverdue) {
              overdueStats[activity.personId].overdueCount++;
              overdueStats[activity.personId].hasOverdueActivities = true;
            }
          }
          
          // Add to specific activity type category if it exists in timeline structure
          if (timelineActivities[activity.personId][activityType]) {
            timelineActivities[activity.personId][activityType].push(timelineItem);
          }
          
          // Add to notes category if activity has notes and notes filter is active
          if (activityFilters.includes('notes') && activity.notes) {
            timelineActivities[activity.personId].notes.push(timelineItem);
          }
          
          // Add to deadline category if activity has dueDate and deadline filter is active
          if (activityFilters.includes('deadline') && activity.dueDate) {
            // Create deadline category if not exists
            if (!timelineActivities[activity.personId].deadline) {
              timelineActivities[activity.personId].deadline = [];
            }
            timelineActivities[activity.personId].deadline.push(timelineItem);
          }
          
          timelineActivities[activity.personId].timeline.push(timelineItem);
        }
        
        // Also add to persons in the same organization
        if (activity.leadOrganizationId) {
          personIds.forEach(personId => {
            const person = persons.find(p => p.personId === personId);
            if (person && person.leadOrganizationId === activity.leadOrganizationId && !activity.personId) {
              // Track overdue stats for this person
              if (includeOverdueCount) {
                overdueStats[personId].totalActivitiesCount++;
                if (isOverdue) {
                  overdueStats[personId].overdueCount++;
                  overdueStats[personId].hasOverdueActivities = true;
                }
              }
              
              // Add to specific activity type category if it exists
              if (timelineActivities[personId][activityType]) {
                timelineActivities[personId][activityType].push(timelineItem);
              }
              
              if (activityFilters.includes('notes') && activity.notes) {
                timelineActivities[personId].notes.push(timelineItem);
              }
              
              if (activityFilters.includes('deadline') && activity.dueDate) {
                if (!timelineActivities[personId].deadline) {
                  timelineActivities[personId].deadline = [];
                }
                timelineActivities[personId].deadline.push(timelineItem);
              }
              
              timelineActivities[personId].timeline.push(timelineItem);
            }
          });
        }
      });
    }

    // Sort timeline activities by date for each person
    Object.keys(timelineActivities).forEach(personId => {
      Object.keys(timelineActivities[personId]).forEach(key => {
        if (Array.isArray(timelineActivities[personId][key])) {
          timelineActivities[personId][key].sort((a, b) => new Date(b.date) - new Date(a.date));
        }
      });
    });

    console.log('[DEBUG] Final timeline activities summary:');
    Object.keys(timelineActivities).forEach(personId => {
      const activities = timelineActivities[personId];
      const summary = {
        deals: activities.deals.length,
        emails: activities.emails.length,
        notes: activities.notes.length,
        timeline: activities.timeline.length
      };
      
      // Add dynamic activity type counts
      activityTypes.forEach(type => {
        const typeName = type.name.toLowerCase();
        if (activities[typeName]) {
          summary[typeName] = activities[typeName].length;
        }
      });
      
      console.log(`[DEBUG] Person ${personId}:`, summary);
    });

    // Attach timeline data and overdue statistics to persons
    const enrichedPersons = persons.map(person => {
      const baseTimeline = {
        deals: [],
        emails: [],
        notes: [],
        timeline: []
      };
      
      // Add dynamic activity type arrays
      activityTypes.forEach(type => {
        const typeName = type.name.toLowerCase();
        baseTimeline[typeName] = [];
      });
      
      return {
        ...person,
        timelineActivities: timelineActivities[person.personId] || baseTimeline,
        // Add overdue statistics (Pipedrive-style red warning indicator)
        overdueStats: includeOverdueCount ? overdueStats[person.personId] || {
          overdueCount: 0,
          totalActivitiesCount: 0,
          hasOverdueActivities: false
        } : undefined,
        // Include available activity types for reference
        availableActivityTypes: activityTypes.map(type => ({
          id: type.activityTypeId,
          name: type.name,
          icon: type.icon
        }))
      };
    });

    console.log('[DEBUG] Returning enriched persons:', enrichedPersons.length);
    console.log('[DEBUG] Sample enriched person:', enrichedPersons[0] ? {
      personId: enrichedPersons[0].personId,
      contactPerson: enrichedPersons[0].contactPerson,
      hasTimelineActivities: !!enrichedPersons[0].timelineActivities,
      timelineKeys: enrichedPersons[0].timelineActivities ? Object.keys(enrichedPersons[0].timelineActivities) : [],
      overdueCount: enrichedPersons[0].overdueStats ? enrichedPersons[0].overdueStats.overdueCount : 'N/A'
    } : 'No persons found');

    return enrichedPersons;

  } catch (error) {
    console.error('Error enriching persons with timeline:', error);
    // Return persons without timeline data if there's an error
    return persons;
  }
};

// Helper function to determine time period from date based on granularity
const getQuarter = (date, granularity = 'quarterly') => {
  const d = new Date(date);
  const month = d.getMonth() + 1; // getMonth() returns 0-11
  const year = d.getFullYear();
  const week = Math.ceil(d.getDate() / 7);
  
  switch (granularity.toLowerCase()) {
    case 'weekly':
      return `Week ${week}, ${d.toLocaleDateString('en-US', { month: 'short' })} ${year}`;
    case 'monthly':
      return `${d.toLocaleDateString('en-US', { month: 'long' })} ${year}`;
    case 'quarterly':
    default:
      if (month <= 3) return `Q1 ${year}`;
      if (month <= 6) return `Q2 ${year}`;
      if (month <= 9) return `Q3 ${year}`;
      return `Q4 ${year}`;
  }
};

exports.getPersonsByIds = async (req, res) => {
  const {Lead, LeadPerson : Person, LeadOrganization : Organization, Deal, MasterUser, PersonColumnPreference, OrganizationColumnPreference, CustomField, CustomFieldValue} = req.models;
  try {
    // Import required models
    const { Op } = require("sequelize");
    const Sequelize = require("sequelize");

    // Get personId(s) from query params or request body
    let personIds = [];
    
    // Handle single personId
    if (req.query.personId) {
      personIds = [req.query.personId];
    }
    
    // Handle multiple personIds from query (comma-separated)
    if (req.query.personIds) {
      const queryPersonIds = Array.isArray(req.query.personIds) 
        ? req.query.personIds 
        : req.query.personIds.split(',');
      personIds = [...personIds, ...queryPersonIds];
    }
    
    // Handle personIds from request body
    if (req.body && req.body.personIds) {
      const bodyPersonIds = Array.isArray(req.body.personIds) 
        ? req.body.personIds 
        : [req.body.personIds];
      personIds = [...personIds, ...bodyPersonIds];
    }
    
    // Handle single personId from request body
    if (req.body && req.body.personId) {
      personIds.push(req.body.personId);
    }

    // Remove duplicates and convert to integers
    personIds = [...new Set(personIds)].map(id => parseInt(id)).filter(id => !isNaN(id));

    if (personIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "personId or personIds parameter is required"
      });
    }

    console.log('[DEBUG] Fetching persons for IDs:', personIds);

    // Build where clause for person filtering
    let personWhere = {
      personId: { [Op.in]: personIds }
    };

    // Apply role-based filtering
    if (req.role !== "admin") {
      personWhere.masterUserID = req.adminId;
    }

    // Fetch persons
    const persons = await Person.findAll({
      where: personWhere,
      raw: true,
    });

    if (persons.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No persons found for the provided IDs"
      });
    }

    console.log(`[DEBUG] Found ${persons.length} persons`);

    // Get organization IDs from persons for organization data lookup
    const orgIds = [...new Set(persons.map(p => p.leadOrganizationId).filter(Boolean))];
    
    // Fetch related organizations if any
    let organizations = [];
    if (orgIds.length > 0) {
      let orgWhere = {
        leadOrganizationId: { [Op.in]: orgIds }
      };

      if (req.role !== "admin") {
        orgWhere.masterUserID = req.adminId;
      }

      organizations = await Organization.findAll({
        where: orgWhere,
        raw: true,
      });
    }

    // Build org map for quick lookup
    const orgMap = {};
    organizations.forEach((org) => {
      orgMap[org.leadOrganizationId] = org;
    });

    // Get all unique ownerIds from persons and organizations
    const orgOwnerIds = organizations.map((o) => o.ownerId).filter(Boolean);
    const personOwnerIds = persons.map((p) => p.ownerId).filter(Boolean);
    const ownerIds = [...new Set([...orgOwnerIds, ...personOwnerIds])];

    // Fetch owner names from MasterUser
    const owners = await MasterUser.findAll({
      where: { masterUserID: ownerIds },
      attributes: ["masterUserID", "name"],
      raw: true,
    });
    const ownerMap = {};
    owners.forEach((o) => {
      ownerMap[o.masterUserID] = o.name;
    });

    // Count leads for each person
    const leadCounts = await Lead.findAll({
      attributes: [
        "personId",
        "leadOrganizationId",
        [Sequelize.fn("COUNT", Sequelize.col("leadId")), "leadCount"],
      ],
      where: {
        [Op.or]: [
          { personId: { [Op.in]: personIds } }, 
          { leadOrganizationId: { [Op.in]: orgIds } }
        ],
      },
      group: ["personId", "leadOrganizationId"],
      raw: true,
    });

    // Build maps for quick lookup
    const personLeadCountMap = {};
    const orgLeadCountMap = {};
    leadCounts.forEach((lc) => {
      if (lc.personId)
        personLeadCountMap[lc.personId] = parseInt(lc.leadCount, 10);
      if (lc.leadOrganizationId)
        orgLeadCountMap[lc.leadOrganizationId] = parseInt(lc.leadCount, 10);
    });

    // Enrich persons with computed fields
    let enrichedPersons = persons.map((p) => {
      let ownerName = null;
      let organizationName = p.organization; // Keep existing organization name if present
      
      if (p.leadOrganizationId && orgMap[p.leadOrganizationId]) {
        const org = orgMap[p.leadOrganizationId];
        // Set organization name from the related organization
        organizationName = org.organization || p.organization;
        
        if (org.ownerId && ownerMap[org.ownerId]) {
          ownerName = ownerMap[org.ownerId];
        }
      }
      
      // Add person's own owner name if available
      if (p.ownerId && ownerMap[p.ownerId]) {
        ownerName = ownerMap[p.ownerId];
      }

      return {
        ...p,
        organization: organizationName,
        ownerName,
        leadCount: personLeadCountMap[p.personId] || 0,
      };
    });

    // Fetch custom field values for all persons
    let customFieldValues = [];
    if (personIds.length > 0) {
      customFieldValues = await CustomFieldValue.findAll({
        where: {
          entityId: { [Op.in]: personIds.map(id => id.toString()) },
          entityType: "person",
          masterUserID: req.adminId
        },
        raw: true,
      });
    }

    // Fetch all custom fields for person entity
    const allCustomFields = await CustomField.findAll({
      where: {
        entityType: { [Op.in]: ["person", "both"] },
        isActive: true,
      },
      raw: true,
    });

    const customFieldIdToName = {};
    allCustomFields.forEach((cf) => {
      customFieldIdToName[cf.fieldId] = cf.fieldName;
    });

    // Map personId to their custom field values as { fieldName: value }
    const personCustomFieldsMap = {};
    customFieldValues.forEach((cfv) => {
      const fieldName = customFieldIdToName[cfv.fieldId] || cfv.fieldId;
      if (!personCustomFieldsMap[cfv.entityId])
        personCustomFieldsMap[cfv.entityId] = {};
      personCustomFieldsMap[cfv.entityId][fieldName] = cfv.value;
    });

    // Attach custom fields as direct properties to each person
    enrichedPersons = enrichedPersons.map((p) => {
      const customFields = personCustomFieldsMap[p.personId.toString()] || {};
      return { ...p, ...customFields };
    });

    // Fetch column preferences to filter displayed fields
    const personColumnPref = await PersonColumnPreference.findOne({ where: {} });

    // Helper function to filter data based on column preferences
    const filterDataByColumnPreference = (data, columnPreference, entityType) => {
      if (!columnPreference || !columnPreference.columns) {
        return data;
      }

      let columns = [];
      if (columnPreference.columns) {
        columns = typeof columnPreference.columns === "string" 
          ? JSON.parse(columnPreference.columns) 
          : columnPreference.columns;
      }

      // Filter to only include columns where check is true
      const checkedColumns = columns.filter(col => col.check === true);
      const allowedFields = checkedColumns.map(col => col.key);

      // Always include essential fields regardless of preferences
      const essentialFields = ['personId', 'leadOrganizationId', 'organization', 'ownerName', 'leadCount'];
      const finalAllowedFields = [...new Set([...allowedFields, ...essentialFields])];

      return data.map(item => {
        const filteredItem = {};
        finalAllowedFields.forEach(field => {
          if (item.hasOwnProperty(field)) {
            filteredItem[field] = item[field];
          }
        });
        // Add entity information
        filteredItem.entity = entityType;
        return filteredItem;
      });
    };

    // Filter persons based on person column preferences
    const filteredPersons = filterDataByColumnPreference(enrichedPersons, personColumnPref, 'person');

    // Prepare response with detailed information
    res.status(200).json({
      success: true,
      message: `Successfully fetched ${filteredPersons.length} person(s)`,
      data: {
        persons: filteredPersons,
        totalCount: filteredPersons.length,
        requestedIds: personIds,
        foundIds: filteredPersons.map(p => p.personId),
        missingIds: personIds.filter(id => !filteredPersons.some(p => p.personId === id)),
        columnFiltering: {
          enabled: !!(personColumnPref && personColumnPref.columns),
          totalAvailableFields: Object.keys(Person.rawAttributes).length + allCustomFields.length,
          displayedFields: personColumnPref && personColumnPref.columns ? 
            (typeof personColumnPref.columns === "string" ? JSON.parse(personColumnPref.columns) : personColumnPref.columns)
              .filter(col => col.check === true).length + 5 : // +5 for essential fields
            Object.keys(Person.rawAttributes).length + allCustomFields.length
        }
      }
    });

  } catch (error) {
    console.error("Error fetching persons by IDs:", error);
    res.status(500).json({ 
      success: false,
      message: "Internal server error",
      error: error.message 
    });
  }
};

exports.getOrganizationsByIds = async (req, res) => {
  const {Lead, LeadPerson : Person, LeadOrganization : Organization, Deal, MasterUser, PersonColumnPreference, OrganizationColumnPreference, CustomField, CustomFieldValue} = req.models;
  try {
    // Import required models
    const { Op } = require("sequelize");
    const Sequelize = require("sequelize");

    // Get organizationId(s) from query params or request body
    let organizationIds = [];
    
    // Handle single organizationId
    if (req.query.organizationId) {
      organizationIds = [req.query.organizationId];
    }
    
    // Handle single leadOrganizationId (alias)
    if (req.query.leadOrganizationId) {
      organizationIds = [req.query.leadOrganizationId];
    }
    
    // Handle multiple organizationIds from query (comma-separated)
    if (req.query.organizationIds) {
      const queryOrgIds = Array.isArray(req.query.organizationIds) 
        ? req.query.organizationIds 
        : req.query.organizationIds.split(',');
      organizationIds = [...organizationIds, ...queryOrgIds];
    }
    
    // Handle multiple leadOrganizationIds from query (comma-separated)
    if (req.query.leadOrganizationIds) {
      const queryOrgIds = Array.isArray(req.query.leadOrganizationIds) 
        ? req.query.leadOrganizationIds 
        : req.query.leadOrganizationIds.split(',');
      organizationIds = [...organizationIds, ...queryOrgIds];
    }
    
    // Handle organizationIds from request body
    if (req.body && req.body.organizationIds) {
      const bodyOrgIds = Array.isArray(req.body.organizationIds) 
        ? req.body.organizationIds 
        : [req.body.organizationIds];
      organizationIds = [...organizationIds, ...bodyOrgIds];
    }
    
    // Handle leadOrganizationIds from request body
    if (req.body && req.body.leadOrganizationIds) {
      const bodyOrgIds = Array.isArray(req.body.leadOrganizationIds) 
        ? req.body.leadOrganizationIds 
        : [req.body.leadOrganizationIds];
      organizationIds = [...organizationIds, ...bodyOrgIds];
    }
    
    // Handle single organizationId from request body
    if (req.body && req.body.organizationId) {
      organizationIds.push(req.body.organizationId);
    }
    
    // Handle single leadOrganizationId from request body
    if (req.body && req.body.leadOrganizationId) {
      organizationIds.push(req.body.leadOrganizationId);
    }

    // Remove duplicates and convert to integers
    organizationIds = [...new Set(organizationIds)].map(id => parseInt(id)).filter(id => !isNaN(id));

    if (organizationIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "organizationId/leadOrganizationId or organizationIds/leadOrganizationIds parameter is required"
      });
    }

    console.log('[DEBUG] Fetching organizations for IDs:', organizationIds);

    // Build where clause for organization filtering
    let orgWhere = {
      leadOrganizationId: { [Op.in]: organizationIds }
    };

    // Apply role-based filtering
    if (req.role !== "admin") {
      orgWhere.masterUserID = req.adminId;
    }

    // Fetch organizations
    const organizations = await Organization.findAll({
      where: orgWhere,
      raw: true,
    });

    if (organizations.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No organizations found for the provided IDs"
      });
    }

    console.log(`[DEBUG] Found ${organizations.length} organizations`);

    // Get organization IDs for related data lookup
    const orgIds = organizations.map(org => org.leadOrganizationId);

    // Get all unique ownerIds from organizations
    const orgOwnerIds = organizations.map((o) => o.ownerId).filter(Boolean);

    // Fetch owner names from MasterUser
    const owners = await MasterUser.findAll({
      where: { masterUserID: orgOwnerIds },
      attributes: ["masterUserID", "name"],
      raw: true,
    });
    const ownerMap = {};
    owners.forEach((o) => {
      ownerMap[o.masterUserID] = o.name;
    });

    // Count leads for each organization
    const leadCounts = await Lead.findAll({
      attributes: [
        "leadOrganizationId",
        [Sequelize.fn("COUNT", Sequelize.col("leadId")), "leadCount"],
      ],
      where: {
        leadOrganizationId: { [Op.in]: orgIds }
      },
      group: ["leadOrganizationId"],
      raw: true,
    });

    // Build map for quick lookup
    const orgLeadCountMap = {};
    leadCounts.forEach((lc) => {
      if (lc.leadOrganizationId)
        orgLeadCountMap[lc.leadOrganizationId] = parseInt(lc.leadCount, 10);
    });

    // Enrich organizations with computed fields
    let enrichedOrganizations = organizations.map((org) => {
      return {
        ...org,
        ownerName: ownerMap[org.ownerId] || null,
        leadCount: orgLeadCountMap[org.leadOrganizationId] || 0,
      };
    });

    // Fetch custom field values for all organizations
    let customFieldValues = [];
    if (organizationIds.length > 0) {
      customFieldValues = await CustomFieldValue.findAll({
        where: {
          entityId: { [Op.in]: organizationIds.map(id => id.toString()) },
          entityType: "organization",
          masterUserID: req.adminId
        },
        raw: true,
      });
    }

    // Fetch all custom fields for organization entity
    const allCustomFields = await CustomField.findAll({
      where: {
        entityType: { [Op.in]: ["organization", "both"] },
        isActive: true,
      },
      raw: true,
    });

    const customFieldIdToName = {};
    allCustomFields.forEach((cf) => {
      customFieldIdToName[cf.fieldId] = cf.fieldName;
    });

    // Map organizationId to their custom field values as { fieldName: value }
    const orgCustomFieldsMap = {};
    customFieldValues.forEach((cfv) => {
      const fieldName = customFieldIdToName[cfv.fieldId] || cfv.fieldId;
      if (!orgCustomFieldsMap[cfv.entityId])
        orgCustomFieldsMap[cfv.entityId] = {};
      orgCustomFieldsMap[cfv.entityId][fieldName] = cfv.value;
    });

    // Attach custom fields as direct properties to each organization
    enrichedOrganizations = enrichedOrganizations.map((org) => {
      const customFields = orgCustomFieldsMap[org.leadOrganizationId.toString()] || {};
      return { ...org, ...customFields };
    });

    // Fetch column preferences to filter displayed fields
    const orgColumnPref = await OrganizationColumnPreference.findOne({ where: {} });

    // Helper function to filter data based on column preferences
    const filterDataByColumnPreference = (data, columnPreference, entityType) => {
      if (!columnPreference || !columnPreference.columns) {
        return data;
      }

      let columns = [];
      if (columnPreference.columns) {
        columns = typeof columnPreference.columns === "string" 
          ? JSON.parse(columnPreference.columns) 
          : columnPreference.columns;
      }

      // Filter to only include columns where check is true
      const checkedColumns = columns.filter(col => col.check === true);
      const allowedFields = checkedColumns.map(col => col.key);

      // Always include essential fields regardless of preferences
      const essentialFields = ['leadOrganizationId', 'organization', 'ownerName', 'leadCount'];
      const finalAllowedFields = [...new Set([...allowedFields, ...essentialFields])];

      return data.map(item => {
        const filteredItem = {};
        finalAllowedFields.forEach(field => {
          if (item.hasOwnProperty(field)) {
            filteredItem[field] = item[field];
          }
        });
        // Add entity information
        filteredItem.entity = entityType;
        return filteredItem;
      });
    };

    // Filter organizations based on organization column preferences
    const filteredOrganizations = filterDataByColumnPreference(enrichedOrganizations, orgColumnPref, 'organization');

    // Prepare response with detailed information
    res.status(200).json({
      success: true,
      message: `Successfully fetched ${filteredOrganizations.length} organization(s)`,
      data: {
        organizations: filteredOrganizations,
        totalCount: filteredOrganizations.length,
        requestedIds: organizationIds,
        foundIds: filteredOrganizations.map(org => org.leadOrganizationId),
        missingIds: organizationIds.filter(id => !filteredOrganizations.some(org => org.leadOrganizationId === id)),
        columnFiltering: {
          enabled: !!(orgColumnPref && orgColumnPref.columns),
          totalAvailableFields: Object.keys(Organization.rawAttributes).length + allCustomFields.length,
          displayedFields: orgColumnPref && orgColumnPref.columns ? 
            (typeof orgColumnPref.columns === "string" ? JSON.parse(orgColumnPref.columns) : orgColumnPref.columns)
              .filter(col => col.check === true).length + 4 : // +4 for essential fields
            Object.keys(Organization.rawAttributes).length + allCustomFields.length
        }
      }
    });

  } catch (error) {
    console.error("Error fetching organizations by IDs:", error);
    res.status(500).json({ 
      success: false,
      message: "Internal server error",
      error: error.message 
    });
  }
};

exports.getPersonsAndOrganizations = async (req, res) => {
  const {Activity, Email, Deal, ActivityType, Lead, MasterUser, PersonColumnPreference, OrganizationColumnPreference, LeadPerson : Person, LeadOrganization : Organization, Product, DealProduct, LeadFilter, GroupVisibility, CustomFieldValue, CustomField} = req.models;
  try {
    // Import required models at the beginning of the function
    // const CustomField = require("../../models/customFieldModel");
    // const CustomFieldValue = require("../../models/customFieldValueModel");
    const { Op } = require("sequelize");
    const Sequelize = require("sequelize");

    // Pagination and search for persons
    const personPage = parseInt(req.query.personPage) || 1;
    const personLimit = parseInt(req.query.personLimit) || 20;
    const personOffset = (personPage - 1) * personLimit;
    const personSearch = req.query.personSearch || "";

     // Get sort parameters
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder || 'DESC';

    // Pagination and search for organizations
    const orgPage = parseInt(req.query.orgPage) || 1;
    const orgLimit = parseInt(req.query.orgLimit) || 20;
    const orgOffset = (orgPage - 1) * orgLimit;
    const orgSearch = req.query.orgSearch || "";

    // Timeline activity filters - similar to Pipedrive interface
    const activityFilters = req.query.activityFilters ? 
      (Array.isArray(req.query.activityFilters) ? req.query.activityFilters : req.query.activityFilters.split(',')) 
      : ['deals', 'emails', 'notes', 'meeting', 'task', 'deadline'];
    
    const includeTimeline = req.query.includeTimeline === 'true' || req.query.includeTimeline === true;
    
    // Timeline granularity options (weekly, monthly, quarterly)
    const timelineGranularity = req.query.timelineGranularity || 'quarterly'; // weekly, monthly, quarterly
    
    // Date range filtering options (similar to Pipedrive's dropdown)
    const dateRangeFilter = req.query.dateRangeFilter || '12-months-back'; // 1-month-back, 3-months-back, 6-months-back, 12-months-back
    
    // Calculate start date based on date range filter
    let calculatedStartDate;
    const now = new Date();
    switch (dateRangeFilter) {
      case '1-month-back':
        calculatedStartDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      case '3-months-back':
        calculatedStartDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        break;
      case '6-months-back':
        calculatedStartDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        break;
      case '12-months-back':
      default:
        calculatedStartDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
    }
    
    const timelineStartDate = req.query.timelineStartDate || calculatedStartDate.toISOString();
    const timelineEndDate = req.query.timelineEndDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(); // 1 year from now
    
    // Overdue activities tracking flag
    const includeOverdueCount = req.query.includeOverdueCount === 'true' || req.query.includeOverdueCount === true || includeTimeline;

    // Handle specific person IDs from request body or query parameters
    let specificPersonIds = [];
    
    // Handle multiple personIds from query (comma-separated)
    if (req.query.personIds) {
      specificPersonIds = req.query.personIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    }
    
    // Handle personIds from request body
    if (req.body && req.body.personIds) {
      if (Array.isArray(req.body.personIds)) {
        specificPersonIds = [...specificPersonIds, ...req.body.personIds.map(id => parseInt(id)).filter(id => !isNaN(id))];
      } else if (typeof req.body.personIds === 'string') {
        specificPersonIds = [...specificPersonIds, ...req.body.personIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))];
      }
    }
    
    // Handle single personId from request body
    if (req.body && req.body.personId) {
      const singlePersonId = parseInt(req.body.personId);
      if (!isNaN(singlePersonId)) {
        specificPersonIds.push(singlePersonId);
      }
    }
    
    // Remove duplicates
    specificPersonIds = [...new Set(specificPersonIds)];
    
    console.log('[DEBUG] Specific person IDs requested:', specificPersonIds);

    // Dynamic filter config (from body or query) -- now supports filterId as number or object
  
    let filterConfig = null;
    let filterIdRaw = null;
    if (req.body && req.body.filterId !== undefined) {
      filterIdRaw = req.body.filterId;
    } else if (req.query && req.query.filterId !== undefined) {
      filterIdRaw = req.query.filterId;
    }

    // If filterIdRaw is a number, fetch filterConfig from DB
    if (filterIdRaw !== null && filterIdRaw !== undefined) {
      if (typeof filterIdRaw === "string" && /^\d+$/.test(filterIdRaw)) {
        // filterIdRaw is a string number
        const filterRow = await LeadFilter.findByPk(parseInt(filterIdRaw));
        if (filterRow && filterRow.filterConfig) {
          // Parse the filterConfig if it's a JSON string from database
          if (typeof filterRow.filterConfig === "string") {
            try {
              filterConfig = JSON.parse(filterRow.filterConfig);
              console.log(
                "[DEBUG] Parsed filterConfig from DB string:",
                JSON.stringify(filterConfig, null, 2)
              );
            } catch (e) {
              console.log(
                "[DEBUG] Error parsing filterConfig string from DB:",
                e.message
              );
              filterConfig = null;
            }
          } else {
            filterConfig = filterRow.filterConfig;
          }
        }
      } else if (typeof filterIdRaw === "number") {
        const filterRow = await LeadFilter.findByPk(filterIdRaw);
        if (filterRow && filterRow.filterConfig) {
          // Parse the filterConfig if it's a JSON string from database
          if (typeof filterRow.filterConfig === "string") {
            try {
              filterConfig = JSON.parse(filterRow.filterConfig);
              console.log(
                "[DEBUG] Parsed filterConfig from DB string:",
                JSON.stringify(filterConfig, null, 2)
              );
            } catch (e) {
              console.log(
                "[DEBUG] Error parsing filterConfig string from DB:",
                e.message
              );
              filterConfig = null;
            }
          } else {
            filterConfig = filterRow.filterConfig;
          }
        }
      } else {
        // Try to parse as JSON object
        try {
          filterConfig =
            typeof filterIdRaw === "string"
              ? JSON.parse(filterIdRaw)
              : filterIdRaw;
        } catch (e) {
          filterConfig = null;
        }
      }
    }

    let personWhere = {};
    let leadWhere = {};
    let dealWhere = {};
    let organizationWhere = {};
    let activityWhere = {};
    let productWhere = {};
    let dealProductWhere = {};
    // Debug: print filterConfig
    console.log("[DEBUG] filterConfig:", JSON.stringify(filterConfig, null, 2));
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
      between: Op.between,
      notBetween: Op.notBetween,
    };
    const operatorMap = {
      is: "eq",
      "is not": "ne",
      "is empty": "isEmpty",
      "is not empty": "isNotEmpty",
      contains: "like",
      "does not contain": "notLike",
      "is exactly or earlier than": "lte",
      "is earlier than": "lt",
      "is exactly or later than": "gte",
      "not equals": "ne",
      "greater than": "gt",
      "greater than or equal": "gte",
      "less than": "lt",
      "less than or equal": "lte",
    };

    // Helper function to build a single condition - following the pattern from other APIs
    function buildCondition(cond) {
      console.log(
        "[DEBUG] buildCondition called with:",
        JSON.stringify(cond, null, 2)
      );

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
        between: Op.between,
        notBetween: Op.notBetween,
      };

      let operator = cond.operator;
      console.log("[DEBUG] Original operator:", operator);

      if (operatorMap[operator]) {
        operator = operatorMap[operator];
        console.log("[DEBUG] Mapped operator:", operator);
      }

      // Handle "is empty" and "is not empty"
      if (operator === "isEmpty" || operator === "is empty") {
        const result = { [cond.field]: { [Op.is]: null } };
        console.log(
          "[DEBUG] isEmpty condition result:",
          JSON.stringify(result, null, 2)
        );
        return result;
      }
      if (operator === "isNotEmpty" || operator === "is not empty") {
        const result = {
          [Op.and]: [
            { [cond.field]: { [Op.not]: null } },
            { [cond.field]: { [Op.ne]: "" } },
          ],
        };
        console.log(
          "[DEBUG] isNotEmpty condition result:",
          JSON.stringify(result, null, 2)
        );
        return result;
      }

      // Handle "contains" and "does not contain" for text fields
      if (operator === "like" || operator === "contains") {
        const result = { [cond.field]: { [Op.like]: `%${cond.value}%` } };
        console.log(
          "[DEBUG] like condition result:",
          JSON.stringify(result, null, 2)
        );
        return result;
      }
      if (operator === "notLike" || operator === "does not contain") {
        const result = { [cond.field]: { [Op.notLike]: `%${cond.value}%` } };
        console.log(
          "[DEBUG] notLike condition result:",
          JSON.stringify(result, null, 2)
        );
        return result;
      }

      // Handle "is" operator for exact match
      if (operator === "is" || operator === "eq") {
        const result = { [cond.field]: cond.value };
        console.log(
          "[DEBUG] is/eq condition result:",
          JSON.stringify(result, null, 2)
        );
        return result;
      }

      // Default condition
      const finalOperator = ops[operator] || Op.eq;
      console.log("[DEBUG] Final operator symbol:", finalOperator);
      console.log("[DEBUG] Condition value:", cond.value);
      console.log("[DEBUG] Condition field:", cond.field);

      const result = {
        [cond.field]: {
          [finalOperator]: cond.value,
        },
      };
      console.log(
        "[DEBUG] Default condition result:",
        JSON.stringify(result, null, 2)
      );

      // Additional validation
      if (cond.value === undefined || cond.value === null) {
        console.log("[DEBUG] WARNING: cond.value is undefined or null!");
        console.log(
          "[DEBUG] Full condition object:",
          JSON.stringify(cond, null, 2)
        );
      }

      return result;
    }

    // Get model field names for validation
    const personFields = Object.keys(Person.rawAttributes);
    const leadFields = Object.keys(Lead.rawAttributes);
    const dealFields = Object.keys(Deal.rawAttributes);
    const organizationFields = Object.keys(Organization.rawAttributes);

    let activityFields = [];
    try {
      activityFields = Object.keys(Activity.rawAttributes);
    } catch (e) {
      console.log("[DEBUG] Activity model not available:", e.message);
    }

    let productFields = [];
    let dealProductFields = [];
    try {
      productFields = Object.keys(Product.rawAttributes);
      dealProductFields = Object.keys(DealProduct.rawAttributes);
    } catch (e) {
      console.log("[DEBUG] Product models not available:", e.message);
    }

    console.log("[DEBUG] Available fields:");
    console.log("- Person fields:", personFields.slice(0, 5), "...");
    console.log("- Lead fields:", leadFields.slice(0, 5), "...");
    console.log("- Deal fields:", dealFields.slice(0, 5), "...");
    console.log(
      "- Organization fields:",
      organizationFields.slice(0, 5),
      "..."
    );
    console.log("- Activity fields:", activityFields.slice(0, 5), "...");
    console.log("- Product fields:", productFields.slice(0, 5), "...");
    console.log("- DealProduct fields:", dealProductFields.slice(0, 5), "...");

    // If filterConfig is provided, build AND/OR logic for all entities
    if (filterConfig && typeof filterConfig === "object") {
      // AND conditions
      if (Array.isArray(filterConfig.all) && filterConfig.all.length > 0) {
        console.log("[DEBUG] Processing 'all' conditions:", filterConfig.all);

        filterConfig.all.forEach(function (cond) {
          console.log(`[DEBUG] Processing AND condition:`, cond);

          if (cond.entity) {
            // Entity is explicitly specified
            switch (cond.entity.toLowerCase()) {
              case "person":
                if (personFields.includes(cond.field)) {
                  if (!personWhere[Op.and]) personWhere[Op.and] = [];
                  personWhere[Op.and].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Person AND condition for field: ${cond.field}`
                  );
                }
                break;
              case "lead":
                if (leadFields.includes(cond.field)) {
                  if (!leadWhere[Op.and]) leadWhere[Op.and] = [];
                  leadWhere[Op.and].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Lead AND condition for field: ${cond.field}`
                  );
                }
                break;
              case "deal":
                if (dealFields.includes(cond.field)) {
                  if (!dealWhere[Op.and]) dealWhere[Op.and] = [];
                  dealWhere[Op.and].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Deal AND condition for field: ${cond.field}`
                  );
                }
                break;
              case "organization":
                if (organizationFields.includes(cond.field)) {
                  if (!organizationWhere[Op.and])
                    organizationWhere[Op.and] = [];
                  organizationWhere[Op.and].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Organization AND condition for field: ${cond.field}`
                  );
                }
                break;
              case "activity":
                console.log(`[DEBUG] Processing activity condition:`, cond);
                console.log(
                  `[DEBUG] Available activity fields:`,
                  activityFields
                );
                console.log(
                  `[DEBUG] Checking if field '${cond.field}' is in activity fields`
                );
                if (activityFields.includes(cond.field)) {
                  if (!activityWhere[Op.and]) activityWhere[Op.and] = [];
                  const condition = buildCondition(cond);
                  console.log(
                    `[DEBUG] Built activity condition:`,
                    JSON.stringify(condition, null, 2)
                  );
                  activityWhere[Op.and].push(condition);
                  console.log(
                    `[DEBUG] Added Activity AND condition for field: ${cond.field}`
                  );
                  console.log(
                    `[DEBUG] Current activityWhere[Op.and]:`,
                    JSON.stringify(activityWhere[Op.and], null, 2)
                  );
                  console.log(
                    `[DEBUG] Current activityWhere:`,
                    JSON.stringify(activityWhere, null, 2)
                  );
                } else {
                  console.log(
                    `[DEBUG] Field '${cond.field}' NOT found in activity fields:`,
                    activityFields
                  );
                }
                break;
              case "product":
                if (productFields.includes(cond.field)) {
                  if (!productWhere[Op.and]) productWhere[Op.and] = [];
                  productWhere[Op.and].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Product AND condition for field: ${cond.field}`
                  );
                }
                break;
              case "dealproduct":
                if (dealProductFields.includes(cond.field)) {
                  if (!dealProductWhere[Op.and]) dealProductWhere[Op.and] = [];
                  dealProductWhere[Op.and].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added DealProduct AND condition for field: ${cond.field}`
                  );
                }
                break;
              default:
                console.log(`[DEBUG] Unknown entity: ${cond.entity}`);
            }
          } else {
            // Auto-detect entity based on field name
            if (personFields.includes(cond.field)) {
              if (!personWhere[Op.and]) personWhere[Op.and] = [];
              personWhere[Op.and].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Person AND condition for field: ${cond.field}`
              );
            } else if (leadFields.includes(cond.field)) {
              if (!leadWhere[Op.and]) leadWhere[Op.and] = [];
              leadWhere[Op.and].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Lead AND condition for field: ${cond.field}`
              );
            } else if (dealFields.includes(cond.field)) {
              if (!dealWhere[Op.and]) dealWhere[Op.and] = [];
              dealWhere[Op.and].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Deal AND condition for field: ${cond.field}`
              );
            } else if (organizationFields.includes(cond.field)) {
              if (!organizationWhere[Op.and]) organizationWhere[Op.and] = [];
              organizationWhere[Op.and].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Organization AND condition for field: ${cond.field}`
              );
            } else if (activityFields.includes(cond.field)) {
              console.log(
                `[DEBUG] Auto-detecting activity condition for field: ${cond.field}`
              );
              if (!activityWhere[Op.and]) activityWhere[Op.and] = [];
              const condition = buildCondition(cond);
              console.log(
                `[DEBUG] Built auto-detected activity condition:`,
                JSON.stringify(condition, null, 2)
              );
              activityWhere[Op.and].push(condition);
              console.log(
                `[DEBUG] Auto-detected Activity AND condition for field: ${cond.field}`
              );
              console.log(
                `[DEBUG] Current activityWhere after auto-detection:`,
                JSON.stringify(activityWhere, null, 2)
              );
            } else {
              console.log(
                `[DEBUG] Field '${cond.field}' not found in any entity`
              );
              console.log(`[DEBUG] Available fields summary:`);
              console.log(`  - Person: ${personFields.length} fields`);
              console.log(`  - Lead: ${leadFields.length} fields`);
              console.log(`  - Deal: ${dealFields.length} fields`);
              console.log(
                `  - Organization: ${organizationFields.length} fields`
              );
              console.log(`  - Activity: ${activityFields.length} fields`);
            }
          }
        });
      }

      // OR conditions
      if (Array.isArray(filterConfig.any) && filterConfig.any.length > 0) {
        console.log("[DEBUG] Processing 'any' conditions:", filterConfig.any);

        filterConfig.any.forEach(function (cond) {
          console.log(`[DEBUG] Processing OR condition:`, cond);

          if (cond.entity) {
            // Entity is explicitly specified
            switch (cond.entity.toLowerCase()) {
              case "person":
                if (personFields.includes(cond.field)) {
                  if (!personWhere[Op.or]) personWhere[Op.or] = [];
                  personWhere[Op.or].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Person OR condition for field: ${cond.field}`
                  );
                }
                break;
              case "lead":
                if (leadFields.includes(cond.field)) {
                  if (!leadWhere[Op.or]) leadWhere[Op.or] = [];
                  leadWhere[Op.or].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Lead OR condition for field: ${cond.field}`
                  );
                }
                break;
              case "deal":
                if (dealFields.includes(cond.field)) {
                  if (!dealWhere[Op.or]) dealWhere[Op.or] = [];
                  dealWhere[Op.or].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Deal OR condition for field: ${cond.field}`
                  );
                }
                break;
              case "organization":
                if (organizationFields.includes(cond.field)) {
                  if (!organizationWhere[Op.or]) organizationWhere[Op.or] = [];
                  organizationWhere[Op.or].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Organization OR condition for field: ${cond.field}`
                  );
                }
                break;
              case "activity":
                if (activityFields.includes(cond.field)) {
                  if (!activityWhere[Op.or]) activityWhere[Op.or] = [];
                  activityWhere[Op.or].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Activity OR condition for field: ${cond.field}`
                  );
                }
                break;
              default:
                console.log(`[DEBUG] Unknown entity: ${cond.entity}`);
            }
          } else {
            // Auto-detect entity based on field name
            if (personFields.includes(cond.field)) {
              if (!personWhere[Op.or]) personWhere[Op.or] = [];
              personWhere[Op.or].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Person OR condition for field: ${cond.field}`
              );
            } else if (leadFields.includes(cond.field)) {
              if (!leadWhere[Op.or]) leadWhere[Op.or] = [];
              leadWhere[Op.or].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Lead OR condition for field: ${cond.field}`
              );
            } else if (dealFields.includes(cond.field)) {
              if (!dealWhere[Op.or]) dealWhere[Op.or] = [];
              dealWhere[Op.or].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Deal OR condition for field: ${cond.field}`
              );
            } else if (organizationFields.includes(cond.field)) {
              if (!organizationWhere[Op.or]) organizationWhere[Op.or] = [];
              organizationWhere[Op.or].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Organization OR condition for field: ${cond.field}`
              );
            } else if (activityFields.includes(cond.field)) {
              if (!activityWhere[Op.or]) activityWhere[Op.or] = [];
              activityWhere[Op.or].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Activity OR condition for field: ${cond.field}`
              );
            } else {
              console.log(
                `[DEBUG] Field '${cond.field}' not found in any entity`
              );
            }
          }
        });
      }
    } else if (personSearch) {
      // Fallback to search logic if no filterConfig
      if (personSearch.length === 1) {
        // If personSearch is a single character, filter contactPerson by first letter only
        personWhere.contactPerson = { [Op.like]: `${personSearch}%` };
      } else {
        personWhere[Op.or] = [
          { contactPerson: { [Op.like]: `%${personSearch}%` } },
          { email: { [Op.like]: `%${personSearch}%` } },
          { phone: { [Op.like]: `%${personSearch}%` } },
          { jobTitle: { [Op.like]: `%${personSearch}%` } },
          { personLabels: { [Op.like]: `%${personSearch}%` } },
          { organization: { [Op.like]: `%${personSearch}%` } },
        ];
      }
    }

    // Debug: log all where clauses
    console.log("[DEBUG] Final where clauses:");
    console.log("- personWhere:", JSON.stringify(personWhere, null, 2));
    console.log("- leadWhere:", JSON.stringify(leadWhere, null, 2));
    console.log("- dealWhere:", JSON.stringify(dealWhere, null, 2));
    console.log(
      "- organizationWhere:",
      JSON.stringify(organizationWhere, null, 2)
    );
    console.log("- activityWhere:", JSON.stringify(activityWhere, null, 2));
    console.log("- productWhere:", JSON.stringify(productWhere, null, 2));
    console.log("- dealProductWhere:", JSON.stringify(dealProductWhere, null, 2));

    // Additional debug for contactPerson filtering
    if (filterConfig && filterConfig.all && filterConfig.all.length > 0) {
      const contactPersonFilter = filterConfig.all.find(
        (cond) => cond.field === "contactPerson" && cond.entity === "Person"
      );
      if (contactPersonFilter) {
        console.log("[DEBUG] Found contactPerson filter:", contactPersonFilter);
        console.log(
          "[DEBUG] Checking if personWhere contains contactPerson condition..."
        );

        // Test the exact query that will be run
        const testQuery = await Person.findAll({
          where: { contactPerson: contactPersonFilter.value },
          attributes: ["personId", "contactPerson"],
          limit: 5,
          raw: true,
        });
        console.log(
          "[DEBUG] Test query for exact contactPerson match:",
          testQuery
        );
      }
    }

    // Check if any conditions exist (including Op.and arrays)
    const hasActivityFilters =
      Object.keys(activityWhere).length > 0 ||
      (activityWhere[Op.and] && activityWhere[Op.and].length > 0);
    const hasLeadFilters =
      Object.keys(leadWhere).length > 0 ||
      (leadWhere[Op.and] && leadWhere[Op.and].length > 0);
    const hasDealFilters =
      Object.keys(dealWhere).length > 0 ||
      (dealWhere[Op.and] && dealWhere[Op.and].length > 0);
    const hasOrgFilters =
      Object.keys(organizationWhere).length > 0 ||
      (organizationWhere[Op.and] && organizationWhere[Op.and].length > 0);
    const hasProductFilters =
      Object.keys(productWhere).length > 0 ||
      (productWhere[Op.and] && productWhere[Op.and].length > 0) ||
      (productWhere[Op.or] && productWhere[Op.or].length > 0);
    const hasDealProductFilters =
      Object.keys(dealProductWhere).length > 0 ||
      (dealProductWhere[Op.and] && dealProductWhere[Op.and].length > 0) ||
      (dealProductWhere[Op.or] && dealProductWhere[Op.or].length > 0);

    console.log("[DEBUG] Filter detection:");
    console.log("- hasActivityFilters:", hasActivityFilters);
    console.log("- hasLeadFilters:", hasLeadFilters);
    console.log("- hasDealFilters:", hasDealFilters);
    console.log("- hasOrgFilters:", hasOrgFilters);
    console.log("- hasProductFilters:", hasProductFilters);
    console.log("- hasDealProductFilters:", hasDealProductFilters);

    if (hasActivityFilters) {
      console.log(
        "[DEBUG] Activity filter conditions:",
        activityWhere[Op.and] || activityWhere
      );
    }

    // Apply Lead filters to get relevant person IDs
    let leadFilteredPersonIds = [];
    const hasLeadFiltersSymbol =
      leadWhere[Op.and]?.length > 0 ||
      leadWhere[Op.or]?.length > 0 ||
      Object.keys(leadWhere).some((key) => typeof key === "string");

    if (hasLeadFiltersSymbol) {
      console.log("[DEBUG] Applying Lead filters to find persons");
      console.log("[DEBUG] leadWhere has filters:", {
        andConditions: leadWhere[Op.and]?.length || 0,
        orConditions: leadWhere[Op.or]?.length || 0,
        stringKeys: Object.keys(leadWhere).filter(
          (key) => typeof key === "string"
        ),
      });

      let leadFilterResults = [];
      if (req.role === "admin") {
        leadFilterResults = await Lead.findAll({
          where: leadWhere,
          attributes: ["personId", "leadOrganizationId"],
          raw: true,
        });
      } else {
        leadFilterResults = await Lead.findAll({
          where: {
            ...leadWhere,
            [Op.or]: [{ masterUserID: req.adminId }, { ownerId: req.adminId }],
          },
          attributes: ["personId", "leadOrganizationId"],
          raw: true,
        });
      }

      console.log(
        "[DEBUG] Lead filter results:",
        leadFilterResults.length,
        "leads found"
      );

      // Get person IDs directly from leads
      const directPersonIds = leadFilterResults
        .map((lead) => lead.personId)
        .filter(Boolean);

      // Get organization IDs from leads, then find persons in those organizations
      const leadOrgIds = leadFilterResults
        .map((lead) => lead.leadOrganizationId)
        .filter(Boolean);

      let orgPersonIds = [];
      if (leadOrgIds.length > 0) {
        const personsInOrgs = await Person.findAll({
          where: { leadOrganizationId: { [Op.in]: leadOrgIds } },
          attributes: ["personId"],
          raw: true,
        });
        orgPersonIds = personsInOrgs.map((p) => p.personId);
      }

      leadFilteredPersonIds = [
        ...new Set([...directPersonIds, ...orgPersonIds]),
      ];

      console.log(
        "[DEBUG] Lead-filtered person IDs:",
        leadFilteredPersonIds.length
      );
    }

    // Apply Activity filters to get relevant person IDs
    let activityFilteredPersonIds = [];
    const hasActivityFiltersSymbol =
      activityWhere[Op.and]?.length > 0 ||
      activityWhere[Op.or]?.length > 0 ||
      Object.keys(activityWhere).some((key) => typeof key === "string");

    if (hasActivityFiltersSymbol) {
      console.log("[DEBUG] Applying Activity filters to find persons");
      console.log("[DEBUG] activityWhere has filters:", {
        andConditions: activityWhere[Op.and]?.length || 0,
        orConditions: activityWhere[Op.or]?.length || 0,
        stringKeys: Object.keys(activityWhere).filter(
          (key) => typeof key === "string"
        ),
      });

      try {
        let activityFilterResults = [];

        if (req.role === "admin") {
          activityFilterResults = await Activity.findAll({
            where: activityWhere,
            attributes: ["personId", "leadOrganizationId"],
            raw: true,
          });
        } else {
          activityFilterResults = await Activity.findAll({
            where: {
              ...activityWhere,
              [Op.or]: [
                { masterUserID: req.adminId },
                { assignedTo: req.adminId },
              ],
            },
            attributes: ["personId", "leadOrganizationId"],
            raw: true,
          });
        }

        console.log(
          "[DEBUG] Activity filter results:",
          activityFilterResults.length,
          "activities found"
        );

        // Get person IDs directly from activities
        const directPersonIds = activityFilterResults
          .map((activity) => activity.personId)
          .filter(Boolean);

        // Get organization IDs from activities, then find persons in those organizations
        const activityOrgIds = activityFilterResults
          .map((activity) => activity.leadOrganizationId)
          .filter(Boolean);

        let orgPersonIds = [];
        if (activityOrgIds.length > 0) {
          const personsInOrgs = await Person.findAll({
            where: { leadOrganizationId: { [Op.in]: activityOrgIds } },
            attributes: ["personId"],
            raw: true,
          });
          orgPersonIds = personsInOrgs.map((p) => p.personId);
        }

        activityFilteredPersonIds = [
          ...new Set([...directPersonIds, ...orgPersonIds]),
        ];

        console.log(
          "[DEBUG] Activity-filtered person IDs:",
          activityFilteredPersonIds.length
        );
      } catch (e) {
        console.log("[DEBUG] Error applying Activity filters:", e.message);
      }
    }

    // Apply Deal filters to get relevant person IDs
    let dealFilteredPersonIds = [];
    const hasDealFiltersSymbol =
      dealWhere[Op.and]?.length > 0 ||
      dealWhere[Op.or]?.length > 0 ||
      Object.keys(dealWhere).some((key) => typeof key === "string");

    if (hasDealFiltersSymbol) {
      console.log("[DEBUG] Applying Deal filters to find persons");
      console.log("[DEBUG] dealWhere has filters:", {
        andConditions: dealWhere[Op.and]?.length || 0,
        orConditions: dealWhere[Op.or]?.length || 0,
        stringKeys: Object.keys(dealWhere).filter(
          (key) => typeof key === "string"
        ),
      });

      let dealFilterResults = [];
      if (req.role === "admin") {
        dealFilterResults = await Deal.findAll({
          where: dealWhere,
          attributes: ["personId", "leadOrganizationId"],
          raw: true,
        });
      } else {
        dealFilterResults = await Deal.findAll({
          where: {
            ...dealWhere,
            [Op.or]: [{ masterUserID: req.adminId }, { ownerId: req.adminId }],
          },
          attributes: ["personId", "leadOrganizationId"],
          raw: true,
        });
      }

      console.log(
        "[DEBUG] Deal filter results:",
        dealFilterResults.length,
        "deals found"
      );

      // Get person IDs directly from deals
      const directPersonIds = dealFilterResults
        .map((deal) => deal.personId)
        .filter(Boolean);

      // Get organization IDs from deals, then find persons in those organizations
      const dealOrgIds = dealFilterResults
        .map((deal) => deal.leadOrganizationId)
        .filter(Boolean);

      let orgPersonIds = [];
      if (dealOrgIds.length > 0) {
        const personsInOrgs = await Person.findAll({
          where: { leadOrganizationId: { [Op.in]: dealOrgIds } },
          attributes: ["personId"],
          raw: true,
        });
        orgPersonIds = personsInOrgs.map((p) => p.personId);
      }

      dealFilteredPersonIds = [
        ...new Set([...directPersonIds, ...orgPersonIds]),
      ];

      console.log(
        "[DEBUG] Deal-filtered person IDs:",
        dealFilteredPersonIds.length
      );
    }

    // Apply Organization filters to get relevant person IDs
    let orgFilteredPersonIds = [];
    const hasOrgFiltersSymbol =
      organizationWhere[Op.and]?.length > 0 ||
      organizationWhere[Op.or]?.length > 0 ||
      Object.keys(organizationWhere).some((key) => typeof key === "string");

    if (hasOrgFiltersSymbol) {
      console.log("[DEBUG] Applying Organization filters to find persons");
      console.log("[DEBUG] organizationWhere has filters:", {
        andConditions: organizationWhere[Op.and]?.length || 0,
        orConditions: organizationWhere[Op.or]?.length || 0,
        stringKeys: Object.keys(organizationWhere).filter(
          (key) => typeof key === "string"
        ),
      });

      let orgFilterResults = [];
      if (req.role === "admin") {
        orgFilterResults = await Organization.findAll({
          where: organizationWhere,
          attributes: ["leadOrganizationId"],
          raw: true,
        });
      } else {
        orgFilterResults = await Organization.findAll({
          where: {
            ...organizationWhere,
            [Op.or]: [{ masterUserID: req.adminId }, { ownerId: req.adminId }],
          },
          attributes: ["leadOrganizationId"],
          raw: true,
        });
      }

      console.log(
        "[DEBUG] Organization filter results:",
        orgFilterResults.length,
        "organizations found"
      );

      // Get organization IDs, then find persons in those organizations
      const orgIds = orgFilterResults.map((org) => org.leadOrganizationId);

      if (orgIds.length > 0) {
        const personsInOrgs = await Person.findAll({
          where: { leadOrganizationId: { [Op.in]: orgIds } },
          attributes: ["personId"],
          raw: true,
        });
        orgFilteredPersonIds = personsInOrgs.map((p) => p.personId);
      }

      console.log(
        "[DEBUG] Organization-filtered person IDs:",
        orgFilteredPersonIds.length
      );
    }

    // Apply Person filters directly
    let personFilteredPersonIds = [];
    const hasPersonFiltersSymbol =
      personWhere[Op.and]?.length > 0 ||
      personWhere[Op.or]?.length > 0 ||
      Object.keys(personWhere).some((key) => typeof key === "string");

    if (hasPersonFiltersSymbol) {
      console.log("[DEBUG] Applying Person filters to find persons");
      console.log("[DEBUG] personWhere has filters:", {
        andConditions: personWhere[Op.and]?.length || 0,
        orConditions: personWhere[Op.or]?.length || 0,
        stringKeys: Object.keys(personWhere).filter(
          (key) => typeof key === "string"
        ),
        fullPersonWhere: JSON.stringify(personWhere, null, 2),
      });

      let personFilterResults = [];
      if (req.role === "admin") {
        personFilterResults = await Person.findAll({
          where: personWhere,
          attributes: ["personId"],
          raw: true,
        });
      } else {
        // For non-admin users, we need to be careful about combining filters
        const userAccessWhere = {
          [Op.or]: [{ masterUserID: req.adminId }],
        };

        const combinedWhere = {
          [Op.and]: [personWhere, userAccessWhere],
        };

        console.log(
          "[DEBUG] Combined where for non-admin:",
          JSON.stringify(combinedWhere, null, 2)
        );

        personFilterResults = await Person.findAll({
          where: combinedWhere,
          attributes: ["personId"],
          raw: true,
        });
      }

      console.log(
        "[DEBUG] Person filter results:",
        personFilterResults.length,
        "persons found"
      );

      // Get person IDs directly from person filters
      personFilteredPersonIds = personFilterResults.map(
        (person) => person.personId
      );

      console.log(
        "[DEBUG] Person-filtered person IDs:",
        personFilteredPersonIds.length
      );
    }

    // Apply Product filters to get relevant person IDs (through deals)
    let productFilteredPersonIds = [];
    const hasProductFiltersSymbol =
      productWhere[Op.and]?.length > 0 ||
      productWhere[Op.or]?.length > 0 ||
      Object.keys(productWhere).some((key) => typeof key === "string");
    const hasDealProductFiltersSymbol =
      dealProductWhere[Op.and]?.length > 0 ||
      dealProductWhere[Op.or]?.length > 0 ||
      Object.keys(dealProductWhere).some((key) => typeof key === "string");

    if (hasProductFiltersSymbol || hasDealProductFiltersSymbol) {
      console.log("[DEBUG] Applying Product filters to find persons through deals");
      console.log("[DEBUG] productWhere:", JSON.stringify(productWhere, null, 2));
      console.log("[DEBUG] dealProductWhere:", JSON.stringify(dealProductWhere, null, 2));

      try {
        
        // Build the include chain: Deal -> DealProduct -> Product
        const dealInclude = [];
        
        if (hasProductFiltersSymbol || hasDealProductFiltersSymbol) {
          const dealProductInclude = {
            model: DealProduct,
            as: "dealProducts",
            required: true,
            attributes: []
          };
          
          // Add DealProduct WHERE conditions if they exist
          if (hasDealProductFiltersSymbol) {
            dealProductInclude.where = dealProductWhere;
          }
          
          // Add Product include with WHERE conditions if they exist
          if (hasProductFiltersSymbol) {
            dealProductInclude.include = [{
              model: Product,
              as: "product",
              where: productWhere,
              required: true,
              attributes: []
            }];
          } else {
            // Just include product without filter
            dealProductInclude.include = [{
              model: Product,
              as: "product",
              required: true,
              attributes: []
            }];
          }
          
          dealInclude.push(dealProductInclude);
        }
        
        // Query deals that have matching products
        let dealsWithProducts = [];
        if (req.role === "admin") {
          dealsWithProducts = await Deal.findAll({
            include: dealInclude,
            attributes: ["personId", "leadOrganizationId"],
            raw: false
          });
        } else {
          dealsWithProducts = await Deal.findAll({
            where: {
              [Op.or]: [
                { masterUserID: req.adminId },
                { ownerId: req.adminId }
              ]
            },
            include: dealInclude,
            attributes: ["personId", "leadOrganizationId"],
            raw: false
          });
        }
        
        console.log(
          "[DEBUG] Product filter results:",
          dealsWithProducts.length,
          "deals found with matching products"
        );
        
        // Get person IDs directly from deals (only direct connections, not organization members)
        const directPersonIds = dealsWithProducts
          .map((deal) => deal.personId)
          .filter(Boolean);
        
        productFilteredPersonIds = [...new Set(directPersonIds)];
        
        console.log(
          "[DEBUG] Product-filtered person IDs:",
          productFilteredPersonIds.length
        );
      } catch (e) {
        console.log("[DEBUG] Error applying Product filters:", e.message);
        console.error("[DEBUG] Full error:", e);
      }
    }

    // Role-based filtering logic for organizations
    let orgWhere = orgSearch
      ? {
          [Op.or]: [
            { organization: { [Op.like]: `%${orgSearch}%` } },
            { organizationLabels: { [Op.like]: `%${orgSearch}%` } },
            { address: { [Op.like]: `%${orgSearch}%` } },
          ],
        }
      : {};

    // Fetch organizations with proper pagination
    let orgQueryResult = { count: 0, rows: [] };
    if (req.role === "admin") {
      orgQueryResult = await Organization.findAndCountAll({
        where: orgWhere,
        limit: orgLimit,
        offset: orgOffset,
        raw: true,
      });
    } else {
      orgQueryResult = await Organization.findAndCountAll({
        where: {
          ...orgWhere,
          [Op.or]: [{ masterUserID: req.adminId }, { ownerId: req.adminId }],
        },
        limit: orgLimit,
        offset: orgOffset,
        raw: true,
      });
    }

    // Extract organizations and total count from query result
    let organizations = orgQueryResult.rows;
    const totalOrganizationsCount = orgQueryResult.count;

    const orgIds = organizations.map((o) => o.leadOrganizationId);

    console.log("[DEBUG] organizations count:", organizations.length);
    console.log("[DEBUG] total organizations count from DB:", totalOrganizationsCount);

    // Apply Lead, Activity, Deal, Organization, Person, and Product filters by restricting to persons found in those entities
    const allFilteredPersonIds = [
      ...new Set([
        ...leadFilteredPersonIds,
        ...activityFilteredPersonIds,
        ...dealFilteredPersonIds,
        ...orgFilteredPersonIds,
        ...personFilteredPersonIds,
        ...productFilteredPersonIds, // Include persons from product filters
        ...specificPersonIds, // Include specific person IDs requested
      ]),
    ];

    // Merge personWhere from filters with filtered person IDs
    let finalPersonWhere = { ...personWhere };

    // If specific person IDs are provided, prioritize them
    if (specificPersonIds.length > 0) {
      console.log(
        "[DEBUG] Specific person IDs provided, restricting to:",
        specificPersonIds.length,
        "person IDs"
      );
      
      if (Object.keys(finalPersonWhere).length > 0) {
        // Combine specific IDs with existing filters using AND
        finalPersonWhere = {
          [Op.and]: [
            finalPersonWhere,
            { personId: { [Op.in]: specificPersonIds } },
          ],
        };
      } else {
        // Only specific person IDs apply
        finalPersonWhere = { personId: { [Op.in]: specificPersonIds } };
      }
    } else if (allFilteredPersonIds.length > 0) {
      console.log(
        "[DEBUG] Applying combined filters: restricting to person IDs:",
        allFilteredPersonIds.length
      );
      console.log(
        "[DEBUG] - From leads:",
        leadFilteredPersonIds.length,
        "person IDs"
      );
      console.log(
        "[DEBUG] - From activities:",
        activityFilteredPersonIds.length,
        "person IDs"
      );
      console.log(
        "[DEBUG] - From deals:",
        dealFilteredPersonIds.length,
        "person IDs"
      );
      console.log(
        "[DEBUG] - From organizations:",
        orgFilteredPersonIds.length,
        "person IDs"
      );
      console.log(
        "[DEBUG] - From persons:",
        personFilteredPersonIds.length,
        "person IDs"
      );
      console.log(
        "[DEBUG] - From products:",
        productFilteredPersonIds.length,
        "person IDs"
      );

      if (Object.keys(finalPersonWhere).length > 0) {
        // Combine with existing filters using AND
        finalPersonWhere = {
          [Op.and]: [
            finalPersonWhere,
            { personId: { [Op.in]: allFilteredPersonIds } },
          ],
        };
      } else {
        // Only entity filters apply
        finalPersonWhere = { personId: { [Op.in]: allFilteredPersonIds } };
      }
    } else if (
      hasLeadFiltersSymbol ||
      hasActivityFiltersSymbol ||
      hasDealFiltersSymbol ||
      hasOrgFiltersSymbol ||
      hasPersonFiltersSymbol ||
      hasProductFiltersSymbol ||
      hasDealProductFiltersSymbol
    ) {
      // If entity filters were applied but no matching persons found, return empty results
      console.log(
        "[DEBUG] Entity filters applied but no matching persons found - returning empty results"
      );
      return res.status(200).json({
        totalRecords: 0,
        totalPages: 0,
        currentPage: personPage,
        organizationPagination: {
          totalRecords: 0,
          totalPages: 0,
          currentPage: orgPage,
          limit: orgLimit
        },
        persons: [],
        organizations: [],
        summary: {
          currentPagePersonCount: 0,
          currentPageOrganizationCount: 0,
          currentPageTotalCount: 0,
          totalPersonCount: 0,
          totalOrganizationCount: 0,
          totalDatabaseCount: 0
        }
      });
    }

    console.log(
      "[DEBUG] Final finalPersonWhere:",
      JSON.stringify(finalPersonWhere, null, 2)
    );

    // Fetch persons using updated filtering logic with proper pagination
    let personQueryResult = { count: 0, rows: [] };
    if (req.role === "admin" && !req.query.masterUserID) {
      personQueryResult = await Person.findAndCountAll({
        where: finalPersonWhere,
        order: [[sortBy, sortOrder]], 
        limit: personLimit,
        offset: personOffset,
        raw: true,
      });
    } else if (req.query.masterUserID) {
      // If masterUserID is provided, filter by that as well
      finalPersonWhere.masterUserID = req.query.masterUserID;
      personQueryResult = await Person.findAndCountAll({
        where: finalPersonWhere,
        order: [[sortBy, sortOrder]], 
        limit: personLimit,
        offset: personOffset,
        raw: true,
      });
    } else {
      const roleBasedPersonFilter = {
        [Op.or]: [
          { masterUserID: req.adminId },
          { leadOrganizationId: orgIds },
        ],
      };

      // Merge filter conditions with role-based access control
      if (Object.keys(finalPersonWhere).length > 0) {
        finalPersonWhere = {
          [Op.and]: [finalPersonWhere, roleBasedPersonFilter],
        };
      } else {
        finalPersonWhere = roleBasedPersonFilter;
      }

      personQueryResult = await Person.findAndCountAll({
        where: finalPersonWhere,
        order: [[sortBy, sortOrder]], 
        limit: personLimit,
        offset: personOffset,
        raw: true,
      });
    }

    // Extract persons and total count from query result
    let persons = personQueryResult.rows;
    const totalPersonsCount = personQueryResult.count;

    console.log("[DEBUG] persons count:", persons.length);
    console.log("[DEBUG] total persons count from DB:", totalPersonsCount);
    console.log(
      "[DEBUG] persons sample:",
      persons && persons.length > 0 ? persons[0] : null
    );

    // Build org map for quick lookup
    const orgMap = {};
    organizations.forEach((org) => {
      orgMap[org.leadOrganizationId] = org;
    });

    // Get all unique ownerIds from persons and organizations
    const orgOwnerIds = organizations.map((o) => o.ownerId).filter(Boolean);
    const personOwnerIds = persons.map((p) => p.ownerId).filter(Boolean);
    const ownerIds = [...new Set([...orgOwnerIds, ...personOwnerIds])];

    // Fetch owner names from MasterUser
    const owners = await MasterUser.findAll({
      where: { masterUserID: ownerIds },
      attributes: ["masterUserID", "name"],
      raw: true,
    });
    const ownerMap = {};
    owners.forEach((o) => {
      ownerMap[o.masterUserID] = o.name;
    });

    // Add ownerName to persons - same logic as getLeads API
    persons = persons.map((p) => ({
      ...p,
      ownerName: ownerMap[p.ownerId] || null,
    }));

    // Count leads for each person using the same approach as getLeads API
    const personIds = persons.map((p) => p.personId);
    const leadCounts = await Lead.findAll({
      attributes: [
        "personId",
        "leadOrganizationId",
        [Sequelize.fn("COUNT", Sequelize.col("leadId")), "leadCount"],
      ],
      where: {
        [Op.or]: [{ personId: personIds }, { leadOrganizationId: orgIds }],
      },
      group: ["personId", "leadOrganizationId"],
      raw: true,
    });

    // Build maps for quick lookup
    const personLeadCountMap = {};
    const orgLeadCountMap = {};
    leadCounts.forEach((lc) => {
      if (lc.personId)
        personLeadCountMap[lc.personId] = parseInt(lc.leadCount, 10);
      if (lc.leadOrganizationId)
        orgLeadCountMap[lc.leadOrganizationId] = parseInt(lc.leadCount, 10);
    });

    // Add leadCount to persons - same logic as getLeads API
    persons = persons.map((p) => {
      let ownerName = null;
      let organizationName = p.organization; // Keep existing organization name if present
      
      if (p.leadOrganizationId && orgMap[p.leadOrganizationId]) {
        const org = orgMap[p.leadOrganizationId];
        // Set organization name from the related organization
        organizationName = org.organization || p.organization;
        
        if (org.ownerId && ownerMap[org.ownerId]) {
          ownerName = ownerMap[org.ownerId];
        }
      }
      return {
        ...p,
        organization: organizationName, // Ensure organization field is populated
        ownerName,
        leadCount: personLeadCountMap[p.personId] || 0,
      };
    });

    // Fetch custom field values for all persons - same as getLeads API
    const personIdsForCustomFields = persons.map((p) => p.personId);
    let customFieldValues = [];
    if (personIdsForCustomFields.length > 0) {
      customFieldValues = await CustomFieldValue.findAll({
        where: {
          entityId: personIdsForCustomFields,
          entityType: "person",
        },
        raw: true,
      });
    }

    // Fetch all custom fields for person entity
    const allCustomFields = await CustomField.findAll({
      where: {
        entityType: { [Sequelize.Op.in]: ["person", "both"] },
        isActive: true,
      },
      raw: true,
    });

    const customFieldIdToName = {};
    allCustomFields.forEach((cf) => {
      customFieldIdToName[cf.fieldId] = cf.fieldName;
    });

    // Map personId to their custom field values as { fieldName: value }
    const personCustomFieldsMap = {};
    customFieldValues.forEach((cfv) => {
      const fieldName = customFieldIdToName[cfv.fieldId] || cfv.fieldId;
      if (!personCustomFieldsMap[cfv.entityId])
        personCustomFieldsMap[cfv.entityId] = {};
      personCustomFieldsMap[cfv.entityId][fieldName] = cfv.value;
    });

    // Attach custom fields as direct properties to each person - same as getLeads API
    persons = persons.map((p) => {
      const customFields = personCustomFieldsMap[p.personId] || {};
      return { ...p, ...customFields };
    });

    // Fetch custom field values for organizations
    const orgIdsForCustomFields = organizations.map((org) => org.leadOrganizationId);
    let orgCustomFieldValues = [];
    if (orgIdsForCustomFields.length > 0) {
      orgCustomFieldValues = await CustomFieldValue.findAll({
        where: {
          entityId: orgIdsForCustomFields,
          entityType: "organization",
        },
        raw: true,
      });
    }

    // Fetch all custom fields for organization entity
    const allOrgCustomFields = await CustomField.findAll({
      where: {
        entityType: { [Sequelize.Op.in]: ["organization", "both"] },
        isActive: true,
      },
      raw: true,
    });

    const orgCustomFieldIdToName = {};
    allOrgCustomFields.forEach((cf) => {
      orgCustomFieldIdToName[cf.fieldId] = cf.fieldName;
    });

    // Map organizationId to their custom field values as { fieldName: value }
    const orgCustomFieldsMap = {};
    orgCustomFieldValues.forEach((cfv) => {
      const fieldName = orgCustomFieldIdToName[cfv.fieldId] || cfv.fieldId;
      if (!orgCustomFieldsMap[cfv.entityId])
        orgCustomFieldsMap[cfv.entityId] = {};
      orgCustomFieldsMap[cfv.entityId][fieldName] = cfv.value;
    });

    // Attach custom fields as direct properties to each organization
    organizations = organizations.map((org) => {
      const customFields = orgCustomFieldsMap[org.leadOrganizationId] || {};
      return { ...org, ...customFields };
    });

    // Fetch column preferences to filter displayed fields
    const personColumnPref = await PersonColumnPreference.findOne({ where: {} });
    const orgColumnPref = await OrganizationColumnPreference.findOne({ where: {} });

    // Helper function to filter data based on column preferences
    const filterDataByColumnPreference = (data, columnPreference, entityType) => {
      if (!columnPreference || !columnPreference.columns) {
        return data;
      }

      let columns = [];
      if (columnPreference.columns) {
        columns = typeof columnPreference.columns === "string" 
          ? JSON.parse(columnPreference.columns) 
          : columnPreference.columns;
      }

      // Filter to only include columns where check is true
      const checkedColumns = columns.filter(col => col.check === true);
      const allowedFields = checkedColumns.map(col => col.key);

      // Always include essential fields regardless of preferences
      const essentialFields = entityType === 'person' 
        ? ['personId', 'leadOrganizationId', 'organization', 'ownerName', 'leadCount']
        : ['leadOrganizationId', 'organization', 'ownerName', 'leadCount'];
      const finalAllowedFields = [...new Set([...allowedFields, ...essentialFields])];

      return data.map(item => {
        const filteredItem = {};
        finalAllowedFields.forEach(field => {
          if (item.hasOwnProperty(field)) {
            filteredItem[field] = item[field];
          }
        });
        // Add entity information
        filteredItem.entity = entityType;
        return filteredItem;
      });
    };

    // Filter persons based on person column preferences
    const filteredPersons = filterDataByColumnPreference(persons, personColumnPref, 'person');

    console.log('[DEBUG] Timeline enrichment check:', {
      includeTimeline,
      filteredPersonsLength: filteredPersons.length,
      activityFilters
    });

    // Fetch timeline activities for persons if requested
    let personsWithTimeline = filteredPersons;
    if (includeTimeline && filteredPersons.length > 0) {
      console.log('[DEBUG] Calling enrichPersonsWithTimeline...');
      personsWithTimeline = await enrichPersonsWithTimeline(
        filteredPersons, 
        activityFilters, 
        timelineStartDate, 
        timelineEndDate,
        req.adminId,
        req.role,
        timelineGranularity,
        includeOverdueCount, Activity, Email, Deal, ActivityType
      );
      console.log('[DEBUG] Timeline enrichment completed, returned persons:', personsWithTimeline.length);
    } else {
      console.log('[DEBUG] Timeline enrichment skipped - includeTimeline:', includeTimeline, 'filteredPersonsLength:', filteredPersons.length);
    }

    // Similarly filter organizations and add organization data
    let filteredOrganizations = [];
    if (organizations && organizations.length > 0) {
      // Add leadCount and other computed fields to organizations
      organizations = organizations.map((org) => {
        return {
          ...org,
          ownerName: ownerMap[org.ownerId] || null,
          leadCount: orgLeadCountMap[org.leadOrganizationId] || 0,
        };
      });

      // Filter organizations based on organization column preferences
      filteredOrganizations = filterDataByColumnPreference(organizations, orgColumnPref, 'organization');
    }

    // const filterPerson = personsWithTimeline.filter(person => person?.visibilityGroupId == groupId)

    // const filterOrganization = filteredOrganizations.filter(org => org?.visibilityGroupId == groupId)

     const findGroup = await GroupVisibility.findOne({
          where:{
            groupId: 1 //groupId
          }          
        })
    
        let filterPerson = [];
        let filterOrganization = [];
    
        if(findGroup?.lead?.toLowerCase() == "visibilitygroup"){
          let findParentGroup = null; 
          if(findGroup?.parentGroupId){
            findParentGroup = await GroupVisibility.findOne({
              where: {
                groupId: findGroup?.parentGroupId
              }
            })
          }
          
          const filterDeals = personsWithTimeline.filter((idx)=> idx?.ownerId == req.adminId || idx?.visibilityGroupId == groupId ||  idx?.visibilityGroupId == findGroup?.parentGroupId || findParentGroup.memberIds?.split(",").includes(req.adminId.toString()));
          
          const filterorg = filteredOrganizations.filter((idx)=> idx?.ownerId == req.adminId || idx?.visibilityGroupId == groupId ||  idx?.visibilityGroupId == findGroup?.parentGroupId || findParentGroup.memberIds?.split(",").includes(req.adminId.toString()));
    
          filterPerson = filterDeals;
          filterOrganization = filterorg;
        }
        else if(findGroup?.lead?.toLowerCase() == "owner"){
          let findParentGroup = null; 
          if(findGroup?.parentGroupId){
            findParentGroup = await GroupVisibility.findOne({
              where: {
                groupId: findGroup?.parentGroupId
              }
            })
          }
    
          const filterFields = personsWithTimeline.filter((idx)=> idx?.ownerId == req.adminId || idx?.visibilityGroup == findGroup?.parentGroupId);
          const filterOrg = filteredOrganizations.filter((idx)=> idx?.ownerId == req.adminId || idx?.visibilityGroup == findGroup?.parentGroupId );
    
          filterPerson = filterFields;
          filterOrganization = filterOrg;
        }else{
          filterPerson = personsWithTimeline;
          filterOrganization = filteredOrganizations;
        }
    // Return both filtered datasets in separate arrays with proper pagination metadata
    res.status(200).json({
      // Pagination metadata based on actual database counts
      totalRecords: totalPersonsCount + totalOrganizationsCount,
      totalPages: Math.ceil(totalPersonsCount / personLimit), // Person pagination
      currentPage: personPage,
      
      // Separate pagination for organizations
      organizationPagination: {
        totalRecords: totalOrganizationsCount,
        totalPages: Math.ceil(totalOrganizationsCount / orgLimit),
        currentPage: orgPage,
        limit: orgLimit
      },
      
      persons: filterPerson,//personsWithTimeline, // Filtered person data with entity: 'person' and timeline activities
      organizations: filterOrganization, //filteredOrganizations, // Filtered organization data with entity: 'organization'
      activityFilters: activityFilters, // Active timeline filters
      timelineEnabled: includeTimeline, // Whether timeline data was included
      timelineRange: includeTimeline ? { startDate: timelineStartDate, endDate: timelineEndDate } : null,
      
      // Pipedrive-style enhancements
      timelineGranularity: timelineGranularity, // weekly, monthly, quarterly
      dateRangeFilter: dateRangeFilter, // 1-month-back, 3-months-back, 6-months-back, 12-months-back
      overdueTrackingEnabled: includeOverdueCount, // Whether overdue activity counting is enabled
      
      // Specific person IDs information
      personIdsFilter: specificPersonIds.length > 0 ? {
        enabled: true,
        requestedIds: specificPersonIds,
        foundIds: personsWithTimeline.map(p => p.personId),
        missingIds: specificPersonIds.filter(id => !personsWithTimeline.some(p => p.personId === id))
      } : {
        enabled: false
      },
      
      // Summary with overdue statistics and database counts
      summary: {
        // Current page counts (what's actually returned)
        currentPagePersonCount: personsWithTimeline.length,
        currentPageOrganizationCount: filteredOrganizations.length,
        currentPageTotalCount: personsWithTimeline.length + filteredOrganizations.length,
        
        // Total database counts (for pagination)
        totalPersonCount: totalPersonsCount,
        totalOrganizationCount: totalOrganizationsCount,
        totalDatabaseCount: totalPersonsCount + totalOrganizationsCount,
        
        // Calculate overall overdue statistics (similar to Pipedrive's red number)
        overdueStats: includeOverdueCount ? {
          totalPersonsWithOverdue: personsWithTimeline.filter(p => p.overdueStats && p.overdueStats.hasOverdueActivities).length,
          totalOverdueActivities: personsWithTimeline.reduce((sum, p) => sum + (p.overdueStats ? p.overdueStats.overdueCount : 0), 0),
          percentageWithOverdue: personsWithTimeline.length > 0 ? 
            Math.round((personsWithTimeline.filter(p => p.overdueStats && p.overdueStats.hasOverdueActivities).length / personsWithTimeline.length) * 100) : 0
        } : null
      }
    });
  } catch (error) {
    console.error("Error fetching persons and organizations:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


// Alternative: Soft delete (if you have deletedAt column)
// exports.softDeleteOrganization = async (req, res) => {
//   try {
//     const { leadOrganizationId } = req.params;
//     const { adminId, role } = req; // Assuming these are set by your authentication middleware

//     const organization = await Organization.findByPk(leadOrganizationId);
    
//     if (!organization) {
//       return res.status(404).json({
//         success: false,
//         error: "Organization not found"
//       });
//     }

//     // Check permissions
//     if (role !== "admin" && organization.ownerId !== adminId) {
//       return res.status(403).json({
//         success: false,
//         error: "Permission denied",
//         message: "You don't have permission to delete this organization"
//       });
//     }

//     // Check if already soft deleted
//     if (organization.active === 0) {
//       return res.status(400).json({
//         success: false,
//         error: "Organization already deleted",
//         message: "This organization has already been deleted"
//       });
//     }

//     // Soft delete by updating isActive to false
//     await organization.update({ 
//       active: 0,
//       // deletedAt: new Date() 
//     });

//     return res.status(200).json({
//       success: true,
//       message: "Organization soft deleted successfully",
//       data: {
//         leadOrganizationId: organization.leadOrganizationId,
//         organization: organization.organization,
//         isActive: organization.isActive,
//         // deletedAt: organization.deletedAt
//       }
//     });

//   } catch (error) {
//     console.error("Error soft deleting Organization:", error);
//     return res.status(500).json({
//       success: false,
//       error: "Internal server error",
//       message: error.message
//     });
//   }
// };


exports.deleteOrganization = async (req, res) => {
  const {Activity, Email, Deal, ActivityType, Lead, MasterUser, PersonColumnPreference, OrganizationColumnPreference, LeadPerson : Person, LeadOrganization : Organization, Product, DealProduct, LeadFilter, GroupVisibility, CustomFieldValue, CustomField} = req.models;

  // Get the client connection from request (attached by middleware)
  const clientConnection = req.clientConnection;
  
  if (!clientConnection) {
    return res.status(500).json({
      message: "No database connection available. Please login again.",
    });
  }

  const transaction = await clientConnection.transaction(); // Start a transaction

  try {
    const { leadOrganizationId } = req.params;
    const { adminId, role } = req; 

    const organization = await Organization.findByPk(leadOrganizationId);
    console.log(adminId, role)
    if (!organization) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: "Organization not found"
      });
    }

    // Check permissions
    if (role !== "admin" && organization.masterUserID !== adminId ) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        error: "Permission denied",
        message: "You don't have permission to delete this organization"
      });
    }

    // 1. Remove leadOrganizationId from LeadPerson records
    await Person.update(
      { leadOrganizationId: null, organization: null },
      {
        where: { leadOrganizationId: leadOrganizationId },
        transaction: transaction
      }
    );

    // 2. Remove leadOrganizationId from Lead records
    await Lead.update(
      { leadOrganizationId: null, organization: null },
      {
        where: { leadOrganizationId: leadOrganizationId },
        transaction: transaction
      }
    );

    // 3. Remove leadOrganizationId from Deal records
    await Deal.update(
      { leadOrganizationId: null, organization: null },
      {
        where: { leadOrganizationId: leadOrganizationId },
        transaction: transaction
      }
    );

    // 4. Remove leadOrganizationId from Activity records
    await Activity.update(
      { leadOrganizationId: null, organization: null },
      {
        where: { leadOrganizationId: leadOrganizationId },
        transaction: transaction
      }
    );

    // 5. Now delete the organization
    await organization.destroy({ transaction: transaction });

    // Commit the transaction
    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Organization deleted successfully and all references removed",
      data: {
        leadOrganizationId: organization.leadOrganizationId,
        organization: organization.organization,
      }
    });

  } catch (error) {
    // Rollback the transaction in case of error
    await transaction.rollback();
    
    console.error("Error deleting Organization:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

exports.deletePerson = async (req, res) => {
  const {Activity, Email, Deal, ActivityType, Lead, MasterUser, PersonColumnPreference, OrganizationColumnPreference, LeadPerson : Person, LeadOrganization : Organization, Product, DealProduct, LeadFilter, GroupVisibility, CustomFieldValue, CustomField} = req.models;

  // Get the client connection from request (attached by middleware)
  const clientConnection = req.clientConnection;
  
  if (!clientConnection) {
    return res.status(500).json({
      message: "No database connection available. Please login again.",
    });
  }

  const transaction = await clientConnection.transaction(); // Start a transaction

  try {
    const { personId } = req.params;
    const { adminId, role } = req; 

    const person = await Person.findByPk(personId);
    
    if (!person) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: "Person not found"
      });
    }

    // Check permissions
    if (role !== "admin" && person.masterUserID !== adminId) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        error: "Permission denied",
        message: "You don't have permission to delete this Person"
      });
    }

    // 2. Remove personId from Lead records
    await Lead.update(
      { personId: null, contactPerson: null },
      {
        where: { personId: personId },
        transaction: transaction
      }
    );

    // 3. Remove personId from Deal records
    await Deal.update(
      { personId: null, contactPerson: null },
      {
        where: { personId: personId },
        transaction: transaction
      }
    );

    // 4. Remove personId from Activity records
    await Activity.update(
      { personId: null, contactPerson: null },
      {
        where: { personId: personId },
        transaction: transaction
      }
    );

    // 5. Now delete the person
    await person.destroy({ transaction: transaction });

    // Commit the transaction
    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "person deleted successfully and all references removed",
      data: {
        personId: person.personId,
        contactPerson: person.contactPerson,
      }
    });

  } catch (error) {
    // Rollback the transaction in case of error
    await transaction.rollback();
    
    console.error("Error deleting person:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

// Update Person Owner API
exports.updatePersonOwner = async (req, res) => {
  const {Activity, Email, Deal, ActivityType, Lead, MasterUser, PersonColumnPreference, OrganizationColumnPreference, LeadPerson : Person, LeadOrganization : Organization, Product, DealProduct, LeadFilter, GroupVisibility, CustomFieldValue, CustomField} = req.models;
  const { personId, ownerId } = req.body;
  const adminId = req.adminId;
  const { Op } = require("sequelize");
  const sequelize = require("../../config/db");

  // Validate required fields
  if (!personId || !ownerId) {
    return res.status(400).json({
      success: false,
      message: "personId and ownerId are required."
    });
  }

  // Get the client connection from request (attached by middleware)
  const clientConnection = req.clientConnection;
  
  if (!clientConnection) {
    return res.status(500).json({
      message: "No database connection available. Please login again.",
    });
  }

  const transaction = await clientConnection.transaction();

  try {
    // Check if the new owner exists
    const newOwner = await MasterUser.findByPk(ownerId, { transaction });
    if (!newOwner) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "New owner not found."
      });
    }

    // Find the person
    let person;
    if (req.role === "admin") {
      person = await Person.findByPk(personId, { transaction });
    } else {
      // Non-admin users can only update persons they own or created
      person = await Person.findOne({
        where: {
          personId: personId,
          [Op.or]: [
            { ownerId: adminId },
            { masterUserID: adminId }
          ]
        },
        transaction
      });
    }

    if (!person) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Person not found or you don't have permission to update it."
      });
    }

    // Update the ownerId
    await person.update({ ownerId: ownerId }, { transaction });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Person owner updated successfully.",
      data: {
        personId: person.personId,
        name: person.name,
        email: person.email,
        ownerId: person.ownerId,
        ownerName: newOwner.name
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error("Error updating person owner:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

// Update Organization Owner API
exports.updateOrganizationOwner = async (req, res) => {
  const {Activity, Email, Deal, ActivityType, Lead, MasterUser, PersonColumnPreference, OrganizationColumnPreference, LeadPerson : Person, LeadOrganization : Organization, Product, DealProduct, LeadFilter, GroupVisibility, CustomFieldValue, CustomField} = req.models;
  const { leadOrganizationId, ownerId } = req.body;
  const adminId = req.adminId;
  const { Op } = require("sequelize");
  const sequelize = require("../../config/db");

  // Validate required fields
  if (!leadOrganizationId || !ownerId) {
    return res.status(400).json({
      success: false,
      message: "leadOrganizationId and ownerId are required."
    });
  }

  // Get the client connection from request (attached by middleware)
  const clientConnection = req.clientConnection;
  
  if (!clientConnection) {
    return res.status(500).json({
      message: "No database connection available. Please login again.",
    });
  }


  const transaction = await clientConnection.transaction();

  try {
    // Check if the new owner exists
    const newOwner = await MasterUser.findByPk(ownerId, { transaction });
    if (!newOwner) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "New owner not found."
      });
    }

    // Find the organization
    let organization;
    if (req.role === "admin") {
      organization = await Organization.findByPk(leadOrganizationId, { transaction });
    } else {
      // Non-admin users can only update organizations they own or created
      organization = await Organization.findOne({
        where: {
          leadOrganizationId: leadOrganizationId,
          [Op.or]: [
            { ownerId: adminId },
            { masterUserID: adminId }
          ]
        },
        transaction
      });
    }

    if (!organization) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Organization not found or you don't have permission to update it."
      });
    }

    // Update the ownerId
    await organization.update({ ownerId: ownerId }, { transaction });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Organization owner updated successfully.",
      data: {
        leadOrganizationId: organization.leadOrganizationId,
        name: organization.name,
        email: organization.email,
        ownerId: organization.ownerId,
        ownerName: newOwner.name
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error("Error updating organization owner:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

// Bulk Update Person Owners API
exports.bulkUpdatePersonOwners = async (req, res) => {
  const {Activity, Email, Deal, ActivityType, Lead, MasterUser, PersonColumnPreference, OrganizationColumnPreference, LeadPerson : Person, LeadOrganization : Organization, Product, DealProduct, LeadFilter, GroupVisibility, CustomFieldValue, CustomField} = req.models;
  const { personIds, ownerId } = req.body;
  const adminId = req.adminId;
  const { Op } = require("sequelize");
  const sequelize = require("../../config/db");

  // Validate required fields
  if (!Array.isArray(personIds) || personIds.length === 0 || !ownerId) {
    return res.status(400).json({
      success: false,
      message: "personIds array and ownerId are required."
    });
  }

  // Get the client connection from request (attached by middleware)
  const clientConnection = req.clientConnection;
  
  if (!clientConnection) {
    return res.status(500).json({
      message: "No database connection available. Please login again.",
    });
  }

  const results = [];

  try {
    // Check if the new owner exists
    const newOwner = await MasterUser.findByPk(ownerId);
    if (!newOwner) {
      return res.status(404).json({
        success: false,
        message: "New owner not found."
      });
    }

    for (const personId of personIds) {
      const transaction = await clientConnection.transaction();

      try {
        // Find the person
        let person;
        if (req.role === "admin") {
          person = await Person.findByPk(personId, { transaction });
        } else {
          // Non-admin users can only update persons they own or created
          person = await Person.findOne({
            where: {
              personId: personId,
              [Op.or]: [
                { ownerId: adminId },
                { masterUserID: adminId }
              ]
            },
            transaction
          });
        }

        if (!person) {
          await transaction.rollback();
          results.push({
            personId: personId,
            success: false,
            error: "Person not found or you don't have permission to update it."
          });
          continue;
        }

        // Update the ownerId
        await person.update({ ownerId: ownerId }, { transaction });

        await transaction.commit();

        results.push({
          personId: person.personId,
          success: true,
          message: "Owner updated successfully",
          data: {
            name: person.name,
            email: person.email,
            ownerId: person.ownerId,
            ownerName: newOwner.name
          }
        });

      } catch (error) {
        await transaction.rollback();
        console.error(`Error updating person ${personId} owner:`, error);
        results.push({
          personId: personId,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return res.status(200).json({
      success: true,
      message: `Bulk update completed. ${successCount} successful, ${failureCount} failed.`,
      results: results,
      summary: {
        total: personIds.length,
        successful: successCount,
        failed: failureCount
      }
    });

  } catch (error) {
    console.error("Error in bulk update person owners:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

// Bulk Update Organization Owners API
exports.bulkUpdateOrganizationOwners = async (req, res) => {
  const {Activity, Email, Deal, ActivityType, Lead, MasterUser, PersonColumnPreference, OrganizationColumnPreference, LeadPerson : Person, LeadOrganization : Organization, Product, DealProduct, LeadFilter, GroupVisibility, CustomFieldValue, CustomField} = req.models;
  const { leadOrganizationIds, ownerId } = req.body;
  const adminId = req.adminId;
  const { Op } = require("sequelize");
  const sequelize = require("../../config/db");

  // Validate required fields
  if (!Array.isArray(leadOrganizationIds) || leadOrganizationIds.length === 0 || !ownerId) {
    return res.status(400).json({
      success: false,
      message: "leadOrganizationIds array and ownerId are required."
    });
  }

  // Get the client connection from request (attached by middleware)
  const clientConnection = req.clientConnection;
  
  if (!clientConnection) {
    return res.status(500).json({
      message: "No database connection available. Please login again.",
    });
  }

  const results = [];

  try {
    // Check if the new owner exists
    const newOwner = await MasterUser.findByPk(ownerId);
    if (!newOwner) {
      return res.status(404).json({
        success: false,
        message: "New owner not found."
      });
    }

    for (const orgId of leadOrganizationIds) {
      const transaction = await clientConnection.transaction();

      try {
        // Find the organization
        let organization;
        if (req.role === "admin") {
          organization = await Organization.findByPk(orgId, { transaction });
        } else {
          // Non-admin users can only update organizations they own or created
          organization = await Organization.findOne({
            where: {
              leadOrganizationId: orgId,
              [Op.or]: [
                { ownerId: adminId },
                { masterUserID: adminId }
              ]
            },
            transaction
          });
        }

        if (!organization) {
          await transaction.rollback();
          results.push({
            leadOrganizationId: orgId,
            success: false,
            error: "Organization not found or you don't have permission to update it."
          });
          continue;
        }

        // Update the ownerId
        await organization.update({ ownerId: ownerId }, { transaction });

        await transaction.commit();

        results.push({
          leadOrganizationId: organization.leadOrganizationId,
          success: true,
          message: "Owner updated successfully",
          data: {
            name: organization.name,
            email: organization.email,
            ownerId: organization.ownerId,
            ownerName: newOwner.name
          }
        });

      } catch (error) {
        await transaction.rollback();
        console.error(`Error updating organization ${orgId} owner:`, error);
        results.push({
          leadOrganizationId: orgId,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return res.status(200).json({
      success: true,
      message: `Bulk update completed. ${successCount} successful, ${failureCount} failed.`,
      results: results,
      summary: {
        total: leadOrganizationIds.length,
        successful: successCount,
        failed: failureCount
      }
    });

  } catch (error) {
    console.error("Error in bulk update organization owners:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
};

// ===================================================================
// ENTITY FILE MANAGEMENT FUNCTIONALITY (PERSON & ORGANIZATION)
// ===================================================================

const EntityFile = require("../../models/leads/entityFileModel");
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { fn, col } = require('sequelize');
const GroupVisibility = require("../../models/admin/groupVisibilityModel");

// Configure multer for entity files (unified for both person and organization)
const entityFileStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const entityType = req.params.personId ? 'persons' : 'organizations';
    const uploadPath = path.join(__dirname, `../../uploads/${entityType}`);
    try {
      await fs.access(uploadPath);
    } catch (error) {
      await fs.mkdir(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const entityType = req.params.personId ? 'person' : 'org';
    const entityId = req.params.personId || req.params.leadOrganizationId;
    cb(null, `${entityType}-${entityId}-${uniqueSuffix}${extension}`);
  }
});

const entityFileUpload = multer({
  storage: entityFileStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow most common file types
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/bmp',
      'image/webp',
      'text/plain',
      'text/csv',
      'application/zip',
      'application/x-zip-compressed',
      'application/json',
      'video/mp4',
      'video/avi',
      'video/quicktime',
      'audio/mp3',
      'audio/wav'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`), false);
    }
  }
});

/**
 * Helper function to determine file category based on MIME type
 */
function getFileCategory(mimeType) {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.includes('pdf')) return 'document';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'document';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet') || mimeType.includes('csv')) return 'spreadsheet';
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'presentation';
  if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('compressed')) return 'archive';
  return 'other';
}

/**
 * Helper function to format file size
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Upload file(s) to an entity (person or organization)
 */
exports.uploadEntityFiles = async (req, res) => {
  const {Activity, Email, Deal, ActivityType, Lead, MasterUser, PersonColumnPreference, OrganizationColumnPreference, LeadPerson, LeadOrganization, EntityFile, Product, DealProduct, LeadFilter, GroupVisibility, CustomFieldValue, CustomField} = req.models;
  try {
    const { personId, leadOrganizationId } = req.params;
    const masterUserID = req.adminId;
    const uploadedBy = req.user?.id || req.adminId;
    
    // Determine entity type and ID
    const entityType = personId ? 'person' : 'organization';
    const entityId = personId || leadOrganizationId;
    
    // Get appropriate model
    const EntityModel = entityType === 'person' 
      ? LeadPerson
      : LeadOrganization;
    
    const idField = entityType === 'person' ? 'personId' : 'leadOrganizationId';

    // Check if entity exists and user has access
    const entity = await EntityModel.findOne({
      where: { [idField]: entityId }
    });

    if (!entity) {
      return res.status(404).json({
        success: false,
        message: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} not found`
      });
    }

    // Handle file upload
    entityFileUpload.array('files', 10)(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: 'File upload failed',
          error: err.message
        });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files uploaded'
        });
      }

      const uploadedFiles = [];

      // Process each uploaded file
      for (const file of req.files) {
        const fileCategory = getFileCategory(file.mimetype);
        const fileExtension = path.extname(file.originalname).toLowerCase();

        const entityFile = await EntityFile.createForEntity(entityId, entityType, {
          fileName: file.originalname,
          fileDisplayName: req.body.displayName || file.originalname,
          filePath: file.path,
          fileSize: file.size,
          mimeType: file.mimetype,
          fileExtension,
          fileCategory,
          description: req.body.description || null,
          tags: req.body.tags ? JSON.parse(req.body.tags) : null,
          isPublic: req.body.isPublic === 'true',
          uploadedBy,
          masterUserID
        });

        uploadedFiles.push({
          fileId: entityFile.fileId,
          fileName: entityFile.fileName,
          fileSize: entityFile.fileSize,
          fileCategory: entityFile.fileCategory,
          entityType: entityFile.entityType,
          uploadedAt: entityFile.createdAt
        });
      }

      res.status(201).json({
        success: true,
        message: `${uploadedFiles.length} file(s) uploaded successfully`,
        data: {
          entityId,
          entityType,
          files: uploadedFiles
        }
      });
    });

  } catch (error) {
    console.error('Upload entity files error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload files',
      error: error.message
    });
  }
};

/**
 * Get all files for an entity (person or organization)
 */
exports.getEntityFiles = async (req, res) => {
  const {Activity, Email, Deal, ActivityType, Lead, MasterUser, PersonColumnPreference, OrganizationColumnPreference, LeadPerson, LeadOrganization, EntityFile, Product, DealProduct, LeadFilter, GroupVisibility, CustomFieldValue, CustomField} = req.models;
  try {
    const { personId, leadOrganizationId } = req.params;
    const masterUserID = req.adminId;
    const { category, search, sortBy = 'createdAt', sortOrder = 'DESC', page = 1, limit = 50 } = req.query;
    const { Op } = require("sequelize");
    
    // Determine entity type and ID
    const entityType = personId ? 'person' : 'organization';
    const entityId = personId || leadOrganizationId;
    
    // Get appropriate model
    const EntityModel = entityType === 'person' 
      ? LeadPerson
      : LeadOrganization;
    
    const idField = entityType === 'person' ? 'personId' : 'leadOrganizationId';

    // Check if entity exists and user has access
    const entity = await EntityModel.findOne({
      where: { [idField]: entityId }
    });

    if (!entity) {
      return res.status(404).json({
        success: false,
        message: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} not found`
      });
    }

    // Build where conditions
    const whereConditions = {
      entityId,
      entityType,
      masterUserID,
      isActive: true
    };

    if (category) {
      whereConditions.fileCategory = category;
    }

    if (search) {
      whereConditions[Op.or] = [
        { fileName: { [Op.iLike]: `%${search}%` } },
        { fileDisplayName: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // Get files with pagination
    const offset = (page - 1) * limit;
    const { count, rows: files } = await EntityFile.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: MasterUser,
          as: 'uploader',
          attributes: ['masterUserID', 'email']
        }
      ],
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Format file data
    const formattedFiles = files.map(file => ({
      fileId: file.fileId,
      fileName: file.fileName,
      fileDisplayName: file.fileDisplayName,
      fileSize: file.fileSize,
      fileSizeFormatted: formatFileSize(file.fileSize),
      mimeType: file.mimeType,
      fileExtension: file.fileExtension,
      fileCategory: file.fileCategory,
      entityType: file.entityType,
      description: file.description,
      tags: file.tags,
      isPublic: file.isPublic,
      version: file.version,
      downloadCount: file.downloadCount,
      lastAccessedAt: file.lastAccessedAt,
      uploadedBy: file.uploader ? {
        id: file.uploader.masterUserID,
        email: file.uploader.email
      } : null,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt
    }));

    // Get file statistics
    const stats = await EntityFile.findAll({
      where: { entityId, entityType, masterUserID, isActive: true },
      attributes: [
        'fileCategory',
        [fn('COUNT', col('fileId')), 'count'],
        [fn('SUM', col('fileSize')), 'totalSize']
      ],
      group: ['fileCategory'],
      raw: true
    });

    res.status(200).json({
      success: true,
      message: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} files retrieved successfully`,
      data: {
        entityId,
        entityType,
        files: formattedFiles,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / limit),
          totalFiles: count,
          hasNext: (page * limit) < count,
          hasPrev: page > 1
        },
        statistics: {
          totalFiles: count,
          totalSize: files.reduce((sum, file) => sum + file.fileSize, 0),
          categoryBreakdown: stats.reduce((acc, stat) => {
            acc[stat.fileCategory] = {
              count: parseInt(stat.count),
              size: parseInt(stat.totalSize || 0)
            };
            return acc;
          }, {})
        }
      }
    });

  } catch (error) {
    console.error('Get entity files error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve entity files',
      error: error.message
    });
  }
};

/**
 * Download a specific entity file
 */
exports.downloadEntityFile = async (req, res) => {
  const { EntityFile } = req.models;
  try {
    const { personId, leadOrganizationId, fileId } = req.params;
    const masterUserID = req.adminId;
    
    // Determine entity type and ID
    const entityType = personId ? 'person' : 'organization';
    const entityId = personId || leadOrganizationId;

    // Find the file
    const entityFile = await EntityFile.findOne({
      where: { fileId, entityId, entityType, masterUserID, isActive: true }
    });

    if (!entityFile) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Check if file exists on disk
    try {
      await fs.access(entityFile.filePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }

    // Update download count and last accessed time
    await entityFile.update({
      downloadCount: entityFile.downloadCount + 1,
      lastAccessedAt: new Date()
    });

    // Set appropriate headers
    res.setHeader('Content-Disposition', `attachment; filename="${entityFile.fileName}"`);
    res.setHeader('Content-Type', entityFile.mimeType);

    // Send file
    res.sendFile(path.resolve(entityFile.filePath));

  } catch (error) {
    console.error('Download entity file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download file',
      error: error.message
    });
  }
};

/**
 * Delete an entity file
 */
exports.deleteEntityFile = async (req, res) => {
  const { EntityFile } = req.models;
  try {
    const { personId, leadOrganizationId, fileId } = req.params;
    const masterUserID = req.adminId;
    
    // Determine entity type and ID
    const entityType = personId ? 'person' : 'organization';
    const entityId = personId || leadOrganizationId;

    // Find the file
    const entityFile = await EntityFile.findOne({
      where: { fileId, entityId, entityType, masterUserID, isActive: true }
    });

    if (!entityFile) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Soft delete the file
    await entityFile.update({ isActive: false });

    res.status(200).json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    console.error('Delete entity file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file',
      error: error.message
    });
  }
};

// ===================================================================
// CONVENIENCE FUNCTIONS FOR BACKWARD COMPATIBILITY
// ===================================================================

/**
 * Upload file(s) to a person (wrapper for uploadEntityFiles)
 */
exports.uploadPersonFiles = async (req, res) => {
  return exports.uploadEntityFiles(req, res);
};

/**
 * Get all files for a person (wrapper for getEntityFiles)
 */
exports.getPersonFiles = async (req, res) => {
  return exports.getEntityFiles(req, res);
};

/**
 * Download a specific person file (wrapper for downloadEntityFile)
 */
exports.downloadPersonFile = async (req, res) => {
  return exports.downloadEntityFile(req, res);
};

/**
 * Delete a person file (wrapper for deleteEntityFile)
 */
exports.deletePersonFile = async (req, res) => {
  return exports.deleteEntityFile(req, res);
};

/**
 * Upload file(s) to an organization (wrapper for uploadEntityFiles)
 */
exports.uploadOrganizationFiles = async (req, res) => {
  return exports.uploadEntityFiles(req, res);
};

/**
 * Get all files for an organization (wrapper for getEntityFiles)
 */
exports.getOrganizationFiles = async (req, res) => {
  return exports.getEntityFiles(req, res);
};

/**
 * Download a specific organization file (wrapper for downloadEntityFile)
 */
exports.downloadOrganizationFile = async (req, res) => {
  return exports.downloadEntityFile(req, res);
};

/**
 * Delete an organization file (wrapper for deleteEntityFile)
 */
exports.deleteOrganizationFile = async (req, res) => {
  return exports.deleteEntityFile(req, res);
};

// ===========================
// PERSON SIDEBAR MANAGEMENT
// ===========================

/**
 * Get person sidebar section preferences for the current user
 */
exports.getPersonSidebarPreferences = async (req, res) => {
  const { PersonSidebarPreference } = req.models;
  try {
    const masterUserID = req.adminId;

    // Find existing preferences for this user
    let sidebarPrefs = await PersonSidebarPreference.findOne({
      where: { masterUserID }
    });

    // If no preferences exist, create default ones
    if (!sidebarPrefs) {
      const defaultSections = [
        {
          id: 'summary',
          name: 'Summary',
          enabled: true,
          order: 1,
          draggable: false
        },
        {
          id: 'details',
          name: 'Details',
          enabled: true,
          order: 2,
          draggable: true
        },
        {
          id: 'organization',
          name: 'Organization',
          enabled: true,
          order: 3,
          draggable: true
        },
        {
          id: 'deals',
          name: 'Deals',
          enabled: true,
          order: 4,
          draggable: true
        },
        {
          id: 'overview',
          name: 'Overview',
          enabled: true,
          order: 5,
          draggable: true
        },
        {
          id: 'smart_bcc',
          name: 'Smart BCC',
          enabled: true,
          order: 6,
          draggable: true
        },
        {
          id: 'leads',
          name: 'Leads',
          enabled: true,
          order: 7,
          draggable: true
        }
      ];

      sidebarPrefs = await PersonSidebarPreference.create({
        masterUserID,
        sidebarSections: defaultSections
      });
    }

    res.status(200).json({
      success: true,
      message: "Person sidebar preferences retrieved successfully",
      sidebarSections: Array.isArray(sidebarPrefs.sidebarSections) 
        ? sidebarPrefs.sidebarSections 
        : (typeof sidebarPrefs.sidebarSections === 'string' 
            ? JSON.parse(sidebarPrefs.sidebarSections) 
            : []),
      totalSections: Array.isArray(sidebarPrefs.sidebarSections) 
        ? sidebarPrefs.sidebarSections.length 
        : (typeof sidebarPrefs.sidebarSections === 'string' 
            ? JSON.parse(sidebarPrefs.sidebarSections).length 
            : 0)
    });

  } catch (error) {
    console.error("Error fetching person sidebar preferences:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching person sidebar preferences",
      error: error.message
    });
  }
};

/**
 * Update person sidebar section preferences (toggle visibility, reorder sections)
 */
exports.updatePersonSidebarPreferences = async (req, res) => {
  const { PersonSidebarPreference } = req.models;
  try {
    const masterUserID = req.adminId;
    const { sidebarSections } = req.body;

    // Validate input
    if (!Array.isArray(sidebarSections)) {
      return res.status(400).json({
        success: false,
        message: "sidebarSections must be an array"
      });
    }

    // Validate each section has required properties
    for (const section of sidebarSections) {
      if (!section.id || typeof section.name !== 'string' || typeof section.enabled !== 'boolean' || typeof section.order !== 'number') {
        return res.status(400).json({
          success: false,
          message: "Each section must have id, name (string), enabled (boolean), and order (number) properties"
        });
      }
    }

    // Find existing preferences
    let sidebarPrefs = await PersonSidebarPreference.findOne({
      where: { masterUserID }
    });

    if (!sidebarPrefs) {
      // Create new preferences if none exist
      sidebarPrefs = await PersonSidebarPreference.create({
        masterUserID,
        sidebarSections: sidebarSections
      });
    } else {
      // Update existing preferences
      sidebarPrefs.sidebarSections = sidebarSections;
      sidebarPrefs.updatedAt = new Date();
      await sidebarPrefs.save();
    }

    res.status(200).json({
      success: true,
      message: "Person sidebar preferences updated successfully",
      sidebarSections: sidebarPrefs.sidebarSections,
      totalSections: sidebarPrefs.sidebarSections.length
    });

  } catch (error) {
    console.error("Error updating person sidebar preferences:", error);
    res.status(500).json({
      success: false,
      message: "Error updating person sidebar preferences",
      error: error.message
    });
  }
};

/**
 * Reset person sidebar preferences to default
 */
exports.resetPersonSidebarPreferences = async (req, res) => {
  const { PersonSidebarPreference } = req.models;
  try {
    const masterUserID = req.adminId;

    const defaultSections = [
      {
        id: 'summary',
        name: 'Summary',
        enabled: true,
        order: 1,
        draggable: false
      },
      {
        id: 'details',
        name: 'Details',
        enabled: true,
        order: 2,
        draggable: true
      },
      {
        id: 'organization',
        name: 'Organization',
        enabled: true,
        order: 3,
        draggable: true
      },
      {
        id: 'deals',
        name: 'Deals',
        enabled: true,
        order: 4,
        draggable: true
      },
      {
        id: 'overview',
        name: 'Overview',
        enabled: true,
        order: 5,
        draggable: true
      },
      {
        id: 'smart_bcc',
        name: 'Smart BCC',
        enabled: true,
        order: 6,
        draggable: true
      },
      {
        id: 'leads',
        name: 'Leads',
        enabled: true,
        order: 7,
        draggable: true
      }
    ];

    // Find existing preferences
    let sidebarPrefs = await PersonSidebarPreference.findOne({
      where: { masterUserID }
    });

    if (!sidebarPrefs) {
      // Create new preferences with defaults
      sidebarPrefs = await PersonSidebarPreference.create({
        masterUserID,
        sidebarSections: defaultSections
      });
    } else {
      // Reset existing preferences to defaults
      sidebarPrefs.sidebarSections = defaultSections;
      sidebarPrefs.updatedAt = new Date();
      await sidebarPrefs.save();
    }

    res.status(200).json({
      success: true,
      message: "Person sidebar preferences reset to defaults successfully",
      sidebarSections: sidebarPrefs.sidebarSections,
      totalSections: sidebarPrefs.sidebarSections.length
    });

  } catch (error) {
    console.error("Error resetting person sidebar preferences:", error);
    res.status(500).json({
      success: false,
      message: "Error resetting person sidebar preferences",
      error: error.message
    });
  }
};

/**
 * Toggle a specific sidebar section visibility
 */
exports.togglePersonSidebarSection = async (req, res) => {
  const { PersonSidebarPreference } = req.models;
  try {
    const masterUserID = req.adminId;
    const { sectionId, enabled } = req.body;

    // Validate input
    if (!sectionId || typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: "sectionId and enabled (boolean) are required"
      });
    }

    // Find existing preferences
    let sidebarPrefs = await PersonSidebarPreference.findOne({
      where: { masterUserID }
    });

    if (!sidebarPrefs) {
      return res.status(404).json({
        success: false,
        message: "Person sidebar preferences not found. Please initialize preferences first."
      });
    }

    // Ensure sidebarSections is an array (handle both JSON string and object cases)
    let sectionsArray = sidebarPrefs.sidebarSections;
    
    // If it's a string, try to parse it
    if (typeof sectionsArray === 'string') {
      try {
        sectionsArray = JSON.parse(sectionsArray);
      } catch (parseError) {
        console.error("Error parsing sidebarSections JSON:", parseError);
        return res.status(500).json({
          success: false,
          message: "Invalid sidebar sections data format"
        });
      }
    }

    // If it's still not an array, initialize with default sections
    if (!Array.isArray(sectionsArray)) {
      console.warn("sidebarSections is not an array, initializing with defaults");
      sectionsArray = [
        {
          id: 'summary',
          name: 'Summary',
          enabled: true,
          order: 1,
          draggable: false
        },
        {
          id: 'details',
          name: 'Details',
          enabled: true,
          order: 2,
          draggable: true
        },
        {
          id: 'organization',
          name: 'Organization',
          enabled: true,
          order: 3,
          draggable: true
        },
        {
          id: 'deals',
          name: 'Deals',
          enabled: true,
          order: 4,
          draggable: true
        },
        {
          id: 'overview',
          name: 'Overview',
          enabled: true,
          order: 5,
          draggable: true
        },
        {
          id: 'smart_bcc',
          name: 'Smart BCC',
          enabled: true,
          order: 6,
          draggable: true
        },
        {
          id: 'leads',
          name: 'Leads',
          enabled: true,
          order: 7,
          draggable: true
        }
      ];
    }

    // Update the specific section
    const sections = sectionsArray.map(section => {
      if (section.id === sectionId) {
        return { ...section, enabled };
      }
      return section;
    });

    // Check if the section was found
    const sectionExists = sections.find(s => s.id === sectionId);
    if (!sectionExists) {
      return res.status(404).json({
        success: false,
        message: `Section '${sectionId}' not found in sidebar preferences`
      });
    }

    // Save updated preferences
    sidebarPrefs.sidebarSections = sections;
    sidebarPrefs.updatedAt = new Date();
    await sidebarPrefs.save();

    res.status(200).json({
      success: true,
      message: `Section '${sectionId}' ${enabled ? 'enabled' : 'disabled'} successfully`,
      sidebarSections: sidebarPrefs.sidebarSections,
      updatedSection: sectionExists
    });

  } catch (error) {
    console.error("Error toggling person sidebar section:", error);
    res.status(500).json({
      success: false,
      message: "Error toggling person sidebar section",
      error: error.message
    });
  }
};

// ===========================
// ORGANIZATION SIDEBAR MANAGEMENT
// ===========================

/**
 * Get organization sidebar section preferences for the current user
 */
exports.getOrganizationSidebarPreferences = async (req, res) => {
  const { OrganizationSidebarPreference } = req.models;
  try {
    const masterUserID = req.adminId;

    // Find existing preferences for this user
    let sidebarPrefs = await OrganizationSidebarPreference.findOne({
      where: { masterUserID }
    });

    // If no preferences exist, create default ones
    if (!sidebarPrefs) {
      const defaultSections = [
        {
          id: 'summary',
          name: 'Summary',
          enabled: true,
          order: 1,
          draggable: false
        },
        {
          id: 'details',
          name: 'Details',
          enabled: true,
          order: 2,
          draggable: true
        },
        {
          id: 'deals',
          name: 'Deals',
          enabled: true,
          order: 3,
          draggable: true
        },
        {
          id: 'related_organizations',
          name: 'Related organizations',
          enabled: true,
          order: 4,
          draggable: true
        },
        {
          id: 'people',
          name: 'People',
          enabled: true,
          order: 5,
          draggable: true
        },
        {
          id: 'overview',
          name: 'Overview',
          enabled: true,
          order: 6,
          draggable: true
        },
        {
          id: 'smart_bcc',
          name: 'Smart BCC',
          enabled: true,
          order: 7,
          draggable: true
        },
        {
          id: 'leads',
          name: 'Leads',
          enabled: true,
          order: 8,
          draggable: true
        }
      ];

      sidebarPrefs = await OrganizationSidebarPreference.create({
        masterUserID,
        sidebarSections: defaultSections
      });
    }

    res.status(200).json({
      success: true,
      message: "Organization sidebar preferences retrieved successfully",
      sidebarSections: Array.isArray(sidebarPrefs.sidebarSections) 
        ? sidebarPrefs.sidebarSections 
        : (typeof sidebarPrefs.sidebarSections === 'string' 
            ? JSON.parse(sidebarPrefs.sidebarSections) 
            : []),
      totalSections: Array.isArray(sidebarPrefs.sidebarSections) 
        ? sidebarPrefs.sidebarSections.length 
        : (typeof sidebarPrefs.sidebarSections === 'string' 
            ? JSON.parse(sidebarPrefs.sidebarSections).length 
            : 0)
    });

  } catch (error) {
    console.error("Error fetching organization sidebar preferences:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching organization sidebar preferences",
      error: error.message
    });
  }
};

/**
 * Update organization sidebar section preferences (toggle visibility, reorder sections)
 */
exports.updateOrganizationSidebarPreferences = async (req, res) => {
  const { OrganizationSidebarPreference } = req.models;
  try {
    const masterUserID = req.adminId;
    const { sidebarSections } = req.body;

    // Validate input
    if (!Array.isArray(sidebarSections)) {
      return res.status(400).json({
        success: false,
        message: "sidebarSections must be an array"
      });
    }

    // Validate each section has required properties
    for (const section of sidebarSections) {
      if (!section.id || typeof section.name !== 'string' || typeof section.enabled !== 'boolean' || typeof section.order !== 'number') {
        return res.status(400).json({
          success: false,
          message: "Each section must have id, name (string), enabled (boolean), and order (number) properties"
        });
      }
    }

    // Find existing preferences
    let sidebarPrefs = await OrganizationSidebarPreference.findOne({
      where: { masterUserID }
    });

    if (!sidebarPrefs) {
      // Create new preferences if none exist
      sidebarPrefs = await OrganizationSidebarPreference.create({
        masterUserID,
        sidebarSections: sidebarSections
      });
    } else {
      // Update existing preferences
      sidebarPrefs.sidebarSections = sidebarSections;
      sidebarPrefs.updatedAt = new Date();
      await sidebarPrefs.save();
    }

    res.status(200).json({
      success: true,
      message: "Organization sidebar preferences updated successfully",
      sidebarSections: sidebarPrefs.sidebarSections,
      totalSections: sidebarPrefs.sidebarSections.length
    });

  } catch (error) {
    console.error("Error updating organization sidebar preferences:", error);
    res.status(500).json({
      success: false,
      message: "Error updating organization sidebar preferences",
      error: error.message
    });
  }
};

/**
 * Reset organization sidebar preferences to default
 */
exports.resetOrganizationSidebarPreferences = async (req, res) => {
  const { OrganizationSidebarPreference } = req.models;
  try {
    const masterUserID = req.adminId;

    const defaultSections = [
      {
        id: 'summary',
        name: 'Summary',
        enabled: true,
        order: 1,
        draggable: false
      },
      {
        id: 'details',
        name: 'Details',
        enabled: true,
        order: 2,
        draggable: true
      },
      {
        id: 'deals',
        name: 'Deals',
        enabled: true,
        order: 3,
        draggable: true
      },
      {
        id: 'related_organizations',
        name: 'Related organizations',
        enabled: true,
        order: 4,
        draggable: true
      },
      {
        id: 'people',
        name: 'People',
        enabled: true,
        order: 5,
        draggable: true
      },
      {
        id: 'overview',
        name: 'Overview',
        enabled: true,
        order: 6,
        draggable: true
      },
      {
        id: 'smart_bcc',
        name: 'Smart BCC',
        enabled: true,
        order: 7,
        draggable: true
      },
      {
        id: 'leads',
        name: 'Leads',
        enabled: true,
        order: 8,
        draggable: true
      }
    ];

    // Find existing preferences
    let sidebarPrefs = await OrganizationSidebarPreference.findOne({
      where: { masterUserID }
    });

    if (!sidebarPrefs) {
      // Create new preferences with defaults
      sidebarPrefs = await OrganizationSidebarPreference.create({
        masterUserID,
        sidebarSections: defaultSections
      });
    } else {
      // Reset existing preferences to defaults
      sidebarPrefs.sidebarSections = defaultSections;
      sidebarPrefs.updatedAt = new Date();
      await sidebarPrefs.save();
    }

    res.status(200).json({
      success: true,
      message: "Organization sidebar preferences reset to defaults successfully",
      sidebarSections: sidebarPrefs.sidebarSections,
      totalSections: sidebarPrefs.sidebarSections.length
    });

  } catch (error) {
    console.error("Error resetting organization sidebar preferences:", error);
    res.status(500).json({
      success: false,
      message: "Error resetting organization sidebar preferences",
      error: error.message
    });
  }
};

/**
 * Toggle a specific organization sidebar section visibility
 */
exports.toggleOrganizationSidebarSection = async (req, res) => {
  const { OrganizationSidebarPreference } = req.models;
  try {
    const masterUserID = req.adminId;
    const { sectionId, enabled } = req.body;

    // Validate input
    if (!sectionId || typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: "sectionId and enabled (boolean) are required"
      });
    }

    // Find existing preferences
    let sidebarPrefs = await OrganizationSidebarPreference.findOne({
      where: { masterUserID }
    });

    if (!sidebarPrefs) {
      return res.status(404).json({
        success: false,
        message: "Organization sidebar preferences not found. Please initialize preferences first."
      });
    }

    // Ensure sidebarSections is an array (handle both JSON string and object cases)
    let sectionsArray = sidebarPrefs.sidebarSections;
    
    // If it's a string, try to parse it
    if (typeof sectionsArray === 'string') {
      try {
        sectionsArray = JSON.parse(sectionsArray);
      } catch (parseError) {
        console.error("Error parsing organization sidebarSections JSON:", parseError);
        return res.status(500).json({
          success: false,
          message: "Invalid sidebar sections data format"
        });
      }
    }

    // If it's still not an array, initialize with default sections
    if (!Array.isArray(sectionsArray)) {
      console.warn("organization sidebarSections is not an array, initializing with defaults");
      sectionsArray = [
        {
          id: 'summary',
          name: 'Summary',
          enabled: true,
          order: 1,
          draggable: false
        },
        {
          id: 'details',
          name: 'Details',
          enabled: true,
          order: 2,
          draggable: true
        },
        {
          id: 'deals',
          name: 'Deals',
          enabled: true,
          order: 3,
          draggable: true
        },
        {
          id: 'related_organizations',
          name: 'Related organizations',
          enabled: true,
          order: 4,
          draggable: true
        },
        {
          id: 'people',
          name: 'People',
          enabled: true,
          order: 5,
          draggable: true
        },
        {
          id: 'overview',
          name: 'Overview',
          enabled: true,
          order: 6,
          draggable: true
        },
        {
          id: 'smart_bcc',
          name: 'Smart BCC',
          enabled: true,
          order: 7,
          draggable: true
        },
        {
          id: 'leads',
          name: 'Leads',
          enabled: true,
          order: 8,
          draggable: true
        }
      ];
    }

    // Update the specific section
    const sections = sectionsArray.map(section => {
      if (section.id === sectionId) {
        return { ...section, enabled };
      }
      return section;
    });

    // Check if the section was found
    const sectionExists = sections.find(s => s.id === sectionId);
    if (!sectionExists) {
      return res.status(404).json({
        success: false,
        message: `Section '${sectionId}' not found in organization sidebar preferences`
      });
    }

    // Save updated preferences
    sidebarPrefs.sidebarSections = sections;
    sidebarPrefs.updatedAt = new Date();
    await sidebarPrefs.save();

    res.status(200).json({
      success: true,
      message: `Section '${sectionId}' ${enabled ? 'enabled' : 'disabled'} successfully`,
      sidebarSections: sidebarPrefs.sidebarSections,
      updatedSection: sectionExists
    });

  } catch (error) {
    console.error("Error toggling organization sidebar section:", error);
    res.status(500).json({
      success: false,
      message: "Error toggling organization sidebar section",
      error: error.message
    });
  }
};
