const { DataTypes } = require("sequelize");
const sequelize = require("../../../config/db");

const Label = sequelize.define("Label", {
  labelId: {
    type: DataTypes.INTEGER,
    primaryKey: true, // Set as primary key
    autoIncrement: true, // Auto-increment the ID
  },
  labelName: {
    type: DataTypes.STRING,
    allowNull: false, // Ensure this field cannot be null
    validate: {
      notNull: {
        msg: "Label name is required", // Custom error message
      },
      notEmpty: {
        msg: "Label name cannot be empty", // Custom error message
      },
    },
  },
  labelColor: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: "#007bff", // Default blue color
    validate: {
      isHexColor(value) {
        if (value && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value)) {
          throw new Error('Label color must be a valid hex color code');
        }
      }
    }
  },
  entityType: {
    type: DataTypes.ENUM('lead', 'deal', 'person', 'organization', 'sale-inbox', 'email', 'contact', 'all'),
    allowNull: false,
    defaultValue: 'all',
    validate: {
      isIn: {
        args: [['lead', 'deal', 'person', 'organization', 'sale-inbox', 'email', 'contact', 'all']],
        msg: "Entity type must be one of: lead, deal, person, organization, sale-inbox, email, contact, all"
      }
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  createdById: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  updatedBy: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  updatedById: {
    type: DataTypes.INTEGER,
    allowNull: true,
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
  updatedDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

module.exports = Label;