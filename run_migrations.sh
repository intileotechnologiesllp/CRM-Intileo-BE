#!/bin/bash
# Script to run database migrations on deployed server
# Save this as: run_migrations.sh

echo "🔄 Starting database migration..."

# Method 1: If you have MySQL client installed
mysql -u your_username -p -h your_host your_database_name < deploy_missing_columns.sql

# Method 2: Alternative using mysql with password prompt
# mysql -u root -p crm < deploy_missing_columns.sql

echo "✅ Migration completed!"

# Optional: Check if specific columns exist
echo "🔍 Checking for pipelineId and stageId columns..."
mysql -u your_username -p -h your_host your_database_name -e "DESCRIBE Deals;" | grep -E "(pipelineId|stageId)"

echo "Done!"
