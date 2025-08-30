/* Migration to add columns from Excel import to leads table */
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('leads', 'sourceOrigin', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('leads', 'responsiblePerson', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('leads', 'questionerShared', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
    });
    await queryInterface.addColumn('leads', 'statusSummery', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('leads', 'labels', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('leads', 'title', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('leads', 'creator', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('leads', 'sourceOrigin');
    await queryInterface.removeColumn('leads', 'responsiblePerson');
    await queryInterface.removeColumn('leads', 'questionerShared');
    await queryInterface.removeColumn('leads', 'statusSummery');
    await queryInterface.removeColumn('leads', 'labels');
    await queryInterface.removeColumn('leads', 'title');
    await queryInterface.removeColumn('leads', 'creator');
  }
};
