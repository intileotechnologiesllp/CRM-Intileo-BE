# Follower Notification Integration Guide

## Overview
The follower system is now integrated with your existing notification system. When users follow deals, leads, persons, or organizations, they will automatically receive notifications when those entities are updated.

---

## 🔔 How It Works

### 1. **Followers Receive Notifications**
When a user follows an entity (deal, lead, person, organization), they will receive notifications for:

#### **For Deals:**
- ✅ Deal created
- ✅ Deal updated (field changes)
- ✅ Deal stage changed
- ✅ Deal won
- ✅ Deal lost
- ✅ Activities added to deal

#### **For Leads:**
- ✅ Lead updated
- ✅ Lead converted to deal
- ✅ Activities added to lead

#### **For Persons (Contacts):**
- ✅ Contact updated
- ✅ Activities added to contact

#### **For Organizations:**
- ✅ Organization updated
- ✅ Activities added to organization

---

## 📁 Files Modified/Created

### New Files:
1. **`services/notification/followerNotificationService.js`**
   - Main service for sending notifications to followers
   - 10+ notification methods for different entity events
   - Auto-follow functionality

### Modified Files:
1. **`services/notification/notificationTriggers.js`**
   - Integrated follower notifications into existing triggers
   - Added auto-follow on owner assignment

---

## 🎯 Key Features

### 1. **Smart Notification Exclusions**
Followers don't get notified when:
- They are the ones who made the change
- They are the owner of the entity (owner gets separate notification)

### 2. **Auto-Follow on Ownership**
When a user is assigned as the owner of a deal or lead, they automatically become a follower.

### 3. **Bulk Notifications**
Uses `createBulkNotifications` for efficiency when notifying multiple followers at once.

### 4. **Real-time Updates**
Notifications are sent via Socket.IO for instant delivery to online users.

---

## 🔧 API Integration

### Using in Your Controllers

#### Example 1: Notify Followers When Deal is Updated

```javascript
const { NotificationTriggers } = require('../services/notification/notificationTriggers');

// In your deal controller
exports.updateDeal = async (req, res) => {
  try {
    const { dealId } = req.params;
    const updates = req.body;
    
    // Get old deal data
    const oldDeal = await Deal.findByPk(dealId);
    
    // Update deal
    await oldDeal.update(updates);
    
    // Track changes
    const changes = {};
    Object.keys(updates).forEach(key => {
      if (oldDeal[key] !== updates[key]) {
        changes[key] = {
          old: oldDeal[key],
          new: updates[key]
        };
      }
    });
    
    // Send notifications (includes followers automatically)
    await NotificationTriggers.dealUpdated(
      oldDeal,
      { userId: req.userId, name: req.user.name },
      changes
    );
    
    res.json({ success: true, data: oldDeal });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};
```

#### Example 2: Manually Notify Followers

```javascript
const FollowerNotificationService = require('../services/notification/followerNotificationService');

// Notify followers about a custom event
await FollowerNotificationService.notifyFollowersDealStageChanged(
  deal,
  'Proposal Sent', // new stage
  { userId: req.userId, name: req.user.name } // who made the change
);
```

#### Example 3: Auto-Follow When Assigning Owner

```javascript
// This happens automatically in NotificationTriggers.dealAssigned
// But you can call it manually if needed:
await FollowerNotificationService.autoFollowOnOwnerAssignment(
  'deal',      // entityType
  dealId,      // entityId
  newOwnerId,  // userId
  masterUserID // masterUserID
);
```

---

## 📊 Notification Types

All follower notifications use existing notification types from your system:

| Event | Notification Type | Priority |
|-------|------------------|----------|
| Deal Created | `deal_created` | medium |
| Deal Updated | `deal_updated` | low |
| Deal Stage Changed | `deal_stage_changed` | medium |
| Deal Won | `deal_won` | high |
| Deal Lost | `deal_lost` | medium |
| Lead Updated | `lead_updated` | low |
| Lead Converted | `lead_converted` | medium |
| Contact Updated | `contact_updated` | low |
| Organization Updated | `organization_updated` | low |
| Activity Added | `activity_created` | low |

