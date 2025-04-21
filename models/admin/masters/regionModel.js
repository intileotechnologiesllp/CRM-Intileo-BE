const { DataTypes } = require("sequelize");
const sequelize = require("../../../config/db");
const Country = require("./countryModel");

const Region = sequelize.define("Region", {
  regionID: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  region_desc: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notNull: {
        msg: "Region description is required",
      },
      notEmpty: {
        msg: "Region description cannot be empty",
      },
    },
  },
  countryId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Country,
      key: "countryID",
    },
  },

  createdBy: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  createdById: {
    type: DataTypes.INTEGER,
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
  }
});

Region.belongsTo(Country, { foreignKey: "countryID", as: "country" });
Country.hasMany(Region, { foreignKey: "countryID", as: "regions" });

module.exports = Region;