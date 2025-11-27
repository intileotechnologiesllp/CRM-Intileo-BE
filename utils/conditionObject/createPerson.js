const { Op, Sequelize } = require("sequelize");
const LeadOrganization = require("../../models/leads/leadOrganizationModel");
const { Person } = require("../../models");

exports.getPersonConditionObject = (column, operator, value, includeModels = []) => {
  let conditionValue = value;

  // Check if column contains a dot (indicating a related table field)
  const hasRelation = column.includes(".");
  let tableAlias = "LeadPerson";
  let fieldName = column;

  if (hasRelation) {
    [tableAlias, fieldName] = column.split(".");
  }

  // Handle date filtering for specific date columns
  const isDateColumn =
    fieldName.includes("Date") ||
    fieldName.includes("Time") ||
    fieldName === "startDateTime" ||
    fieldName === "endDateTime" ||
    fieldName === "dueDate" ||
    fieldName === "createdAt" ||
    fieldName === "updatedAt" ||
    fieldName === "expectedCloseDate" ||
    fieldName === "proposalSentDate";

  // Handle date range filtering for "Add on" (daterange type)
  const isDateRangeFilter = fieldName === "daterange";
  
  if (isDateRangeFilter && Array.isArray(value)) {
    // Handle date range filter (from frontend: ["2025-06-23", "2025-06-25"])
    const [fromDate, toDate] = value;
    
    // Determine which date field to filter based on the table alias
    let dateField;
    switch(tableAlias) {
      case "LeadOrganization":
        dateField = "createdAt";
        break;
      default:
        dateField = "createdAt";
    }
    
    // For related tables, use the proper Sequelize syntax
    if (tableAlias !== "LeadPerson") {
      // Add the required include model
      addIncludeModel(tableAlias, includeModels);
      
      // Return the condition with proper nested syntax
      if (operator === "between" || operator === "=" || operator === "is") {
        return {
          [`$${tableAlias}.${dateField}$`]: {
            [Op.between]: [new Date(fromDate + " 00:00:00"), new Date(toDate + " 23:59:59")]
          }
        };
      } else if (operator === "notBetween" || operator === "≠" || operator === "is not") {
        return {
          [`$${tableAlias}.${dateField}$`]: {
            [Op.notBetween]: [new Date(fromDate + " 00:00:00"), new Date(toDate + " 23:59:59")]
          }
        };
      }
    } else {
      // For Activity table
      if (operator === "between" || operator === "=" || operator === "is") {
        return {
          [dateField]: {
            [Op.between]: [new Date(fromDate + " 00:00:00"), new Date(toDate + " 23:59:59")]
          }
        };
      } else if (operator === "notBetween" || operator === "≠" || operator === "is not") {
        return {
          [dateField]: {
            [Op.notBetween]: [new Date(fromDate + " 00:00:00"), new Date(toDate + " 23:59:59")]
          }
        };
      }
    }
  } else if (isDateColumn) {
    // Handle single date filtering (e.g., "2025-06-23")
    if (operator === "=" || operator === "is") {
      // For exact date match, create a range for the entire day
      const startOfDay = new Date(value + " 00:00:00");
      const endOfDay = new Date(value + " 23:59:59");

      // For related tables
      if (hasRelation) {
        addIncludeModel(tableAlias, includeModels);
        return {
          [`$${tableAlias}.${fieldName}$`]: {
            [Op.between]: [startOfDay, endOfDay]
          }
        };
      } else {
        return {
          [fieldName]: {
            [Op.between]: [startOfDay, endOfDay]
          }
        };
      }
    } else if (operator === ">") {
      conditionValue = new Date(value + " 23:59:59");
    } else if (operator === "<") {
      conditionValue = new Date(value + " 00:00:00");
    } else if (operator === "≠" || operator === "is not") {
      // For not equal, exclude the entire day
      const startOfDay = new Date(value + " 00:00:00");
      const endOfDay = new Date(value + " 23:59:59");
      
      // For related tables
      if (hasRelation) {
        addIncludeModel(tableAlias, includeModels);
        return {
          [`$${tableAlias}.${fieldName}$`]: {
            [Op.notBetween]: [startOfDay, endOfDay]
          }
        };
      } else {
        return {
          [fieldName]: {
            [Op.notBetween]: [startOfDay, endOfDay]
          }
        };
      }
    } else {
      conditionValue = new Date(value);
    }
  }
  // Handle other data types
  else if (fieldName === "isDone") {
    conditionValue = value === "true" || value === true;
  } else if (!isNaN(value) && value !== "" && typeof value === "string") {
    conditionValue = parseFloat(value);
  }

  // Handle related table joins
  if (hasRelation) {
    addIncludeModel(tableAlias, includeModels);
    
    const op = getSequelizeOperator(operator);
    
    // Use proper Sequelize syntax for related table conditions
    switch (operator) {
      case "contains":
        return { [`$${tableAlias}.${fieldName}$`]: { [op]: `%${conditionValue}%` } };
      case "startsWith":
        return { [`$${tableAlias}.${fieldName}$`]: { [op]: `${conditionValue}%` } };
      case "endsWith":
        return { [`$${tableAlias}.${fieldName}$`]: { [op]: `%${conditionValue}` } };
      case "isEmpty":
        return {
          [Op.or]: [
            { [`$${tableAlias}.${fieldName}$`]: { [Op.is]: null } },
            { [`$${tableAlias}.${fieldName}$`]: { [Op.eq]: "" } },
          ],
        };
      case "isNotEmpty":
        return {
          [Op.and]: [
            { [`$${tableAlias}.${fieldName}$`]: { [Op.not]: null } },
            { [`$${tableAlias}.${fieldName}$`]: { [Op.ne]: "" } },
          ],
        };
      default:
        return { [`$${tableAlias}.${fieldName}$`]: { [op]: conditionValue } };
    }
  } else {
    // Regular activity table column
    return getOperatorCondition(column, operator, conditionValue);
  }
}

