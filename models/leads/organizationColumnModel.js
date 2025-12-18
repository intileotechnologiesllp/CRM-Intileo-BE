const { DataTypes } = require("sequelize");

const createOrganizationColumnPreferenceModel = (sequelizeInstance) => {
  const OrganizationColumnPreference = sequelizeInstance.define(
    "OrganizationColumnPreference",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      masterUserID: { type: DataTypes.INTEGER, allowNull: true },
      columns: { type: DataTypes.JSON, allowNull: false, defaultValue: [] }, // Array of {key, source}
    },
    {
    tableName: "OrganizationColumnPreferences",
    timestamps: true,
  }
  );

  return OrganizationColumnPreference;
};

module.exports = createOrganizationColumnPreferenceModel;
