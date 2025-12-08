const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");
const Product = require("./productModel");

const ProductVariation = sequelize.define(
  "ProductVariation",
  {
    variationId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Product,
        key: "productId",
      },
      comment: "Parent product ID",
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "Variation name (e.g., 'Enterprise Plan', 'Pro Plan')",
    },
    sku: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Stock keeping unit for this variation",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Variation description",
    },
    // Pricing for this variation
    prices: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Array of price objects: [{currency: 'INR', amount: 5000}]",
    },
    cost: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      comment: "Direct cost for this variation",
    },
    // Variation-specific attributes
    attributes: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Variation attributes (e.g., {color: 'red', size: 'large'})",
    },
    // Order/Display
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      comment: "Display order",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true,
      comment: "Whether variation is active",
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
    tableName: "product_variations",
    timestamps: true,
    indexes: [
      { fields: ["productId"] },
      { fields: ["sku"] },
      { fields: ["isActive"] },
    ],
  }
);

// Associations
ProductVariation.belongsTo(Product, {
  foreignKey: "productId",
  as: "product",
});

Product.hasMany(ProductVariation, {
  foreignKey: "productId",
  as: "variations",
});

module.exports = ProductVariation;
