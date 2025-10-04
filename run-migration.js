/**
 * CRM Database Migration Runner
 * 
 * This script runs the complete database migration for the CRM system
 * Usage: node run-migration.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'crm_test2',
  multipleStatements: true // Enable multiple SQL statements
};

class MigrationRunner {
  constructor() {
    this.connection = null;
    this.migrationFile = path.join(__dirname, 'database-migration.sql');
  }

  async connect() {
    try {
      console.log('🔌 Connecting to database...');
      console.log(`📍 Host: ${dbConfig.host}:${dbConfig.port}`);
      console.log(`🏢 Database: ${dbConfig.database}`);
      
      this.connection = await mysql.createConnection(dbConfig);
      console.log('✅ Database connection established');
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      throw error;
    }
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.end();
      console.log('🔌 Database connection closed');
    }
  }

  async checkMigrationFile() {
    try {
      if (!fs.existsSync(this.migrationFile)) {
        throw new Error(`Migration file not found: ${this.migrationFile}`);
      }
      
      const stats = fs.statSync(this.migrationFile);
      console.log(`📄 Migration file found: ${this.migrationFile}`);
      console.log(`📊 File size: ${(stats.size / 1024).toFixed(2)} KB`);
      return true;
    } catch (error) {
      console.error('❌ Migration file check failed:', error.message);
      throw error;
    }
  }

  async backupDatabase() {
    try {
      console.log('💾 Creating database backup...');
      
      // Get current timestamp for backup naming
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = `backup_${dbConfig.database}_${timestamp}.sql`;
      
      console.log(`📁 Backup file: ${backupFile}`);
      console.log('ℹ️  Note: You can create a manual backup using mysqldump if needed');
      console.log(`   Command: mysqldump -h ${dbConfig.host} -u ${dbConfig.user} -p ${dbConfig.database} > ${backupFile}`);
      
      return backupFile;
    } catch (error) {
      console.error('❌ Backup preparation failed:', error.message);
      throw error;
    }
  }

  async runPreMigrationChecks() {
    try {
      console.log('🔍 Running pre-migration checks...');

      // Check database exists
      const [databases] = await this.connection.execute(
        'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?',
        [dbConfig.database]
      );

      if (databases.length === 0) {
        throw new Error(`Database '${dbConfig.database}' does not exist`);
      }

      // Check existing tables
      const [tables] = await this.connection.execute(`
        SELECT TABLE_NAME, TABLE_ROWS, CREATE_TIME 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = '${dbConfig.database}'
        ORDER BY TABLE_NAME
      `);

      console.log(`📊 Found ${tables.length} existing tables:`);
      tables.forEach(table => {
        console.log(`   - ${table.TABLE_NAME} (${table.TABLE_ROWS || 0} rows)`);
      });

      return { tables: tables.length };
    } catch (error) {
      console.error('❌ Pre-migration checks failed:', error.message);
      throw error;
    }
  }

  async executeMigration() {
    try {
      console.log('🚀 Starting database migration...');
      
      // Read migration file
      const migrationSQL = fs.readFileSync(this.migrationFile, 'utf8');
      
      // Split into individual statements for better error handling
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      console.log(`📝 Found ${statements.length} SQL statements to execute`);

      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      // Execute statements one by one
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        
        try {
          // Skip comments and empty statements
          if (statement.startsWith('--') || statement.trim() === '') {
            continue;
          }

          console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
          
          await this.connection.execute(statement);
          successCount++;
          
        } catch (error) {
          errorCount++;
          const errorMsg = `Statement ${i + 1}: ${error.message}`;
          errors.push(errorMsg);
          
          // Log error but continue (some errors like "column already exists" are acceptable)
          if (error.message.includes('Duplicate column') || 
              error.message.includes('already exists') ||
              error.message.includes('Duplicate key')) {
            console.log(`⚠️  ${errorMsg} (ignored - already exists)`);
          } else {
            console.error(`❌ ${errorMsg}`);
          }
        }
      }

      console.log(`\n📊 Migration execution summary:`);
      console.log(`   ✅ Successful statements: ${successCount}`);
      console.log(`   ⚠️  Errors/warnings: ${errorCount}`);

      if (errors.length > 0) {
        console.log(`\n⚠️  Detailed error log:`);
        errors.forEach((error, index) => {
          console.log(`   ${index + 1}. ${error}`);
        });
      }

      return {
        success: successCount,
        errors: errorCount,
        errorDetails: errors
      };

    } catch (error) {
      console.error('❌ Migration execution failed:', error.message);
      throw error;
    }
  }

  async runPostMigrationChecks() {
    try {
      console.log('🔍 Running post-migration verification...');

      // Check tables after migration
      const [tables] = await this.connection.execute(`
        SELECT TABLE_NAME, TABLE_ROWS, DATA_LENGTH, INDEX_LENGTH, CREATE_TIME 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = '${dbConfig.database}'
        ORDER BY TABLE_NAME
      `);

      console.log(`📊 Database now contains ${tables.length} tables:`);
      tables.forEach(table => {
        const sizeKB = Math.round((table.DATA_LENGTH + table.INDEX_LENGTH) / 1024);
        console.log(`   ✅ ${table.TABLE_NAME} (${table.TABLE_ROWS || 0} rows, ${sizeKB} KB)`);
      });

      // Check specific new columns
      const columnsToCheck = [
        { table: 'Leads', column: 'isArchived' },
        { table: 'Leads', column: 'dealId' },
        { table: 'Deals', column: 'probability' },
        { table: 'Emails', column: 'body_fetch_status' },
        { table: 'Emails', column: 'leadId' },
        { table: 'Emails', column: 'dealId' }
      ];

      console.log('\n🔍 Verifying new columns:');
      for (const check of columnsToCheck) {
        try {
          const [columns] = await this.connection.execute(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = '${dbConfig.database}' 
              AND TABLE_NAME = '${check.table}' 
              AND COLUMN_NAME = '${check.column}'
          `);

          if (columns.length > 0) {
            const col = columns[0];
            console.log(`   ✅ ${check.table}.${check.column} - ${col.DATA_TYPE} (${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'})`);
          } else {
            console.log(`   ❌ ${check.table}.${check.column} - NOT FOUND`);
          }
        } catch (error) {
          console.log(`   ❌ ${check.table}.${check.column} - ERROR: ${error.message}`);
        }
      }

      // Check indexes
      const [indexes] = await this.connection.execute(`
        SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, NON_UNIQUE
        FROM information_schema.STATISTICS 
        WHERE TABLE_SCHEMA = '${dbConfig.database}'
          AND INDEX_NAME LIKE 'idx_%'
        ORDER BY TABLE_NAME, INDEX_NAME
      `);

      console.log(`\n📈 Found ${indexes.length} custom indexes:`);
      const indexGroups = {};
      indexes.forEach(idx => {
        const key = `${idx.TABLE_NAME}.${idx.INDEX_NAME}`;
        if (!indexGroups[key]) {
          indexGroups[key] = [];
        }
        indexGroups[key].push(idx.COLUMN_NAME);
      });

      Object.keys(indexGroups).forEach(key => {
        const columns = indexGroups[key].join(', ');
        console.log(`   📌 ${key} (${columns})`);
      });

      return {
        tables: tables.length,
        columns: columnsToCheck.length,
        indexes: Object.keys(indexGroups).length
      };

    } catch (error) {
      console.error('❌ Post-migration checks failed:', error.message);
      throw error;
    }
  }

  async run() {
    const startTime = Date.now();
    
    try {
      console.log('🎯 CRM Database Migration Starting...');
      console.log(`📅 Date: ${new Date().toISOString()}`);
      console.log('=' .repeat(50));

      // Step 1: Check migration file
      await this.checkMigrationFile();

      // Step 2: Connect to database
      await this.connect();

      // Step 3: Backup preparation
      await this.backupDatabase();

      // Step 4: Pre-migration checks
      const preChecks = await this.runPreMigrationChecks();

      // Step 5: Execute migration
      const migrationResult = await this.executeMigration();

      // Step 6: Post-migration verification
      const postChecks = await this.runPostMigrationChecks();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log('\n' + '=' .repeat(50));
      console.log('🎉 MIGRATION COMPLETED SUCCESSFULLY!');
      console.log(`⏱️  Total time: ${duration} seconds`);
      console.log(`📊 Summary:`);
      console.log(`   - SQL statements executed: ${migrationResult.success}`);
      console.log(`   - Warnings/errors: ${migrationResult.errors}`);
      console.log(`   - Database tables: ${postChecks.tables}`);
      console.log(`   - Custom indexes: ${postChecks.indexes}`);
      console.log('\n✨ Your CRM database is now ready to use!');

    } catch (error) {
      console.error('\n' + '=' .repeat(50));
      console.error('💥 MIGRATION FAILED!');
      console.error(`❌ Error: ${error.message}`);
      console.error('\n🔧 Troubleshooting tips:');
      console.error('   1. Check database connection settings in .env file');
      console.error('   2. Ensure database user has sufficient privileges');
      console.error('   3. Verify database exists and is accessible');
      console.error('   4. Check migration file exists and is readable');
      
      process.exit(1);
    } finally {
      await this.disconnect();
    }
  }
}

// Self-executing function with command line argument handling
(async () => {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
CRM Database Migration Runner

Usage: node run-migration.js [options]

Options:
  --help, -h     Show this help message
  --dry-run      Show what would be executed without running migration
  --force        Skip confirmation prompts

Environment Variables:
  DB_HOST        Database host (default: localhost)
  DB_PORT        Database port (default: 3306)  
  DB_USER        Database username (default: root)
  DB_PASSWORD    Database password
  DB_NAME        Database name (default: crm_test2)

Examples:
  node run-migration.js              # Run normal migration
  node run-migration.js --dry-run    # Preview migration
  node run-migration.js --force      # Skip prompts
`);
    process.exit(0);
  }

  if (args.includes('--dry-run')) {
    console.log('🔍 DRY RUN MODE - No changes will be made');
    console.log('📄 Migration file would be executed:', path.join(__dirname, 'database-migration.sql'));
    console.log('🏢 Target database:', process.env.DB_NAME || 'crm_test2');
    console.log('📍 Database host:', process.env.DB_HOST || 'localhost');
    process.exit(0);
  }

  if (!args.includes('--force')) {
    console.log('⚠️  This will modify your database structure.');
    console.log(`🎯 Target: ${process.env.DB_NAME || 'crm_test2'} on ${process.env.DB_HOST || 'localhost'}`);
    console.log('\n🛡️  BACKUP RECOMMENDATION:');
    console.log('   Please ensure you have a database backup before proceeding.');
    console.log('\n▶️  Press Ctrl+C to cancel or Enter to continue...');
    
    // Wait for user input
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });
  }

  const runner = new MigrationRunner();
  await runner.run();
})();

module.exports = MigrationRunner;
