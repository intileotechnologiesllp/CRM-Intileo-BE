#!/usr/bin/env node
require("dotenv").config();
const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

async function runMigrations() {
  let connection;

  try {
    console.log("🔄 Connecting to database...");

    // Create connection using your database config
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || "crm",
      multipleStatements: true,
    });

    console.log("✅ Connected to database");

    // Read the migration file
    const migrationPath = path.join(__dirname, "deploy_missing_columns.sql");
    const migrationSQL = fs.readFileSync(migrationPath, "utf8");

    console.log("🔄 Running migrations...");

    // Execute the migration
    await connection.execute(migrationSQL);

    console.log("✅ Migrations completed successfully!");

    // Check if columns exist
    console.log("🔍 Verifying columns...");
    const [rows] = await connection.execute(
      `
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'Deals' 
      AND COLUMN_NAME IN ('pipelineId', 'stageId')
    `,
      [process.env.DB_NAME || "crm"]
    );

    console.log(
      "Found columns:",
      rows.map((r) => r.COLUMN_NAME)
    );
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log("🔌 Database connection closed");
    }
  }
}

// Run migrations
runMigrations();
