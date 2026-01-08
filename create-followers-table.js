/**
 * Script to create the Followers table in the database
 * Run this once to set up the follower functionality
 */

const sequelize = require('./config/db');
const fs = require('fs');
const path = require('path');

async function createFollowersTable() {
  try {
    console.log('🔄 Creating Followers table...');

    // Read the SQL file
    const sqlPath = path.join(__dirname, 'create-followers-table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Split by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.includes('CREATE TABLE') || statement.includes('INSERT')) {
        await sequelize.query(statement);
        console.log('✅ Executed SQL statement');
      }
    }

    console.log('✅ Followers table created successfully!');
    console.log('');
    console.log('📋 Verifying table structure...');

    // Verify table was created
    const [tables] = await sequelize.query(`
      SELECT TABLE_NAME, TABLE_ROWS, CREATE_TIME
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'Followers'
    `);

    if (tables.length > 0) {
      console.log('✅ Table verified:', tables[0]);
    }

    // Show table structure
    const [columns] = await sequelize.query('DESCRIBE Followers');
    console.log('');
    console.log('📊 Table structure:');
    console.table(columns);

    // Show indexes
    const [indexes] = await sequelize.query('SHOW INDEX FROM Followers');
    console.log('');
    console.log('🔑 Indexes:');
    console.table(indexes.map(i => ({
      Key_name: i.Key_name,
      Column_name: i.Column_name,
      Non_unique: i.Non_unique
    })));

    console.log('');
    console.log('✅ All done! You can now use the follower APIs.');
    console.log('');
    console.log('📚 Next steps:');
    console.log('1. Restart your application: pm2 restart all');
    console.log('2. Test the API: POST /api/followers/deal/1');
    console.log('3. Read documentation: FOLLOWER_SETUP_GUIDE.md');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating Followers table:', error);
    console.error('');
    console.error('💡 Troubleshooting:');
    console.error('1. Make sure your database connection is working');
    console.error('2. Check if MasterUsers table exists');
    console.error('3. Verify database user has CREATE TABLE permissions');
    console.error('');
    console.error('Full error:', error.message);
    process.exit(1);
  }
}

// Run the migration
createFollowersTable();
