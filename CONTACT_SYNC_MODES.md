# Contact Sync Modes

## 🔄 Sync Direction Options

### One-Way Sync (Google → CRM)
**Mode:** `syncMode: "google_to_crm"`

**Behavior:**
- ✅ **Google contacts created** → Created in CRM
  - Person created with all details
  - Organization created if company name exists
  - Person linked to organization
- ✅ **Google contacts updated** → Updated in CRM  
- ✅ **Google contacts deleted** → Deleted in CRM (based on deletionHandling)
- ❌ **CRM contacts created** → NOT synced to Google
- ❌ **CRM contacts updated** → NOT synced to Google
- ❌ **CRM contacts deleted** → NOT synced to Google

**Use Case:** You want Google Contacts to be the single source of truth. CRM is read-only from Google.

---

### One-Way Sync (CRM → Google)
**Mode:** `syncMode: "crm_to_google"`

**Behavior:**
- ✅ **CRM contacts created** → Created in Google
  - Person created in Google Contacts
  - Organization name added to "Company" field
  - No separate organization entity (Google has no organizations)
- ✅ **CRM contacts updated** → Updated in Google
- ✅ **CRM contacts deleted** → Deleted in Google (based on deletionHandling)
- ❌ **Google contacts created** → NOT synced to CRM
- ❌ **Google contacts updated** → NOT synced to CRM
- ❌ **Google contacts deleted** → NOT synced to CRM

**Use Case:** You want CRM to be the single source of truth. Google Contacts is read-only from CRM.

---

### Two-Way Sync (Google ↔ CRM)
**Mode:** `syncDirection: "two_way"` or `syncMode: "bidirectional"`

**Behavior:**
- ✅ **Google contacts created** → Created in CRM
- ✅ **Google contacts updated** → Updated in CRM
- ✅ **Google contacts deleted** → Deleted in CRM (based on deletionHandling)
- ✅ **CRM contacts created** → Created in Google
- ✅ **CRM contacts updated** → Updated in Google
- ✅ **CRM contacts deleted** → Deleted in Google (based on deletionHandling)

**Conflict Resolution:** When both are updated, uses `conflictResolution` setting:
- `newest_wins` - Most recently updated version wins
- `google_wins` - Always prefer Google version
- `crm_wins` - Always prefer CRM version

**Use Case:** You want to keep Google and CRM perfectly in sync. Changes in either system are reflected in the other.

---

## ⚙️ How to Configure

### Set Sync Direction via API

**One-Way Sync (Google → CRM):**
```http
POST http://localhost:3056/api/contact-sync/config
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "syncMode": "google_to_crm"
}
```

**One-Way Sync (CRM → Google):**
```http
POST http://localhost:3056/api/contact-sync/config
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "syncMode": "crm_to_google"
}
```

**Two-Way Sync (Google ↔ CRM):**
```http
POST http://localhost:3056/api/contact-sync/config
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "syncMode": "bidirectional"
}
```

### Check Current Configuration
```http
GET http://localhost:3056/api/contact-sync/config
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "success": true,
  "syncConfig": {
    "syncConfigId": 1,
    "syncDirection": "one_way",
    "syncMode": "google_to_crm",
    "isActive": true,
    "autoSyncEnabled": false,
    "conflictResolution": "newest_wins",
    "deletionHandling": "soft_delete"
  }
}
```

---

## 🗑️ Deletion Handling Options

Works with both one-way and two-way sync:

### `soft_delete`
- Contacts are marked as deleted but not removed from database
- Can be recovered later

### `hard_delete`  
- Contacts are permanently deleted from database
- Cannot be recovered

### `skip`
- Deletions are NOT synced
- Contact remains in the system even if deleted in the source

**Set Deletion Handling:**
```json
{
  "deletionHandling": "soft_delete"
}
```

---

## 📊 Sync Process Flow

### One-Way (Google → CRM)
```
1. Fetch contacts from Google
2. Fetch contacts from CRM
3. Compare mappings
4. For each Google contact:
   - If new → Create in CRM
   - If exists → Check for updates → Update in CRM if needed
   - If deleted in Google → Delete in CRM (based on deletionHandling)
5. CRM-only contacts are IGNORED (not synced back)
```

### Two-Way (Google ↔ CRM)
```
1. Fetch contacts from Google
2. Fetch contacts from CRM
3. Compare mappings
4. For each Google contact:
   - If new → Create in CRM
   - If exists → Check for updates → Resolve conflicts → Sync winner
   - If deleted in Google → Delete in CRM (based on deletionHandling)
5. For each CRM contact:
   - If new → Create in Google
   - If exists → Check for updates → Resolve conflicts → Sync winner
   - If deleted in CRM → Delete in Google (based on deletionHandling)
```

---

## 🧪 Testing Sync Modes

### Test One-Way Sync

1. **Configure one-way:**
   ```json
   { "syncDirection": "one_way" }
   ```

2. **Create contact in Google** → Should appear in CRM
3. **Update contact in Google** → Should update in CRM
4. **Create contact in CRM** → Should NOT appear in Google
5. **Update CRM contact** → Should NOT update in Google

### Test Two-Way Sync

1. **Configure two-way:**
   ```json
   { "syncDirection": "two_way" }
   ```

2. **Create contact in Google** → Should appear in CRM
3. **Create contact in CRM** → Should appear in Google
4. **Update in either system** → Should sync to both

---

## 🔐 Current Default

When you connect your Google account, the default configuration is:
```json
{
  "syncDirection": "two_way",
  "syncMode": "bidirectional",
  "conflictResolution": "newest_wins",
  "deletionHandling": "soft_delete"
}
```

You can change this anytime using the config API endpoint!
