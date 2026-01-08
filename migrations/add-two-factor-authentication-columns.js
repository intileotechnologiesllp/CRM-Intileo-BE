const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔧 Adding 2FA columns to MasterUsers table...');
    
    try {
      // Add twoFactorEnabled column
      await queryInterface.addColumn('MasterUsers', 'twoFactorEnabled', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
      console.log('✅ Added twoFactorEnabled column');

      // Add twoFactorSecret column
      await queryInterface.addColumn('MasterUsers', 'twoFactorSecret', {
        type: DataTypes.TEXT,
        allowNull: true,
      });
      console.log('✅ Added twoFactorSecret column');

      // Add twoFactorBackupCodes column
      await queryInterface.addColumn('MasterUsers', 'twoFactorBackupCodes', {
        type: DataTypes.TEXT,
        allowNull: true,
      });
      console.log('✅ Added twoFactorBackupCodes column');

      // Add twoFactorEnabledAt column
      await queryInterface.addColumn('MasterUsers', 'twoFactorEnabledAt', {
        type: DataTypes.DATE,
        allowNull: true,
      });
      console.log('✅ Added twoFactorEnabledAt column');

      console.log('🎉 2FA migration completed successfully!');
    } catch (error) {
      console.error('❌ Error during 2FA migration:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔧 Removing 2FA columns from MasterUsers table...');
    
    try {
      await queryInterface.removeColumn('MasterUsers', 'twoFactorEnabled');
      console.log('✅ Removed twoFactorEnabled column');

      await queryInterface.removeColumn('MasterUsers', 'twoFactorSecret');
      console.log('✅ Removed twoFactorSecret column');

      await queryInterface.removeColumn('MasterUsers', 'twoFactorBackupCodes');
      console.log('✅ Removed twoFactorBackupCodes column');

      await queryInterface.removeColumn('MasterUsers', 'twoFactorEnabledAt');
      console.log('✅ Removed twoFactorEnabledAt column');

      console.log('🎉 2FA rollback completed successfully!');
    } catch (error) {
      console.error('❌ Error during 2FA rollback:', error);
      throw error;
    }
  }
};