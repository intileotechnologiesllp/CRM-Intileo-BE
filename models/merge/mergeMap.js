const { DataTypes } = require("sequelize");

const MergeMapModel = (sequelizeInstance) => {
  const MergeMap = sequelizeInstance.define(
    "MergeMap",
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
      },

      entityType: {
        type: DataTypes.ENUM("deal", "lead"),
        allowNull: false
      },

      mergedFromId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false
      },

      mergedIntoId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false
      },

      mergedBy: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false
      },

      reason: {
        type: DataTypes.STRING(255),
        allowNull: true
      }
    },
    {
      tableName: "MergeMaps",
      underscored: true,     // entity_type instead of entityType, etc.
      timestamps: true,      // adds created_at + updated_at
      updatedAt: false,      // keep only created_at (optional)
      indexes: [
        {
          unique: true,
          fields: ["entity_type", "merged_from_id"]
        },
        {
          fields: ["entity_type", "merged_into_id"]
        }
      ]
    }
  );

  return MergeMap;
}


module.exports = MergeMapModel