// Helper function to add include models
function addIncludeModel(tableAlias, includeModels) {
  let modelConfig;

  switch (tableAlias) {
    case "LeadOrganization":
      modelConfig = {
        model: LeadOrganization,
        as: "LeadOrganization",
        required: false,
        attributes: [],
      };
      break;
    default:
      return; // No include needed for Activity table
  }

  // Check if this include already exists to avoid duplicates
  const existingInclude = includeModels.find(
    (inc) => inc.as === modelConfig.as
  );
  if (!existingInclude) {
    includeModels.push(modelConfig);
  }
}

// Helper function for operator conditions
function getOperatorCondition(column, operator, value) {
  const op = getSequelizeOperator(operator);

  switch (operator) {
    case "contains":
      return { [column]: { [op]: `%${value}%` } };
    case "startsWith":
      return { [column]: { [op]: `${value}%` } };
    case "endsWith":
      return { [column]: { [op]: `%${value}` } };
    case "isEmpty":
      return {
        [Op.or]: [
          { [column]: { [Op.is]: null } },
          { [column]: { [Op.eq]: "" } },
        ],
      };
    case "isNotEmpty":
      return {
        [Op.and]: [
          { [column]: { [Op.not]: null } },
          { [column]: { [Op.ne]: "" } },
        ],
      };
    case "between":
    case "notBetween":
      return value; // Return the pre-built condition
    default:
      return { [column]: { [op]: value } };
  }
}
// Helper function to convert operator strings to Sequelize operators
function getSequelizeOperator(operator) {
  switch (operator) {
    case ">":
      return Op.gt;
    case "<":
      return Op.lt;
    case "=":
      return Op.eq;
    case "is":
      return Op.eq;
    case "≠":
      return Op.ne;
    case "is not":
      return Op.ne;
    case "contains":
      return Op.like;
    case "startsWith":
      return Op.like;
    case "endsWith":
      return Op.like;
    case "isEmpty":
      return Op.or;
    case "isNotEmpty":
      return Op.and;
    case "between":
      return Op.between;
    case "notBetween":
      return Op.notBetween;
    default:
      return Op.eq;
  }
}