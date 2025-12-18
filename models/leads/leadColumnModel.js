const { DataTypes } = require("sequelize");


const createLeadColumnPreferenceModel = (sequelizeInstance) => {
const LeadColumnPreference = sequelizeInstance.define("LeadColumnPreference", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  masterUserID: { type: DataTypes.INTEGER, allowNull: true },
  columns: { type: DataTypes.JSON, allowNull: false,defaultValue:[] } // Array of {key, source}
},
{
  tableName: "LeadColumnPreferences",
  timestamps: true,
});
return LeadColumnPreference
}

module.exports = createLeadColumnPreferenceModel;