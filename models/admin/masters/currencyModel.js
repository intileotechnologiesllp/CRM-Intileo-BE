const { DataTypes } = require("sequelize");

const createCurrencyModel = (sequelizeInstance) => {
const Currency = sequelizeInstance.define("Currency", {
  currencyId: {
    type: DataTypes.INTEGER,
    primaryKey: true, // Set as primary key
    autoIncrement: true, // Auto-increment the ID
  },
  currency_desc: {
    type: DataTypes.STRING(150),
    allowNull: false,
    validate: {
      notNull: {
        msg: "Currency description is required",
      },
      notEmpty: {
        msg: "Currency description cannot be empty",
      },
      len: {
        args: [1, 150],
        msg: "Currency description must be between 1 and 150 characters"
      }
    },
  },
  symbol: {
    type: DataTypes.STRING(15),
    allowNull: false,
    validate: {
      notNull: {
        msg: "Symbol is required",
      },
      notEmpty: {
        msg: "Symbol cannot be empty",
      },
      len: {
        args: [1, 15],
        msg: "Symbol must be between 1 and 15 characters"
      }
    },
  },
  decimalPoints: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 2,
    validate: {
      min: {
        args: [0],
        msg: "Decimal points cannot be negative"
      },
      max: {
        args: [10],
        msg: "Decimal points cannot exceed 10"
      }
    },
  },
  code: {
    type: DataTypes.STRING(10),
    allowNull: false,
    unique: true,
    validate: {
      notNull: {
        msg: "Currency code is required",
      },
      notEmpty: {
        msg: "Currency code cannot be empty",
      }
    },
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  isCustom: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false, // false for standard currencies, true for custom
  },
  // Virtual field for API consistency (alias for currency_desc)
  fullName: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.currency_desc;
    },
    set(value) {
      this.currency_desc = value;
    }
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
}, {
  tableName: 'Currencies',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['code'],
      name: 'unique_currency_code'
    },
    {
      fields: ['isActive'],
      name: 'idx_currency_active'
    },
    {
      fields: ['isCustom'],
      name: 'idx_currency_custom'
    }
  ]
});
return Currency
}

module.exports = createCurrencyModel;
