const sequelize = require('./config/db'); // Use the same config as app.js

async function dropProblematicTables() {
    try {
        console.log('🔗 Connecting to database...');
        await sequelize.authenticate();
        console.log('✅ Database connection successful');

        // Drop the problematic tables
        const tablesToDrop = ['SchedulingLinks', 'Meetings'];
        
        for (const tableName of tablesToDrop) {
            try {
                await sequelize.query(`DROP TABLE IF EXISTS \`${tableName}\`;`);
                console.log(`✅ Dropped table: ${tableName}`);
            } catch (error) {
                console.log(`⚠️ Could not drop ${tableName}: ${error.message}`);
            }
        }

        console.log('✅ All problematic tables dropped successfully');
        console.log('🚀 Now restart the server - Sequelize will recreate tables properly');
        
    } catch (error) {
        console.error('❌ Error dropping tables:', error.message);
    } finally {
        await sequelize.close();
    }
}

dropProblematicTables();