# Contact Sync Testing Guide

## ✅ What's Been Implemented

Your Google Contact Sync is now fully ready! Here's what was fixed:

### 1. **OAuth Configuration Fixed**
- ✅ Fixed `.env` file: `GOOGLE_REDIRECT_URI` was incorrectly named as duplicate `GOOGLE_CLIENT_SECRET`
- ✅ Redirect URI now correctly set to: `http://localhost:3056/api/contact-sync/oauth/google/callback`

### 2. **Multiple Emails & Phones Support**
- ✅ Google contacts now sync ALL emails and phones (not just primary)
- ✅ Emails array format: `[{ email: "test@email.com", type: "Work", isPrimary: true }]`
- ✅ Phones array format: `[{ phone: "1234567890", type: "Mobile", isPrimary: false }]`

### 3. **CRM Integration**
- ✅ Contact sync creates persons using your existing `Person` model
- ✅ Automatically sets `ownerId` to the syncing user
- ✅ Supports all standard fields: name, email, phone, organization, jobTitle, notes, address

---

## 🧪 How to Test the Contact Sync

### Step 1: Restart Your Server
**IMPORTANT:** You must restart your server for the `.env` changes to take effect.

```powershell
# Press Ctrl+C in the terminal to stop the server
# Then restart:
npm start
```

### Step 2: Connect Google Account (Already Done ✅)
You've already successfully connected your Google account (vermamridul641@gmail.com). You saw this success page, which means OAuth is working!

### Step 3: Trigger Contact Sync

Make a POST request to start the sync:

**Endpoint:**
```
POST http://localhost:3056/api/contact-sync/start
```

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Contact sync started. This may take a few minutes.",
  "syncConfigId": 1
}
```

### Step 4: Check Sync Progress

Get sync history:
```
GET http://localhost:3056/api/contact-sync/history
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "success": true,
  "history": [
    {
      "syncHistoryId": 1,
      "status": "completed", // or "in_progress", "failed"
      "createdInCRM": 25,
      "updatedInCRM": 5,
      "duration": 45,
      "startedAt": "2025-11-19T...",
      "completedAt": "2025-11-19T...",
      "summary": "Sync completed successfully"
    }
  ]
}
```

### Step 5: Verify Contacts in CRM

Check if contacts were created:
```
GET http://localhost:3056/api/lead-contact/get-persons
Authorization: Bearer YOUR_JWT_TOKEN
```

You should see all your Google contacts now in the CRM!

---

## 📊 What Happens During Sync

### Google → CRM (Your Current Setup)

1. **Fetches all contacts** from Google (using People API)
2. **Normalizes data** to CRM format with all emails/phones
3. **Creates new persons** in CRM for contacts that don't exist
4. **Updates existing persons** if they've changed in Google
5. **Logs all changes** in `ContactChangeLog` table

### Data Mapping

| Google Field | CRM Field | Notes |
|--------------|-----------|-------|
| Display Name | contactPerson | Full name |
| Email Addresses (array) | emails | All emails synced |
| Phone Numbers (array) | phones | All phones synced |
| Primary Email | email | Main email field |
| Primary Phone | phone | Main phone field |
| Organization | organization | Company name |
| Job Title | jobTitle | Position |
| Biography | notes | Notes/description |
| Address | postalAddress | Full address |

---

## 🔍 Monitoring & Debugging

### View Sync Statistics
```
GET http://localhost:3056/api/contact-sync/stats
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "syncConfig": {
      "isActive": true,
      "syncMode": "bidirectional",
      "lastSyncAt": "2025-11-19T...",
      "autoSyncEnabled": false
    },
    "overview": {
      "totalSyncs": 3,
      "completedSyncs": 3,
      "failedSyncs": 0,
      "successRate": 100
    },
    "operations": {
      "totalCreated": 25,
      "totalUpdated": 5,
      "totalDeleted": 0,
      "totalConflicts": 2
    }
  }
}
```

### View Change Logs for Specific Contact
```
GET http://localhost:3056/api/contact-sync/contact/{personId}/changes
Authorization: Bearer YOUR_JWT_TOKEN
```

### View Detailed Sync History
```
GET http://localhost:3056/api/contact-sync/history/{syncHistoryId}
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## 🎯 Expected Results

After running the sync, you should see:

1. ✅ All your Google contacts appear in CRM as "Persons"
2. ✅ Each contact has ALL their emails and phones (not just primary)
3. ✅ Organization names are included
4. ✅ Job titles are synced
5. ✅ Contact notes/biographies are preserved
6. ✅ Postal addresses are formatted correctly

---

## ⚙️ Configuration Options

### Sync Mode (Current: `bidirectional`)
- `bidirectional`: Syncs both ways (Google ↔️ CRM)
- `google_to_crm`: Only Google → CRM
- `crm_to_google`: Only CRM → Google

### Conflict Resolution (Current: `newest_wins`)
- `newest_wins`: Most recently updated contact wins
- `google_wins`: Always prefer Google data
- `crm_wins`: Always prefer CRM data

### To Change Configuration:
```
POST http://localhost:3056/api/contact-sync/config
Authorization: Bearer YOUR_JWT_TOKEN

{
  "syncMode": "bidirectional",
  "conflictResolution": "newest_wins",
  "autoSyncEnabled": false,
  "syncFrequency": 60
}
```

---

## 🚨 Troubleshooting

### If Sync Fails:
1. Check sync history for error details:
   ```
   GET /api/contact-sync/history
   ```

2. Check server console logs for detailed errors

3. Common issues:
   - **Token expired**: Reconnect Google account
   - **Duplicate contacts**: Sync service handles this automatically
   - **Missing required fields**: Contact must have at least name and one email

### If No Contacts Appear:
1. Verify Google account has contacts
2. Check sync history status
3. Verify JWT token is valid
4. Check database `leadpersons` table directly

---

## 🎉 Next Steps

Once sync is working:

1. **Enable Auto-Sync** (optional)
   - Set `autoSyncEnabled: true` in config
   - Set `syncFrequency` in minutes (e.g., 60 = hourly)

2. **Test Bidirectional Sync**
   - Create a contact in CRM
   - Trigger sync
   - Verify it appears in Google Contacts

3. **Test Conflict Resolution**
   - Update a contact in both Google and CRM
   - Trigger sync
   - Check which version wins based on your config

---

## 📝 API Endpoints Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/contact-sync/oauth/google/authorize` | Get OAuth URL |
| GET | `/api/contact-sync/oauth/google/callback` | OAuth callback (auto) |
| POST | `/api/contact-sync/start` | **Start sync** |
| GET | `/api/contact-sync/stats` | View statistics |
| GET | `/api/contact-sync/history` | Sync history |
| GET | `/api/contact-sync/config` | Get configuration |
| POST | `/api/contact-sync/config` | Update configuration |
| DELETE | `/api/contact-sync/config/disconnect` | Disconnect Google |

---

## ✅ Ready to Sync!

Your contact sync is fully configured and ready to use. Just:

1. **Restart your server** (if not done already)
2. **Call the `/start` endpoint**
3. **Watch your Google contacts appear in CRM!**

Good luck! 🚀