---

## 💡 Usage Examples

### Frontend: Show Follow Status with Notification Badge

```javascript
const DealDetailPage = ({ dealId }) => {
  const [isFollowing, setIsFollowing] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Check if user is following
  useEffect(() => {
    fetch(`/api/followers/deal/${dealId}/check/${currentUserId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setIsFollowing(data.data.isFollowing));
  }, [dealId]);

  return (
    <div>
      <h1>Deal Details</h1>
      
      {/* Follow Button */}
      <button onClick={toggleFollow}>
        {isFollowing ? '🔔 Following' : '🔕 Follow'}
      </button>
      
      {isFollowing && (
        <span className="badge">
          You'll receive notifications for this deal
        </span>
      )}
    </div>
  );
};
```

### Backend: Controller Integration Example

```javascript
// In dealsController.js
const NotificationTriggers = require('../services/notification/notificationTriggers');

exports.updateDeal = async (req, res) => {
  try {
    const deal = await Deal.findByPk(req.params.dealId);
    const oldValues = { ...deal.dataValues };
    
    // Update deal
    await deal.update(req.body);
    
    // Track changes
    const changes = {};
    Object.keys(req.body).forEach(key => {
      if (oldValues[key] !== req.body[key]) {
        changes[key] = { old: oldValues[key], new: req.body[key] };
      }
    });
    
    // This will notify both owner AND followers
    await NotificationTriggers.dealUpdated(
      deal,
      { userId: req.userId, name: req.user.name },
      changes
    );
    
    res.status(200).json({
      statusCode: 200,
      success: true,
      message: 'Deal updated successfully',
      data: deal
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      error: error.message
    });
  }
};
```

---

## 🔐 User Notification Preferences

Users can control which notifications they receive through the existing `NotificationPreference` system:

```javascript
// Users can disable specific notification types
PUT /api/notifications/preferences

{
  "deal_updated": false,      // Don't notify for deal updates
  "deal_won": true,            // Do notify when deals are won
  "deal_stage_changed": true   // Do notify for stage changes
}
```

Even if a user is following an entity, they won't receive notifications if they've disabled that notification type in their preferences.

---

## 📝 Available Methods

### FollowerNotificationService Methods:

```javascript
// Deal notifications
notifyFollowersDealCreated(deal, createdBy)
notifyFollowersDealUpdated(deal, updatedBy, changes)
notifyFollowersDealStageChanged(deal, newStage, changedBy)
notifyFollowersDealWon(deal, wonBy)
notifyFollowersDealLost(deal, lostBy, lostReason)

// Lead notifications
notifyFollowersLeadUpdated(lead, updatedBy, changes)
notifyFollowersLeadConverted(lead, deal, convertedBy)

// Contact notifications
notifyFollowersContactUpdated(person, updatedBy, changes)

// Organization notifications
notifyFollowersOrganizationUpdated(organization, updatedBy, changes)

// Activity notifications
notifyFollowersActivityAdded(activity, entity, entityType, addedBy)

// Utility
autoFollowOnOwnerAssignment(entityType, entityId, userId, masterUserID)
getFollowerUserIds(entityType, entityId, excludeUserIds)
```

---

## 🎨 UI Integration Ideas

### 1. **Follower Count Badge**
```javascript
// Show follower count on entity cards
<div className="deal-card">
  <h3>{deal.dealTitle}</h3>
  <div className="followers">
    <UsersIcon /> {deal.followers_count} followers
  </div>
</div>
```

### 2. **Notification Center Integration**
```javascript
// Group notifications by followed entities
<NotificationList>
  <NotificationGroup title="Deals You Follow">
    <Notification>
      Deal "ABC Corp" moved to Proposal stage
    </Notification>
    <Notification>
      Deal "XYZ Inc" was won! 🎉
    </Notification>
  </NotificationGroup>
