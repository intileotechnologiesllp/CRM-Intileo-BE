# ============================================
# ALTERNATIVE: BFG Repo-Cleaner Method
# ============================================
# This is easier and faster than git-filter-repo

Write-Host "🚨 CLEANING GIT HISTORY WITH BFG REPO-CLEANER" -ForegroundColor Red
Write-Host "===============================================`n" -ForegroundColor Red

# Check if BFG is available
$bfgJar = "bfg.jar"
if (-not (Test-Path $bfgJar)) {
    Write-Host "⚠️  BFG Repo-Cleaner not found!" -ForegroundColor Yellow
    Write-Host "`nDownload it from: https://rtyley.github.io/bfg-repo-cleaner/`n" -ForegroundColor Cyan
    Write-Host "Then run: Invoke-WebRequest -Uri 'https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar' -OutFile 'bfg.jar'`n" -ForegroundColor Cyan
    
    $download = Read-Host "Download BFG now? (Y/N)"
    if ($download -eq 'Y' -or $download -eq 'y') {
        Write-Host "Downloading BFG..." -ForegroundColor Yellow
        Invoke-WebRequest -Uri 'https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar' -OutFile 'bfg.jar'
        Write-Host "✅ BFG downloaded!`n" -ForegroundColor Green
    } else {
        exit 1
    }
}

# Create replacements file
$replacementsFile = "smtp-secrets.txt"
$replacements = @(
    "mridulverma2533@gmail.com===>***EMAIL_REMOVED***"
    "vermamridul641@gmail.com===>***EMAIL_REMOVED***"
    "rbtb kmmo hjdk hbub===>***PASSWORD_REMOVED***"
    "yktw lbwo hasg elei===>***PASSWORD_REMOVED***"
)

$replacements | Out-File -FilePath $replacementsFile -Encoding utf8

Write-Host "📦 Creating backup branch..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
git branch "backup_before_bfg_$timestamp"
Write-Host "✅ Backup created: backup_before_bfg_$timestamp`n" -ForegroundColor Green

Write-Host "🔒 Removing secrets from git history..." -ForegroundColor Yellow
Write-Host "This will scan ALL commits and remove the secrets`n" -ForegroundColor Yellow

# Run BFG
java -jar bfg.jar --replace-text $replacementsFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n🧹 Cleaning up repository..." -ForegroundColor Yellow
    git reflog expire --expire=now --all
    git gc --prune=now --aggressive

    Write-Host "`n✅ Git history cleaned successfully!`n" -ForegroundColor Green
    
    Write-Host "⚠️  CRITICAL NEXT STEPS:" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "1. Review changes: git log --all --oneline" -ForegroundColor Cyan
    Write-Host "2. FORCE PUSH to GitHub:" -ForegroundColor Yellow
    Write-Host "   git push origin master --force`n" -ForegroundColor Cyan
    Write-Host "3. IMMEDIATELY revoke old SMTP credentials:" -ForegroundColor Yellow
    Write-Host "   - Gmail: https://myaccount.google.com/apppasswords" -ForegroundColor Cyan
    Write-Host "   - Delete the exposed app passwords`n" -ForegroundColor Cyan
    Write-Host "4. Generate NEW SMTP credentials" -ForegroundColor Yellow
    Write-Host "5. Update .env file ONLY (never commit it)`n" -ForegroundColor Cyan
    Write-Host "6. Notify team to re-clone:" -ForegroundColor Yellow
    Write-Host "   git clone https://github.com/intileotechnologiesllp/CRM-Intileo-BE.git`n" -ForegroundColor Cyan
    
} else {
    Write-Host "`n❌ BFG cleaning failed!" -ForegroundColor Red
    Write-Host "Restore backup: git checkout backup_before_bfg_$timestamp" -ForegroundColor Yellow
}

# Cleanup
Remove-Item $replacementsFile -ErrorAction SilentlyContinue
