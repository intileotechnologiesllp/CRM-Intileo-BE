const { DataTypes } = require("sequelize");


const createDealProductModel = (sequelizeInstance) => {
const DealProduct = sequelizeInstance.define(
  "DealProduct",
  {
    dealProductId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    dealId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Deals",
        key: "dealId",
      },
      comment: "Associated deal ID",
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Products",
        key: "productId",
      },
      comment: "Product ID",
    },
    variationId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "ProductVariations",
        key: "variationId",
      },
      comment: "Product variation ID (if applicable)",
    },
    quantity: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 1,
      comment: "Quantity of product",
    },
    // Price at the time of adding to deal (can differ from current product price)
    unitPrice: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      comment: "Unit price at time of adding",
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "INR",
      comment: "Currency code",
    },
    // Discount applied
    discountType: {
      type: DataTypes.ENUM("percentage", "fixed"),
      allowNull: true,
      comment: "Type of discount",
    },
    discountValue: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
      comment: "Discount value",
    },
    discountAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      defaultValue: 0,
      comment: "Calculated discount amount",
    },
    // Tax
    taxType: {
      type: DataTypes.ENUM("tax-exclusive", "tax-inclusive", "no-tax"),
      allowNull: true,
      defaultValue: "tax-exclusive",
      comment: "Tax type",
    },
    taxPercentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: 0,
      comment: "Tax percentage",
    },
    taxAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      defaultValue: 0,
      comment: "Calculated tax amount",
    },
    // Calculated totals
    subtotal: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      comment: "Subtotal (quantity * unitPrice)",
    },
    total: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      comment: "Total after discount and tax",
    },
    // Billing
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
      comment: "Billing frequency",
    },
    billingStartDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When billing starts",
    },
    billingEndDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When billing ends",
    },
    // Additional info
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Additional notes for this product in the deal",
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      comment: "Display order in deal",
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
    tableName: "DealProducts",
    timestamps: true,
    indexes: [
      { fields: ["dealId"] },
      { fields: ["productId"] },
      { fields: ["variationId"] },
    ],
  }
);
return DealProduct
}

// Associations
// DealProduct.belongsTo(Deal, {
//   foreignKey: "dealId",
//   as: "deal",
// });

// DealProduct.belongsTo(Product, {
//   foreignKey: "productId",
//   as: "product",
// });

// DealProduct.belongsTo(ProductVariation, {
//   foreignKey: "variationId",
//   as: "variation",
// });

// Deal.hasMany(DealProduct, {
//   foreignKey: "dealId",
//   as: "dealProducts",
// });

// Product.hasMany(DealProduct, {
//   foreignKey: "productId",
//   as: "dealProducts",
// });

module.exports = createDealProductModel;
