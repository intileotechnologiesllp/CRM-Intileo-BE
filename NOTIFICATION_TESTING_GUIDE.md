# 🧪 Notification System Testing Guide

## Quick Test Commands

### 1️⃣ Test Deal Notifications

#### Create a Deal (should trigger `deal_created`)
```bash
curl -X POST http://213.136.77.55:4001/api/deals \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "Test Deal - Notification Test",
    "value": 50000,
    "ownerId": YOUR_USER_ID,
    "status": "open"
  }'
```

**Check Notification:**
```sql
SELECT * FROM Notifications 
WHERE type = 'deal_created' 
ORDER BY createdAt DESC LIMIT 1;
```

#### Assign a Deal (should trigger `deal_assigned`)
```bash
curl -X PUT http://213.136.77.55:4001/api/deals/DEAL_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "ownerId": NEW_USER_ID
  }'
```

**Check Notification:**
```sql
SELECT * FROM Notifications 
WHERE type = 'deal_assigned' AND entityId = DEAL_ID
ORDER BY createdAt DESC LIMIT 1;
```

#### Mark Deal as Won (should trigger `deal_won`)
```bash
curl -X PUT http://213.136.77.55:4001/api/deals/DEAL_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "status": "won"
  }'
```

#### Mark Deal as Lost (should trigger `deal_lost`)
```bash
curl -X PUT http://213.136.77.55:4001/api/deals/DEAL_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "status": "lost"
  }'
```

---

### 2️⃣ Test Activity Notifications

#### Create an Activity (should trigger `activity_created`)
```bash
curl -X POST http://213.136.77.55:4001/api/activities \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "type": "meeting",
    "subject": "Test Activity - Notification Test",
    "assignedTo": USER_ID,
    "startDateTime": "2024-01-20T10:00:00Z",
    "endDateTime": "2024-01-20T11:00:00Z"
  }'
```

**Check Notification:**
```sql
SELECT * FROM Notifications 
WHERE type = 'activity_created' 
ORDER BY createdAt DESC LIMIT 1;
```

#### Assign Activity to Someone (should trigger `activity_assigned`)
```bash
curl -X PUT http://213.136.77.55:4001/api/activities/ACTIVITY_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "assignedTo": NEW_USER_ID
  }'
```

**Check Notification:**
```sql
SELECT * FROM Notifications 
WHERE type = 'activity_assigned' AND entityId = ACTIVITY_ID
ORDER BY createdAt DESC LIMIT 1;
```

---

### 3️⃣ Test Lead Notifications

#### Create a Lead (should trigger `lead_created`)
```bash
curl -X POST http://213.136.77.55:4001/api/leads \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "Test Lead - Notification Test",
    "contactPerson": "John Doe",
    "organization": "Test Company",
    "email": "john@testcompany.com",
    "ownerId": YOUR_USER_ID
  }'
```

**Check Notification:**
```sql
SELECT * FROM Notifications 
WHERE type = 'lead_created' 
ORDER BY createdAt DESC LIMIT 1;
```

#### Assign a Lead (should trigger `lead_assigned`)
```bash
curl -X PUT http://213.136.77.55:4001/api/leads/LEAD_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "ownerId": NEW_USER_ID
  }'
```

**Check Notification:**
```sql
SELECT * FROM Notifications 
WHERE type = 'lead_assigned' AND entityId = LEAD_ID
ORDER BY createdAt DESC LIMIT 1;
```

---

## 📊 Database Verification Queries

### Check All Recent Notifications
```sql
SELECT 
  n.notificationId,
  n.type,
  n.entityType,
  n.entityId,
  n.title,
  n.message,
  n.isRead,
  n.userId,
  u.name AS recipientName,
  n.createdAt
FROM Notifications n
LEFT JOIN MasterUsers u ON n.userId = u.masterUserID
ORDER BY n.createdAt DESC
LIMIT 20;
```

### Check Notifications for Specific User
```sql
SELECT 
  type,
  title,
  message,
  entityType,
  entityId,
  isRead,
  createdAt
FROM Notifications
WHERE userId = YOUR_USER_ID
ORDER BY createdAt DESC;
```

### Count Notifications by Type
```sql
SELECT 
  type,
  COUNT(*) as count,
  SUM(CASE WHEN isRead = 0 THEN 1 ELSE 0 END) as unread_count
FROM Notifications
GROUP BY type
ORDER BY count DESC;
```

### Check User Notification Preferences
```sql
SELECT * FROM NotificationPreferences 
WHERE userId = YOUR_USER_ID;
```

---

## 🔌 Socket.IO Testing (Browser Console)

### 1. Connect to Socket.IO
```javascript
const socket = io('http://213.136.77.55:4001', {
  auth: {
    token: 'YOUR_JWT_TOKEN'
  }
});

socket.on('connect', () => {
  console.log('✅ Connected to Socket.IO');
  console.log('Socket ID:', socket.id);
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from Socket.IO');
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
});
```

