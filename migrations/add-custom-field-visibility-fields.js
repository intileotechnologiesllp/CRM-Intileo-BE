const { QueryInterface, DataTypes } = require("sequelize");

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Add new visibility fields
      await queryInterface.addColumn(
        "CustomFields",
        "showInAddView",
        {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          comment: "Legacy field - whether to show in add/create forms",
        },
        { transaction }
      );

      await queryInterface.addColumn(
        "CustomFields",
        "showInDetailView",
        {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          comment: "Legacy field - whether to show in detail/edit forms",
        },
        { transaction }
      );

      await queryInterface.addColumn(
        "CustomFields",
        "showInListView",
        {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          comment: "Whether to show in list/table views",
        },
        { transaction }
      );

      await queryInterface.addColumn(
        "CustomFields",
        "leadView",
        {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          comment: "Whether to show in lead forms and views",
        },
        { transaction }
      );

      await queryInterface.addColumn(
        "CustomFields",
        "dealView",
        {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          comment: "Whether to show in deal forms and views",
        },
        { transaction }
      );

      // Add configuration fields
      await queryInterface.addColumn(
        "CustomFields",
        "placesWhereShown",
        {
          type: DataTypes.JSON,
          allowNull: true,
          comment:
            "JSON object defining where field should be shown (leadView, dealView, listView, pipelines)",
        },
        { transaction }
      );

      await queryInterface.addColumn(
        "CustomFields",
        "userSpecifications",
        {
          type: DataTypes.JSON,
          allowNull: true,
          comment:
            "JSON object with user permissions (editingUsers, viewingUsers)",
        },
        { transaction }
      );

      await queryInterface.addColumn(
        "CustomFields",
        "pipelineRestrictions",
        {
          type: DataTypes.JSON,
          allowNull: true,
          comment: "JSON object or string defining pipeline restrictions",
        },
        { transaction }
      );

      await queryInterface.addColumn(
        "CustomFields",
        "qualityRules",
        {
          type: DataTypes.JSON,
          allowNull: true,
          comment:
            "JSON object with quality rules (required, important, unique, minLength, maxLength, etc.)",
        },
        { transaction }
      );

      // Create indexes for better query performance
      await queryInterface.addIndex("CustomFields", ["leadView"], {
        name: "idx_custom_fields_lead_view",
        transaction,
      });

      await queryInterface.addIndex("CustomFields", ["dealView"], {
        name: "idx_custom_fields_deal_view",
        transaction,
      });

      await queryInterface.addIndex("CustomFields", ["showInListView"], {
        name: "idx_custom_fields_list_view",
        transaction,
      });

      await transaction.commit();
      console.log(
        "Successfully added visibility and configuration fields to CustomFields table"
      );
    } catch (error) {
      await transaction.rollback();
      console.error("Error adding fields to CustomFields table:", error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Remove indexes
      await queryInterface.removeIndex(
        "CustomFields",
        "idx_custom_fields_lead_view",
        { transaction }
      );
      await queryInterface.removeIndex(
        "CustomFields",
        "idx_custom_fields_deal_view",
        { transaction }
      );
      await queryInterface.removeIndex(
        "CustomFields",
        "idx_custom_fields_list_view",
        { transaction }
      );

      // Remove columns
      await queryInterface.removeColumn("CustomFields", "showInAddView", {
        transaction,
      });
      await queryInterface.removeColumn("CustomFields", "showInDetailView", {
        transaction,
      });
      await queryInterface.removeColumn("CustomFields", "showInListView", {
        transaction,
      });
      await queryInterface.removeColumn("CustomFields", "leadView", {
        transaction,
      });
      await queryInterface.removeColumn("CustomFields", "dealView", {
        transaction,
      });
      await queryInterface.removeColumn("CustomFields", "placesWhereShown", {
        transaction,
      });
      await queryInterface.removeColumn("CustomFields", "userSpecifications", {
        transaction,
      });
      await queryInterface.removeColumn(
        "CustomFields",
        "pipelineRestrictions",
        { transaction }
      );
      await queryInterface.removeColumn("CustomFields", "qualityRules", {
        transaction,
      });

      await transaction.commit();
      console.log(
        "Successfully removed visibility and configuration fields from CustomFields table"
      );
    } catch (error) {
      await transaction.rollback();
      console.error("Error removing fields from CustomFields table:", error);
      throw error;
    }
  },
};
