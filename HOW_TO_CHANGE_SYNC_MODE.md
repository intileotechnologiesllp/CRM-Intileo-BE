# How to Change Sync Mode

## 📝 Update Sync Configuration API

### Endpoint
```
POST http://localhost:3056/api/contact-sync/config
```

### Headers
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

## 🔄 Change to One-Way Sync

### Request Body
```json
{
  "syncDirection": "one_way",
  "syncMode": "google_to_crm"
}
```

### Expected Response
```json
{
  "success": true,
  "message": "Sync configuration updated successfully",
  "syncConfig": {
    "syncConfigId": 1,
    "masterUserID": 32,
    "provider": "google",
    "syncMode": "google_to_crm",
    "syncDirection": "one_way",
    "isActive": true,
    "autoSyncEnabled": false,
    "syncFrequency": 60,
    "lastSyncAt": "2025-11-19T11:22:20.000Z",
    "nextSyncAt": null,
    "googleEmail": "vermamridul641@gmail.com",
    "conflictResolution": "newest_wins",
    "deletionHandling": "soft_delete"
  }
}
```

## ↔️ Change Back to Two-Way Sync

### Request Body
```json
{
  "syncDirection": "two_way",
  "syncMode": "bidirectional"
}
```

## ✅ Verify Configuration

After updating, verify the change:

```
GET http://localhost:3056/api/contact-sync/config
Authorization: Bearer YOUR_JWT_TOKEN
```

## 🧪 Test the New Mode

### For One-Way Sync Test:
1. Update config to one-way
2. Run sync:
   ```
   POST http://localhost:3056/api/contact-sync/start
   Authorization: Bearer YOUR_JWT_TOKEN
   ```
3. Check console logs - you should see:
   ```
   🔄 [CONTACT SYNC] Sync Mode: ONE-WAY (Google → CRM)
   ➡️ [ONE-WAY SYNC] Starting one-way sync (Google → CRM)...
   ```

### For Two-Way Sync Test:
1. Update config to two-way
2. Run sync
3. Check console logs - you should see:
   ```
   🔄 [CONTACT SYNC] Sync Mode: TWO-WAY (Google ↔ CRM)
   🔄 [TWO-WAY SYNC] Starting bidirectional sync...
   ```

## 📊 What Happens After Change

When you change from **two-way** to **one-way**:
- ✅ Next sync will only sync Google → CRM
- ✅ CRM contacts will NOT be synced to Google
- ✅ Existing mappings remain intact
- ✅ No data is deleted

When you change from **one-way** to **two-way**:
- ✅ Next sync will sync both directions
- ✅ CRM-only contacts will be created in Google
- ✅ Both systems will be kept in sync

## 🔍 Check Sync History

After running sync with the new mode:

```
GET http://localhost:3056/api/contact-sync/history
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response will show:**
```json
{
  "history": [
    {
      "syncHistoryId": 2,
      "syncDirection": "one_way (Google → CRM)",  // or "two_way (Google ↔ CRM)"
      "status": "completed",
      "createdInCRM": 5,
      "updatedInCRM": 3,
      "createdInGoogle": 0,  // Will be 0 in one-way mode
      "updatedInGoogle": 0   // Will be 0 in one-way mode
    }
  ]
}
```

## 💡 Tips

1. **Update mode BEFORE running sync** - Mode change takes effect on next sync
2. **Check console logs** - They show which mode is active
3. **Review sync history** - Confirms which direction was used
4. **Test with small changes** - Create one test contact to verify behavior

## ⚠️ Important Notes

- Mode change is instant - no server restart needed
- Existing synced contacts are not affected
- Only new/updated contacts follow the new mode
- You can switch back and forth anytime
