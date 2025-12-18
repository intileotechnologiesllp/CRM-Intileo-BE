const { DataTypes } = require("sequelize");

const createLostReasonModel = (sequelizeInstance) => {
  const LostReason = sequelizeInstance.define(
    "LostReason",
    {
      lostReasonId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      reason: { type: DataTypes.STRING, allowNull: false },
      isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    },
    {
      tableName: "lost_reasons",
      timestamps: true,
    }
  );

  return LostReason;
};

module.exports = createLostReasonModel;
