const { DataTypes } = require("sequelize");

const createRecentSearchModel = (sequelizeInstance) => {
  const RecentSearch = sequelizeInstance.define(
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
      searchResults: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "JSON string containing the search results for quick access",
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
      isRecentlyViewed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: "Indicates if the search was recently viewed",
      },
      entityType: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "Type of entity associated with the search (e.g., lead, deal)",
      },
      entityId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: "ID of the entity associated with the search",
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
  return RecentSearch;
};

module.exports = createRecentSearchModel;
