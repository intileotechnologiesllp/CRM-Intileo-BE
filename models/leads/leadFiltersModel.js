const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db"); // adjust path as needed

const LeadFilter = sequelize.define("LeadFilter", {
  filterId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  filterName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  filterConfig: {
    type: DataTypes.JSON, // Store filter conditions as JSON
    allowNull: false,
  },
  visibility: {
    type: DataTypes.STRING, // "Private" or "Public"
    defaultValue: "Private",
  },
  masterUserID: {
    type: DataTypes.INTEGER, // The user who created the filter
    allowNull: false,
  },
  columns: {
    type: DataTypes.JSON, // Optional: store selected columns
    allowNull: true,
  },
  filterEntityType: {
    type: DataTypes.ENUM('lead', 'deal', 'person', 'organization', 'activity'),
    allowNull: false,
    defaultValue: 'lead',
    comment: 'Indicates which entity type this filter is designed for'
  },
  isFavorite: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Indicates if this filter is marked as favorite by the user'
  },
});

module.exports = LeadFilter;