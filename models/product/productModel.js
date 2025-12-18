const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");
const MasterUser = require("../master/masterUserModel");

const createProductModel = (sequelizeInstance) => {
const Product = sequelizeInstance.define(
  "Product",
  {
    productId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "Product name",
    },
    code: {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: true,
      comment: "Product code/SKU",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Product description",
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Product category",
    },
    unit: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Unit of measurement (e.g., pcs, kg, hours)",
    },
    // Pricing Information
    prices: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Array of price objects with currency and amount: [{currency: 'INR', amount: 1000}, {currency: 'USD', amount: 12}]",
    },
    cost: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      comment: "Direct cost/purchase price of the product",
    },
    costCurrency: {
      type: DataTypes.STRING(10),
      allowNull: true,
      defaultValue: "INR",
      comment: "Currency for cost",
    },
    // Billing & Tax
    billingFrequency: {
      type: DataTypes.ENUM(
        "one-time",
        "monthly",
        "quarterly",
        "semi-annually",
        "annually",
        "custom"
      ),
      allowNull: true,
      defaultValue: "one-time",
      comment: "How often the product is billed",
    },
    billingFrequencyCustom: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Custom billing frequency in days",
    },
    taxType: {
      type: DataTypes.ENUM("tax-exclusive", "tax-inclusive", "no-tax"),
      allowNull: true,
      defaultValue: "tax-exclusive",
      comment: "How tax is calculated",
    },
    taxPercentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: 0,
      comment: "Tax percentage (e.g., 18 for 18%)",
    },
    // Discount
    discountType: {
      type: DataTypes.ENUM("percentage", "fixed"),
      allowNull: true,
      comment: "Type of discount",
    },
    discountValue: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Discount value (percentage or fixed amount)",
    },
    // Product variations (for different tiers/options)
    hasVariations: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
      comment: "Whether product has variations",
    },
    // Visibility & Status
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true,
      comment: "Whether product is active",
    },
    visibilityGroup: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Visibility group for the product",
    },
    // Owner & Audit
    ownerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "MasterUsers",
        key: "masterUserID",
      },
      comment: "Product owner (created by)",
    },
    companyId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Company/tenant ID for multi-tenancy",
    },
    // Additional metadata
    imageUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: "Product image URL",
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Additional custom fields in JSON format",
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "Products",
    timestamps: true,
    indexes: [
      { fields: ["code"] },
      { fields: ["category"] },
      { fields: ["ownerId"] },
      { fields: ["isActive"] },
      { fields: ["companyId"] },
    ],
  }
);
return Product
}

// Associations
// Product.belongsTo(MasterUser, {
//   foreignKey: "ownerId",
//   as: "owner",
// });

module.exports = createProductModel;
