const sequelize = require("../config/db");

async function createUserInterfacePreferencesTable() {
  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS UserInterfacePreferences (
        preferenceId INT AUTO_INCREMENT PRIMARY KEY,
        masterUserID INT NOT NULL,
        showAddActivityModalAfterWinning BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Show add activity modal after winning a deal',
        openDetailsViewAfterCreating BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Open details view after creating a new item',
        openDetailsViewForLeadDeal BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Open details view for Lead/Deal',
        openDetailsViewForPerson BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Open details view for Person',
        openDetailsViewForOrganization BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Open details view for Organization',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_preference (masterUserID),
        FOREIGN KEY (masterUserID) REFERENCES MasterUsers(masterUserID) ON DELETE CASCADE,
        INDEX idx_masterUserID (masterUserID)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='User interface preferences for modal and detail view behavior';
    `);
    console.log("✅ UserInterfacePreferences table created successfully");
  } catch (error) {
    console.error("❌ Error creating UserInterfacePreferences table:", error);
    throw error;
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  createUserInterfacePreferencesTable()
    .then(() => {
      console.log("Migration completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}

module.exports = createUserInterfacePreferencesTable;
