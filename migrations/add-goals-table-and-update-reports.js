const { DataTypes } = require("sequelize");

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create Goals table
    await queryInterface.createTable("Goals", {
      goalId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      dashboardId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Dashboards",
          key: "dashboardId",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      entity: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      goalType: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      targetValue: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
      },
      targetType: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "number",
      },
      period: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "monthly",
      },
      startDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      endDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      ownerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal(
          "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
        ),
      },
    });

    // Add new columns to Reports table
    try {
      await queryInterface.addColumn("Reports", "name", {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "Untitled Report",
      });
    } catch (error) {
      console.log("Column name already exists in Reports table");
    }

    try {
      await queryInterface.addColumn("Reports", "description", {
        type: DataTypes.TEXT,
        allowNull: true,
      });
    } catch (error) {
      console.log("Column description already exists in Reports table");
    }

    try {
      await queryInterface.changeColumn("Reports", "position", {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      });
    } catch (error) {
      console.log("Column position already has default value");
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Drop Goals table
    await queryInterface.dropTable("Goals");

    // Remove added columns from Reports table
    try {
      await queryInterface.removeColumn("Reports", "name");
      await queryInterface.removeColumn("Reports", "description");
    } catch (error) {
      console.log("Error removing columns from Reports table:", error.message);
    }
  },
};
