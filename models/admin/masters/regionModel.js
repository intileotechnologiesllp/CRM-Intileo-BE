const { DataTypes } = require("sequelize");


const createRegionModel = (sequelizeInstance) => {
const Region = sequelizeInstance.define("Region", {
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
      model: "Countries",
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
  },
},
  {
    tableName: "Regions",
    timestamps: true,
  }
);
return Region
}

// Region.belongsTo(Country, { foreignKey: "countryId", as: "country" });
// Country.hasMany(Region, { foreignKey: "countryId", as: "regions" });

module.exports = createRegionModel;
