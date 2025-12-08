#!/bin/bash
# Clean SMTP credentials from git history

echo "🚨 CLEANING GIT HISTORY - REMOVING SMTP CREDENTIALS"
echo "===================================================="
echo ""

# Create backup
BACKUP_BRANCH="backup-before-cleanup-$(date +%Y%m%d-%H%M%S)"
echo "📦 Creating backup branch: $BACKUP_BRANCH"
git branch "$BACKUP_BRANCH"
echo "✅ Backup created!"
echo ""

# List of secrets to remove
SECRETS=(
    "mridulverma2533@gmail.com"
    "vermamridul641@gmail.com"
    "rbtb kmmo hjdk hbub"
    "yktw lbwo hasg elei"
)

echo "🔒 Removing secrets from all commits..."
echo ""

# Use git filter-branch to rewrite history
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch ecosystem.config.js ecosystem.prod.config.js config.testcredential.js || true' \
  --prune-empty --tag-name-filter cat -- --all

# Clean up refs
echo "🧹 Cleaning up..."
rm -rf .git/refs/original/
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo ""
echo "✅ Git history cleaned!"
echo ""
echo "⚠️  NEXT STEPS:"
echo "1. Force push: git push origin master --force"
echo "2. Revoke old Gmail app passwords IMMEDIATELY"
echo "3. Generate new SMTP credentials"
echo "4. Team must re-clone the repository"
echo ""