### 2. Listen for Notifications
```javascript
socket.on('notification', (notification) => {
  console.log('🔔 New Notification:', notification);
  console.log('Type:', notification.type);
  console.log('Title:', notification.title);
  console.log('Message:', notification.message);
  console.log('Entity:', notification.entityType, notification.entityId);
});

socket.on('notification_marked_read', (data) => {
  console.log('✓ Notification marked as read:', data.notificationId);
});

socket.on('all_notifications_marked_read', () => {
  console.log('✓ All notifications marked as read');
});
```

### 3. Test Real-Time Updates
After connecting Socket.IO in browser console, perform one of the API calls above (create deal, assign activity, etc.) and you should see the notification event logged in the console immediately.

---

## ✅ Expected Results Checklist

### Deal Notifications
- [ ] Creating a deal → `deal_created` notification sent to owner
- [ ] Changing deal owner → `deal_assigned` notification sent to new owner
- [ ] Marking deal as won → `deal_won` notification sent to owner
- [ ] Marking deal as lost → `deal_lost` notification sent to owner

### Activity Notifications
- [ ] Creating an activity → `activity_created` notification sent to assignee
- [ ] Changing activity assignee → `activity_assigned` notification sent to new assignee

### Lead Notifications
- [ ] Creating a lead → `lead_created` notification sent to owner
- [ ] Changing lead owner → `lead_assigned` notification sent to new owner

### Real-Time Delivery
- [ ] Socket.IO connects successfully
- [ ] Notifications appear in browser console immediately
- [ ] Database records created for all notifications
- [ ] User preferences respected (if disabled, no notification)

---

## 🐛 Troubleshooting

### Issue: No Notification Created in Database
**Check:**
1. Server logs for errors: `Failed to send notification:`
2. User exists: `SELECT * FROM MasterUsers WHERE masterUserID = USER_ID`
3. Notification service is working: Test directly
   ```javascript
   const NotificationService = require('./services/notification/notificationService');
   await NotificationService.createNotification({
     userId: 1,
     type: 'test',
     title: 'Test Notification',
     message: 'Testing notification system'
   });
   ```

### Issue: Notification Created but Not Received via Socket.IO
**Check:**
1. User is connected: Check server logs for "User X connected"
2. User room exists: User should be in room `user_${userId}`
3. Socket.IO is initialized: Check for "✅ Socket.IO initialized"
4. Browser console: Any connection errors?

### Issue: Duplicate Notifications
**Cause:** Trigger called multiple times
**Fix:** Ensure each trigger is only called once per action

### Issue: Wrong User Receiving Notification
**Check:**
1. userId parameter in trigger call
2. Database record: `SELECT userId FROM Notifications WHERE notificationId = X`
3. Entity ownership: Verify ownerId/assignedTo fields

---

## 📝 Manual Testing Script (Copy-Paste)

```sql
-- 1. Check if notification tables exist
SHOW TABLES LIKE 'Notification%';

-- 2. Count total notifications
SELECT COUNT(*) as total_notifications FROM Notifications;

-- 3. Check recent notifications
SELECT type, title, message, createdAt 
FROM Notifications 
ORDER BY createdAt DESC 
LIMIT 5;

-- 4. Check unread notifications for user 1
SELECT type, title, message 
FROM Notifications 
WHERE userId = 1 AND isRead = 0;

-- 5. Check notification preferences
SELECT * FROM NotificationPreferences LIMIT 5;

-- 6. Verify user preferences for deals
SELECT userId, dealCreated, dealAssigned, dealWon, dealLost
FROM NotificationPreferences;
```

---

## 🎯 Success Metrics

After testing all scenarios, you should have:

1. **Database Records**: Multiple notifications in `Notifications` table
2. **Socket.IO Events**: Console logs showing real-time delivery
3. **No Errors**: Server logs clean, no "Failed to send notification" errors
4. **Correct Recipients**: Each notification sent to the right user
5. **Preferences Respected**: Disabled notification types are not sent

---

## 🔄 Next Steps

1. ✅ Backend Integration Complete
2. ⏳ Frontend UI Implementation
3. ⏳ User Acceptance Testing
4. ⏳ Production Deployment

**Frontend Task**: Implement notification UI component using `NOTIFICATION_FRONTEND_EXAMPLE.jsx` and connect Socket.IO client.

---

## 📚 Related Files
- `NOTIFICATION_TRIGGERS_INTEGRATION_COMPLETE.md` - Integration summary
- `NOTIFICATION_API_DOCUMENTATION.md` - API endpoints
- `NOTIFICATION_FRONTEND_EXAMPLE.jsx` - React component
- `public/notification-test.html` - Browser test interface

**Last Updated**: $(date)