</NotificationList>
```

### 3. **Follow Feed/Activity Stream**
```javascript
// Show recent activity on followed entities
<FollowingFeed userId={currentUserId}>
  {followedActivities.map(activity => (
    <ActivityItem>
      <Avatar user={activity.user} />
      <div>
        {activity.user.name} updated {activity.entityType} 
        "{activity.entityName}" - {activity.timeAgo}
      </div>
    </ActivityItem>
  ))}
</FollowingFeed>
```

---

## 🔍 Testing

### Test Notification Flow:

1. **User A** follows Deal #123
2. **User B** updates Deal #123
3. **User A** receives notification:
   - Via Socket.IO (real-time)
   - In notification center
   - Via push notification (if enabled)

### Test Cases:

```bash
# 1. Add follower
POST /api/followers/deal/123
Body: { "userId": 5 }

# 2. Update the deal (as different user)
PUT /api/deals/123
Body: { "dealTitle": "Updated Title" }

# 3. Check notifications for follower
GET /api/notifications?userId=5&isRead=false

# Expected: Notification about deal update
```

---

## 🚀 Performance Considerations

### Optimizations Built-in:

1. **Bulk Notifications**: Uses `createBulkNotifications` instead of individual calls
2. **Smart Exclusions**: Filters out owner and updater to avoid duplicate notifications
3. **Indexed Queries**: Follower lookups use database indexes
4. **Async Operations**: All notification sending is non-blocking

### Monitoring:

```javascript
// Console logs show follower notification activity
✅ Notified 5 followers about deal update
✅ Notified 3 followers about deal won
✅ Auto-followed: User 10 now follows deal 123
```

---

## 📱 Push Notification Support

The system works with your existing push notification setup:

```javascript
// In followerNotificationService.js
// Notifications are created with NotificationService.createBulkNotifications
// Which automatically handles:
// - Real-time Socket.IO events
// - Push notifications (if user has enabled them)
// - In-app notification center storage
```

---

## 🐛 Troubleshooting

### Issue: Followers not receiving notifications

**Check:**
1. User's notification preferences (`NotificationPreference` table)
2. User is actually following the entity (`GET /api/followers/:entityType/:entityId`)
3. Console logs showing "Notified X followers..."

### Issue: Duplicate notifications

**Cause:** User is both owner and follower  
**Solution:** Already handled - followers array excludes owner

### Issue: Too many notifications

**Solution:** Users can:
1. Unfollow entities: `DELETE /api/followers/:entityType/:entityId/:userId`
2. Disable notification types in preferences
3. Adjust notification priority filters

---

## 📊 Database Impact

### Query Efficiency:

```sql
-- Optimized follower lookup (uses index)
SELECT userId FROM Followers
WHERE entityType = 'deal' 
  AND entityId = 123 
  AND userId NOT IN (5, 10);

-- Uses index: idx_entity_followers (entityType, entityId)
```

### Notification Storage:

- Each follower notification is stored in `Notifications` table
- Follows existing notification retention/cleanup policies
- Can be filtered by `entityType` and `entityId`

---

## 🎉 Benefits

✅ **Stay Informed**: Followers never miss important updates  
✅ **Team Collaboration**: Multiple people can track same deals/leads  
✅ **Automatic**: No manual notification setup needed  
✅ **Flexible**: Works with existing notification preferences  
✅ **Real-time**: Instant Socket.IO delivery  
✅ **Efficient**: Bulk operations for performance  
✅ **Smart**: Avoids duplicate notifications  

---

## 📚 Related Documentation

- `FOLLOWER_API_DOCUMENTATION.md` - Complete follower API reference
- `FOLLOWER_SETUP_GUIDE.md` - Initial setup instructions
- `NOTIFICATION_SYSTEM_GUIDE.md` - Existing notification system docs

---

**🎯 You're all set! Followers will now receive relevant notifications automatically.**
