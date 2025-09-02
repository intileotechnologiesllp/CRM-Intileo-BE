const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");
const MasterUser = require("../../models/master/masterUserModel")

const GroupVisibility = sequelize.define(
  "GroupVisibility",
  {
    groupId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    groupName: {
      type: DataTypes.STRING(70),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    pipeline: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    lead: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    deal: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    person: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    Organization: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    group: {
      type: DataTypes.STRING, // Changed to STRING to store multiple group IDs like "2,4,5"
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('group');
        return rawValue ? rawValue.split(',').map(id => parseInt(id.trim())) : [];
      },
      set(value) {
        if (Array.isArray(value)) {
          this.setDataValue('group', value.join(','));
        } else if (typeof value === 'string') {
          this.setDataValue('group', value);
        } else {
          this.setDataValue('group', null);
        }
      }
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "MasterUsers",
        key: "masterUserID",
      },
    },
  },
);

GroupVisibility.belongsTo(MasterUser, {
  foreignKey: 'createdBy',
  as: 'creator'
});

module.exports = GroupVisibility;
