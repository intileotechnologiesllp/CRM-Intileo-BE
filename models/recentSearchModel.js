const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const RecentSearch = sequelize.define(
  "RecentSearch",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    searchTerm: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "The search term entered by the user",
    },
    searchTypes: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Array of entity types searched (deals, people, etc.)",
    },
    resultsCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: "Number of results returned for this search",
    },
    masterUserID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "ID of the user who performed the search",
    },
    searchedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: "When the search was performed",
    },
  },
  {
    tableName: "RecentSearches",
    timestamps: true,
    indexes: [
      {
        fields: ["masterUserID", "searchedAt"],
        name: "idx_recent_searches_user_date",
      },
      {
        fields: ["searchTerm", "masterUserID"],
        name: "idx_recent_searches_term_user",
      },
    ],
  }
);

module.exports = RecentSearch;
