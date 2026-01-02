const { DataTypes } = require("sequelize");

const TagMapModel = (sequelizeInstance) => {
  const TagMap = sequelizeInstance.define(
    "TagMap",
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
      },

      tagId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false
      },

      entityType: {
        type: DataTypes.ENUM("deal", "lead"),
        allowNull: false
      },

      entityId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false
      }
    },
    {
      tableName: "TagMaps",
      underscored: true,
      timestamps: true,
      updatedAt: false,
      indexes: [
        // Prevent duplicate tags on same entity
        {
          unique: true,
          fields: ["tag_id", "entity_type", "entity_id"]
        },

        // Fast lookup: tags for an entity
        {
          fields: ["entity_type", "entity_id"]
        },

        // Fast lookup: all entities using a tag
        {
          fields: ["tag_id"]
        }
      ]
    }
  );

  return TagMap;
}

module.exports = TagMapModel