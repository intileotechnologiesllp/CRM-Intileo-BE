'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Add uid column to emails table
      await queryInterface.addColumn('emails', 'uid', {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'IMAP UID for email body fetching'
      });
      
      console.log('✅ Successfully added uid column to emails table');
    } catch (error) {
      console.error('❌ Error adding uid column:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      // Remove uid column from emails table
      await queryInterface.removeColumn('emails', 'uid');
      console.log('✅ Successfully removed uid column from emails table');
    } catch (error) {
      console.error('❌ Error removing uid column:', error);
      throw error;
    }
  }
};
