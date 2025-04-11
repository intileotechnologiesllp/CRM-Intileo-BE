const { DataTypes } = require("sequelize");
const sequelize = require("../../../config/db");
const Country = require("./countryModel");

const Region = sequelize.define("Region", {
  region_desc: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  countryId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Country, // Reference the Country model
      key: "id",
    },
    onDelete: "CASCADE", // Delete regions if the country is deleted
  },
  creationDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  mode: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

// Define the relationship
Country.hasMany(Region, { foreignKey: "countryId", as: "regions" });
Region.belongsTo(Country, { foreignKey: "countryId" });

module.exports = Region;
