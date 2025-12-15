/**
 * Script to sync notification tables to the database
 * Run this once to create the notification tables
 */

const sequelize = require('./config/db');  // Fixed path
const { Notification, NotificationPreference, PushSubscription } = require('./models/notification');

async function syncNotificationTables() {
  try {
    console.log('🔄 Starting notification tables sync...');

    // Sync Notification table
    await Notification.sync({ force: false });
    console.log('✅ Notifications table synced');

    // Sync NotificationPreference table
    await NotificationPreference.sync({ force: false });
    console.log('✅ NotificationPreferences table synced');

    // Sync PushSubscription table
    await PushSubscription.sync({ force: false });
    console.log('✅ PushSubscriptions table synced');

    console.log('\n✅ All notification tables created successfully!');
    console.log('\nYou can now use the notification system.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error syncing notification tables:', error);
    process.exit(1);
  }
}

syncNotificationTables();
