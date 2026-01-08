const LeadColumnPreference = require("../../models/leads/leadColumnModel");
const Lead = require("../../models/leads/leadsModel");
const { Op } = require("sequelize");
const LeadDetails = require("../../models/leads/leadDetailsModel");
const CustomField = require("../../models/customFieldModel");



exports.saveLeadColumnPreference = async (req, res) => {
  const {LeadColumnPreference} = req.models;
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
   const {LeadColumnPreference, CustomField, } = req.models;
  try {
    const pref = await LeadColumnPreference.findOne({ where: {} });

    let columns = [];
    if (pref) {
      // Parse columns if it's a string
      columns =
        typeof pref.columns === "string"
          ? JSON.parse(pref.columns)
          : pref.columns;
    }

    // Optionally: parse filterConfig for each column if needed
    columns = columns.map((col) => {
      if (col.filterConfig) {
        col.filterConfig =
          typeof col.filterConfig === "string"
            ? JSON.parse(col.filterConfig)
            : col.filterConfig;
      }
      return col;
    });

    // Fetch custom fields for leads (only if user is authenticated)
    let customFields = [];
    if (req.adminId) {
      try {
        customFields = await CustomField.findAll({
          where: {
            entityType: { [Op.in]: ["lead", "both"] }, // Support unified fields
            isActive: true,
            [Op.or]: [
              { masterUserID: req.adminId },
              { fieldSource: "default" },
              { fieldSource: "system" },
              { fieldSource: "custom" }, // Include custom fields
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
        // Continue without custom fields if there's an error
      }
    } else {
      console.warn("No adminId found in request - skipping custom fields");
    }

    // Create a map of available custom field names from CustomFields table
    const availableCustomFieldNames = new Set(
      customFields.map(field => field.fieldName)
    );

    // Filter out custom field columns that don't exist in CustomFields table
    const validColumns = columns.filter(col => {
      // Keep non-custom fields
      if (!col.fieldSource || col.fieldSource !== "custom") {
        return true;
      }
      
      // For custom fields, only keep if they exist in CustomFields table
      const isValid = availableCustomFieldNames.has(col.key);
      if (!isValid) {
        console.log(`Removing invalid custom field from preferences: ${col.key}`);
      }
      return isValid;
    });

    // Update the columns array with filtered results
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
      check: field.check || false, // Use the check field from CustomField model
    }));

    // Check if custom fields already exist in preferences and update their check status
    customFieldColumns.forEach((customCol) => {
      const existingCol = columns.find((col) => col.key === customCol.key);
      if (existingCol) {
        customCol.check = existingCol.check;
      }
    });

    // Merge regular columns with custom field columns
    const allColumns = [...columns, ...customFieldColumns];

    // Remove duplicates (custom fields might already be in preferences)
    const uniqueColumns = [];
    const seenKeys = new Set();

    allColumns.forEach((col) => {
      if (!seenKeys.has(col.key)) {
        seenKeys.add(col.key);
        uniqueColumns.push(col);
      }
    });

    // Save updated preferences if any invalid custom fields were removed
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
      message: "Column preferences with custom fields fetched successfully",
      hasCustomFields: customFields.length > 0,
      userAuthenticated: !!req.adminId,
      cleanedInvalidFields: originalColumnsCount > filteredColumnsCount,
      removedFieldsCount: originalColumnsCount - filteredColumnsCount,
    });
  } catch (error) {
    console.error("Error fetching column preferences:", error);
    res.status(500).json({
      message: "Error fetching preferences",
      error: error.message,
      userAuthenticated: !!req.adminId,
    });
  }
};

exports.deleteLeadColumn = async (req, res) => {
  const {LeadColumnPreference} = req.models;
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
  const {LeadColumnPreference, LeadDetail, Lead} = req.models;
  let LeadDetails;
  // try {
  //   LeadDetails = require("../../models/leads/leadDetailsModel");
  // } catch (e) {
  //   LeadDetails = null;
  // }

  // Get all field names from Lead and LeadDetails models
  const leadFields = Object.keys(Lead.rawAttributes);
  const leadDetailsFields = LeadDetails
    ? Object.keys(LeadDetail.rawAttributes)
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
    res
      .status(200)
      .json({ message: "All columns saved", columns: pref.columns });
  } catch (error) {
    console.log("Error saving all columns:", error);
    res.status(500).json({ message: "Error saving all columns" });
  }
};

