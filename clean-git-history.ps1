# ============================================
# CRITICAL: Git History Cleanup Script
# ============================================
# This script removes sensitive SMTP credentials from entire git history

Write-Host "🚨 GIT HISTORY CLEANUP - SMTP CREDENTIALS" -ForegroundColor Red
Write-Host "=========================================`n" -ForegroundColor Red

# Check if git-filter-repo is installed
$hasFilterRepo = $null -ne (Get-Command git-filter-repo -ErrorAction SilentlyContinue)

if (-not $hasFilterRepo) {
    Write-Host "⚠️  git-filter-repo not found. Installing..." -ForegroundColor Yellow
    Write-Host "Run: pip install git-filter-repo`n" -ForegroundColor Cyan
    Write-Host "OR download from: https://github.com/newren/git-filter-repo`n" -ForegroundColor Cyan
    exit 1
}

# Backup current branch
Write-Host "📦 Creating backup..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
git branch "backup_before_cleanup_$timestamp"
Write-Host "✅ Backup branch created: backup_before_cleanup_$timestamp`n" -ForegroundColor Green

# Create expressions file for git-filter-repo
$expressionsFile = "credentials-to-remove.txt"
$expressions = @(
    "regex:mridulverma2533@gmail.com"
    "regex:vermamridul641@gmail.com"
    "regex:rbtb kmmo hjdk hbub"
    "regex:yktw lbwo hasg elei"
    "regex:EMAIL_USER:\s*`"[^`"]*`""
    "regex:EMAIL_PASS:\s*`"[^`"]*`""
    "regex:SENDER_EMAIL:\s*`"[^`"]*`""
    "regex:SENDER_PASSWORD:\s*`"[^`"]*`""
)

$expressions | Out-File -FilePath $expressionsFile -Encoding utf8

Write-Host "🔍 Scanning repository for exposed credentials..." -ForegroundColor Yellow
Write-Host "This may take a few minutes...`n" -ForegroundColor Yellow

# Run git-filter-repo
git filter-repo --replace-text $expressionsFile --force

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Git history cleaned successfully!" -ForegroundColor Green
    Write-Host "`n⚠️  NEXT STEPS:" -ForegroundColor Yellow
    Write-Host "1. Review the changes: git log --oneline" -ForegroundColor Cyan
    Write-Host "2. Force push to GitHub: git push origin master --force" -ForegroundColor Cyan
    Write-Host "3. Notify team members to re-clone the repository" -ForegroundColor Cyan
    Write-Host "4. Generate NEW SMTP credentials from your email provider" -ForegroundColor Cyan
    Write-Host "5. Update .env file with new credentials`n" -ForegroundColor Cyan
} else {
    Write-Host "`n❌ Error during git history cleanup!" -ForegroundColor Red
    Write-Host "Restore from backup: git checkout backup_before_cleanup_$timestamp" -ForegroundColor Yellow
}

# Cleanup
Remove-Item $expressionsFile -ErrorAction SilentlyContinue

Write-Host "`n⚠️  WARNING: Old credentials are now INVALID and MUST be rotated!" -ForegroundColor Red
