const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");
const Tenant = require("./tenantModel");

const TenantUser = sequelize.define(
  "TenantUser",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    tenantId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM("owner", "admin", "agent"),
      defaultValue: "admin",
      allowNull: false,
    },
  },
  {
    tableName: "tenant_users",
    timestamps: true,
    indexes: [{ fields: ["tenantId"] }],
  }
);

TenantUser.belongsTo(Tenant, { foreignKey: "tenantId", as: "tenant" });
Tenant.hasMany(TenantUser, { foreignKey: "tenantId", as: "users" });

module.exports = TenantUser;
