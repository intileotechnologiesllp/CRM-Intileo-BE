const { DataTypes } = require("sequelize");


const createLeadColumnModel = (sequelizeInstance) => {
const LeadColumn = sequelizeInstance.define("LeadColumn", {
  leadColumnId: {
    type: DataTypes.INTEGER,
    primaryKey: true, // Set as primary key
    autoIncrement: true, // Auto-increment the ID
  },
  leadColumn_desc: {
    type: DataTypes.STRING,
    allowNull: false, // Ensure this field cannot be null
    validate: {
      notNull: {
        msg: "leadColumn description is required", // Custom error message
      },
      notEmpty: {
        msg: "leadColumn description cannot be empty", // Custom error message
      },
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
    tableName: "LeadColumns",
    timestamps: true,
  }
);
return LeadColumn
}

module.exports = createLeadColumnModel;
