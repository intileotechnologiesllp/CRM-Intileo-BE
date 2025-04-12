const { DataTypes } = require("sequelize");
const sequelize = require("../../../config/db");
const Country = require("./countryModel");

const Region = sequelize.define("Region", {
  region_desc: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  countryId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Country,
      key: "id",
    },
    onDelete: "CASCADE",
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  mode: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  creationDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW, // Set default value to the current timestamp
  },
});

// Define associations
Country.hasMany(Region, { foreignKey: "countryId", as: "regions" });
Region.belongsTo(Country, { foreignKey: "countryId" });

module.exports = Region;
