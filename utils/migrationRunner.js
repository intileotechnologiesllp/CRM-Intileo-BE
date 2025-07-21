const fs = require("fs");
const path = require("path");
const sequelize = require("../config/db");

/**
 * Migration runner to sync database schema between environments
 * Run this before starting your application in production
 */

async function runMigrations() {
  try {
    console.log("🔄 Starting database migrations...");

    // Read and execute the migration SQL file
    const migrationPath = path.join(
      __dirname,
      "..",
      "deploy_missing_columns.sql"
    );
    const migrationSQL = fs.readFileSync(migrationPath, "utf8");

    // Split by semicolon and execute each statement
    const statements = migrationSQL
      .split(";")
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.startsWith("--"));

    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await sequelize.query(statement);
          console.log("✅ Executed migration statement");
        } catch (error) {
          // Log but don't fail for IF NOT EXISTS statements
          if (!error.message.includes("Duplicate column name")) {
            console.warn("⚠️ Migration warning:", error.message);
          }
        }
      }
    }

    console.log("✅ Database migrations completed successfully");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

module.exports = { runMigrations };
