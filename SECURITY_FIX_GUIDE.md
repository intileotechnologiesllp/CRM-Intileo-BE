# 🚨 SMTP CREDENTIALS EXPOSURE - COMPLETE SECURITY FIX GUIDE

## ⚠️ SEVERITY: HIGH - IMMEDIATE ACTION REQUIRED

Your SMTP credentials (`mridulverma2533@gmail.com` and `vermamridul641@gmail.com`) have been exposed in your GitHub repository. This is a **critical security issue**.

---

## ✅ COMPLETED STEPS

- [x] Removed hardcoded SMTP credentials from current files
- [x] Replaced with `process.env` references
- [x] Committed clean config files

---

## 🔴 IMMEDIATE STEPS (DO NOW!)

### Step 1: Clean Git History (Choose ONE method)

#### **Option A: Using BFG Repo-Cleaner (RECOMMENDED - Easier)**

```powershell
# Run the prepared script
.\clean-git-with-bfg.ps1
```

#### **Option B: Using git-filter-repo**

```powershell
# Install git-filter-repo first
pip install git-filter-repo

# Run the cleanup script
.\clean-git-history.ps1
```

#### **Option C: Manual with git filter-branch (Last Resort)**

```bash
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch ecosystem.config.js ecosystem.prod.config.js config.testcredential.js .env" \
  --prune-empty --tag-name-filter cat -- --all

git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

---

### Step 2: Force Push (⚠️ DESTRUCTIVE - Warns Team First!)

```bash
# This REWRITES GitHub history
git push origin master --force
```

**Warning**: All team members MUST delete their local copies and re-clone the repository!

---

### Step 3: REVOKE OLD CREDENTIALS IMMEDIATELY

#### For Gmail App Passwords:

1. Go to: https://myaccount.google.com/apppasswords
2. Find and DELETE these exposed passwords:
   - `rbtb kmmo hjdk hbub`
   - `yktw lbwo hasg elei`
3. Delete them NOW - they're public!

---

### Step 4: Generate NEW SMTP Credentials

#### Gmail:
1. Go to: https://myaccount.google.com/apppasswords
2. Create a new App Password
3. Name it: "CRM App - $(Get-Date -Format 'yyyy-MM-dd')"
4. Copy the generated password

#### Other Email Providers:
- **Outlook**: https://account.microsoft.com/security
- **Yandex**: https://yandex.com/support/id/authorization/app-passwords.html
- **Yahoo**: https://login.yahoo.com/account/security

---

### Step 5: Update .env File (ONLY)

```bash
# Edit .env file with NEW credentials
EMAIL_USER=mridulverma2533@gmail.com
EMAIL_PASS=your_NEW_app_password_here
SENDER_EMAIL=vermamridul641@gmail.com
SENDER_PASSWORD=your_NEW_sender_password_here
```

**NEVER commit .env file!**

---

### Step 6: Verify .gitignore

Ensure .env is ignored:

```bash
# Check if .env is in .gitignore
grep ".env" .gitignore

# If not, add it
echo ".env" >> .gitignore
git add .gitignore
git commit -m "chore: Ensure .env is in .gitignore"
git push
```

---

### Step 7: Deploy to Server

```bash
# SSH into your server
ssh your-server

cd /app/crm-backend/pipedriveCRM

# Pull the cleaned code
git fetch origin
git reset --hard origin/master

# Update .env with NEW credentials
nano .env
# (paste new credentials)

# Restart services
pm2 restart ecosystem.prod.config.js
```

---

## 📋 VERIFICATION CHECKLIST

- [ ] Git history cleaned (no more hardcoded secrets)
- [ ] Force pushed to GitHub
- [ ] Old credentials revoked in Gmail
- [ ] New credentials generated
- [ ] .env updated with NEW credentials
- [ ] .env is in .gitignore
- [ ] Server updated and restarted
- [ ] Old credentials confirmed non-functional
- [ ] New credentials tested and working
- [ ] Team notified to re-clone repository

---

## 🔍 VERIFY CLEANUP

Check if secrets still exist:

```bash
# Search current files
grep -r "rbtb kmmo" .
grep -r "yktw lbwo" .
grep -r "mridulverma2533@gmail.com" . --exclude-dir=node_modules

# Search git history
git log -S"rbtb kmmo" --oneline
git log -S"yktw lbwo" --oneline
```

If any results found, repeat cleanup!

---

## 🚨 WHAT WENT WRONG?

1. **Hardcoded secrets in config files** - Should use `process.env` only
2. **.env file might have been committed** - Should always be in .gitignore
3. **Secrets in git history** - Even deleted files remain in history

---

## 💡 BEST PRACTICES GOING FORWARD

1. **NEVER** commit credentials to git
2. **ALWAYS** use environment variables
3. **KEEP** .env in .gitignore
4. **USE** secrets managers (AWS Secrets Manager, Azure Key Vault, etc.)
5. **ROTATE** credentials regularly
6. **AUDIT** repository regularly for secrets

---

## 📞 NEED HELP?

If you encounter issues:

1. Check if BFG/git-filter-repo is installed properly
2. Ensure you have a backup branch
3. Contact your team lead before force pushing
4. Consider using GitHub's secret scanning resolution tools

---

## 🔗 USEFUL LINKS

- BFG Repo-Cleaner: https://rtyley.github.io/bfg-repo-cleaner/
- git-filter-repo: https://github.com/newren/git-filter-repo
- GitHub Secret Scanning: https://docs.github.com/code-security/secret-scanning
- Gmail App Passwords: https://myaccount.google.com/apppasswords

---

**REMEMBER**: Until old credentials are revoked, your email accounts are at risk!