exports.updateLeadColumnChecks = async (req, res) => {
   const {LeadColumnPreference, CustomField, } = req.models;
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
            entityType: { [Op.in]: ["lead", "both"] },
            isActive: true,
            [Op.or]: [
              { masterUserID: req.adminId },
              { fieldSource: "default" },
              { fieldSource: "system" },
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
              ],
            },
          }
        );
      }
    }

    pref.columns = prefColumns;
    await pref.save();

    res.status(200).json({
      message: "Columns updated",
      columns: pref.columns,
      customFieldsProcessed: customFields.length,
      customFieldsUpdated: customFieldUpdates.length,
      totalColumns: prefColumns.length,
    });
  } catch (error) {
    console.error("Error updating columns:", error);
    res.status(500).json({ message: "Error updating columns" });
  }
};

exports.syncCustomFieldsWithPreferences = async (req, res) => {
  const {LeadColumnPreference, CustomField, } = req.models;
  try {
    // Get or create LeadColumnPreference record
    let pref = await LeadColumnPreference.findOne();
    if (!pref) {
      pref = await LeadColumnPreference.create({ columns: [] });
    }

    // Parse existing columns
    let existingColumns = 
      typeof pref.columns === "string" 
        ? JSON.parse(pref.columns) 
        : pref.columns || [];

    // Fetch all active custom fields for leads
    let customFields = [];
    if (req.adminId) {
      try {
        customFields = await CustomField.findAll({
          where: {
            entityType: { [Op.in]: ["lead", "both"] },
            isActive: true,
            [Op.or]: [
              // { masterUserID: req.adminId },
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
        console.log(`Fetched ${customFields.length} active custom fields for leads`);
        
      } catch (customFieldError) {
        console.error("Error fetching custom fields:", customFieldError);
        return res.status(500).json({ 
          message: "Error fetching custom fields",
          error: customFieldError.message 
        });
      }
    } else {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Create a set of existing column keys for quick lookup
    const existingKeys = new Set(
      existingColumns.map(col => col.key || col)
    );

    // Track new fields added
    let newFieldsAdded = 0;
    let updatedFields = 0;

    // Add new custom fields that don't exist in preferences
    customFields.forEach((field) => {
      if (!existingKeys.has(field.fieldName)) {
        existingColumns.push({
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
        });
        newFieldsAdded++;
      } else {
        // Update existing custom field info if it exists
        const existingIndex = existingColumns.findIndex(
          col => col.key === field.fieldName
        );
        if (existingIndex !== -1 && existingColumns[existingIndex].isCustomField) {
          existingColumns[existingIndex] = {
            ...existingColumns[existingIndex],
            label: field.fieldLabel,
            type: field.fieldType,
            fieldId: field.fieldId,
            isRequired: field.isRequired,
            isImportant: field.isImportant,
            fieldSource: field.fieldSource,
            entityType: field.entityType,
          };
          updatedFields++;
        }
      }
    });

    // Remove custom fields from preferences that no longer exist in CustomField table
    const activeCustomFieldNames = new Set(
      customFields.map(field => field.fieldName)
    );

    const filteredColumns = existingColumns.filter(col => {
      // Keep non-custom fields
      if (!col.isCustomField) return true;
      
      // For custom fields, only keep if they still exist in CustomField table
      const stillExists = activeCustomFieldNames.has(col.key);
      if (!stillExists) {
        console.log(`Removing deleted custom field from preferences: ${col.key}`);
      }
      return stillExists;
    });

    const removedFieldsCount = existingColumns.length - filteredColumns.length;

    // Update preferences with synced columns
    pref.columns = filteredColumns;
    await pref.save();

    res.status(200).json({
      message: "Custom fields synced with column preferences",
      totalCustomFields: customFields.length,
      newFieldsAdded,
      updatedFields,
      removedFieldsCount,
      totalColumns: filteredColumns.length,
      columns: filteredColumns,
      success: true,
    });

  } catch (error) {
    console.error("Error syncing custom fields with preferences:", error);
    res.status(500).json({
      message: "Error syncing custom fields",
      error: error.message,
      success: false,
    });
  }
};
