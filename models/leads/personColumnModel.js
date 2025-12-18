const { DataTypes } = require("sequelize");

const createPersonColumnPreferenceModel = (sequelizeInstance) => {
const PersonColumnPreference = sequelizeInstance.define("PersonColumnPreference", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  masterUserID: { type: DataTypes.INTEGER, allowNull: true },
  columns: { type: DataTypes.JSON, allowNull: false, defaultValue: [] } // Array of {key, source}
},
{
  tableName: "PersonColumnPreferences",
  timestamps: true,
}
);
return PersonColumnPreference;
}

module.exports = createPersonColumnPreferenceModel;