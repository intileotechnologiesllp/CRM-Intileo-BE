'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add body_fetch_status column to emails table
    await queryInterface.addColumn('emails', 'body_fetch_status', {
      type: Sequelize.ENUM('pending', 'completed', 'failed'),
      allowNull: true,
      defaultValue: 'pending',
      comment: 'Status of email body fetching for on-demand loading'
    });

    // Update existing emails to have 'completed' status if they already have body content
    await queryInterface.sequelize.query(`
      UPDATE emails 
      SET body_fetch_status = 'completed' 
      WHERE body IS NOT NULL AND body != ''
    `);

    console.log('✅ Added body_fetch_status column to emails table');
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the column
    await queryInterface.removeColumn('emails', 'body_fetch_status');
    
    // Remove the ENUM type (optional, but good practice)
    await queryInterface.sequelize.query("DROP TYPE IF EXISTS \"enum_emails_body_fetch_status\";");
    
    console.log('✅ Removed body_fetch_status column from emails table');
  }
};
