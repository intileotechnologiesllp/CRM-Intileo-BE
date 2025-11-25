## 🔧 Google Workspace Email Setup Guide

If you're getting "Connection ended unexpectedly" errors with your custom domain email (like `@earthood.in`), here's how to fix it:

### ✅ **For Google Workspace Users**

Your domain `earthood.in` likely uses Google Workspace (formerly G Suite). Follow these steps:

#### **Step 1: Enable 2-Factor Authentication**
1. Go to [myaccount.google.com](https://myaccount.google.com)
2. Click "Security" → "2-Step Verification"
3. Follow the setup process

#### **Step 2: Generate App Password**
1. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. Select app: "Mail"
3. Select device: "Windows Computer" (or your device)
4. Click "Generate"
5. **Copy the 16-character password** (e.g., `abcd efgh ijkl mnop`)

#### **Step 3: Enable IMAP in Gmail**
1. Open Gmail → Settings (gear icon) → "See all settings"
2. Go to "Forwarding and POP/IMAP" tab
3. Enable "IMAP access"
4. Click "Save Changes"

#### **Step 4: Update Credentials**
Use these settings in the system:
- **Email**: `your-email@earthood.in`
- **Provider**: Gmail
- **App Password**: The 16-character password from Step 2
- **IMAP Settings**: 
  - Host: `imap.gmail.com`
  - Port: `993`
  - Encryption: TLS/SSL

### 🚨 **Common Issues**

- **Old App Password**: Generate a NEW one if existing doesn't work
- **Wrong Provider**: Use "Gmail" for Google Workspace domains
- **IMAP Disabled**: Must be enabled in Gmail settings
- **Regular Password**: Must use APP password, not your login password

### 📞 **Still Having Issues?**

Contact your IT admin to ensure:
1. IMAP is allowed for your domain
2. Less secure app access is enabled (if required)
3. Your account has the necessary permissions