# 🔔 Notification Triggers - Integration Guide

## ❌ Current Status: NOT INTEGRATED

The notification triggers are **NOT automatically running** yet. You need to manually add them to your existing controllers.

---

## 📋 What Needs to Be Done

### **Files to Modify:**
1. ✅ `controllers/dealController.js` - Add deal notification triggers
2. ✅ `controllers/activity/activityController.js` - Add activity triggers  
3. ✅ `controllers/lead/leadController.js` - Add lead triggers

---

## 🔧 Step 1: Add Import Statement

At the **TOP of each controller file**, add this line:

```javascript
const NotificationTriggers = require('../services/notification/notificationTriggers');
// Or if in subfolder: require('../../services/notification/notificationTriggers')
```

---

## 🎯 Step 2: Add Trigger Calls

### **A. Deal Controller (`controllers/dealController.js`)**

#### **1. After Creating a Deal** (Line ~165, after transaction.commit())

```javascript
// Commit the transaction
await transaction.commit();

// 🔔 SEND NOTIFICATION - Deal Created
try {
  const ownerId = deal.ownerId || masterUserID;
  await NotificationTriggers.dealCreated(
    deal.dealId,      // dealId
    ownerId,          // User who owns the deal
    masterUserID      // User who created it
  );
} catch (notifError) {
  console.error('Failed to send deal created notification:', notifError);
  // Don't fail the request if notification fails
}

// Log the creation
await historyLogger(...);
```

#### **2. After Updating a Deal** (In updateDeal function, after deal.save())

```javascript
// Save the updated deal
await deal.save({ transaction });

// 🔔 SEND NOTIFICATION - Deal Updated
try {
  // Check if owner changed (deal assigned to someone else)
  if (req.body.customFields?.ownerId && 
      req.body.customFields.ownerId !== deal.ownerId) {
    await NotificationTriggers.dealAssigned(
      deal.dealId,
      req.body.customFields.ownerId,  // New owner
      masterUserID                     // Who assigned it
    );
  }
  
  // Check if status changed to won
  if (req.body.customFields?.status === 'won' && deal.status !== 'won') {
    await NotificationTriggers.dealWon(
      deal.dealId,
      deal.ownerId,
      masterUserID
    );
  }
  
  // Check if status changed to lost
  if (req.body.customFields?.status === 'lost' && deal.status !== 'lost') {
    await NotificationTriggers.dealLost(
      deal.dealId,
      deal.ownerId,
      masterUserID
    );
  }
} catch (notifError) {
  console.error('Failed to send deal notification:', notifError);
}

await transaction.commit();
```

---

### **B. Activity Controller (`controllers/activity/activityController.js`)**

Find your **createActivity** function and add:

```javascript
// After activity is created
const activity = await Activity.create(activityData);

// 🔔 SEND NOTIFICATION - Activity Created
try {
  await NotificationTriggers.activityCreated(
    activity.activityId,
    activity.assignedTo,   // User assigned to activity
    req.adminId            // User who created it
  );
} catch (notifError) {
  console.error('Failed to send activity notification:', notifError);
}

res.status(201).json({ message: 'Activity created', activity });
```

Find your **updateActivity** function and add:

```javascript
// After updating activity
await activity.save();

// 🔔 SEND NOTIFICATION - Activity Assigned (if assignee changed)
try {
  if (req.body.assignedTo && req.body.assignedTo !== activity.assignedTo) {
    await NotificationTriggers.activityAssigned(
      activity.activityId,
      req.body.assignedTo,  // New assignee
      req.adminId           // Who reassigned it
    );
  }
} catch (notifError) {
  console.error('Failed to send activity notification:', notifError);
}

res.json({ message: 'Activity updated', activity });
```

---

### **C. Lead Controller (`controllers/lead/leadController.js`)**

Similar to deal controller:

```javascript
// After creating lead
const lead = await Lead.create(leadData);

// 🔔 SEND NOTIFICATION - Lead Created
try {
  await NotificationTriggers.leadCreated(
    lead.leadId,
    lead.ownerId || req.adminId,
    req.adminId
  );
} catch (notifError) {
  console.error('Failed to send lead notification:', notifError);
}
```

---

## ⚡ Quick Implementation Example

Here's a **complete example** for dealController.js:

```javascript
// At the top of the file
const NotificationTriggers = require('../services/notification/notificationTriggers');

// In createDeal function
exports.createDeal = async (req, res) => {
  try {
    const transaction = await sequelize.transaction();
    
    try {
      // ... existing code to create deal ...
      const deal = await Deal.create(dealData, { transaction });
      
      // ... custom fields processing ...
      
      await transaction.commit();
      
      // 🔔 ADD THIS - Send notification
      try {
        await NotificationTriggers.dealCreated(
          deal.dealId,
          deal.ownerId || masterUserID,
          masterUserID
        );
      } catch (notifError) {
        console.error('Notification failed:', notifError);
      }
      
      // ... rest of the code ...
      res.status(201).json({ message: 'Deal created', dealId: deal.dealId });
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

---

## 🧪 Testing After Integration

### **1. Create a Deal**
```bash
POST /api/deals
```
**Expected:** 
- ✅ Deal created in database
- ✅ Notification saved in Notifications table
- ✅ Socket.IO sends real-time notification to assigned user
- ✅ User sees notification in browser

### **2. Assign Deal to Another User**
```bash
PUT /api/deals/:id
Body: { ownerId: 72 }  # Different user
```
**Expected:**
- ✅ User 72 receives "Deal Assigned" notification instantly

### **3. Mark Deal as Won**
```bash
PUT /api/deals/:id
Body: { status: 'won' }
```
**Expected:**
- ✅ Owner receives "Deal Won" notification

---

## ✅ Verification Checklist

After adding triggers, verify:

- [ ] Added `NotificationTriggers` import to controller
- [ ] Added trigger call after deal creation
- [ ] Added trigger call after deal assignment
- [ ] Added trigger call for deal won/lost
- [ ] Wrapped trigger calls in try-catch (so they don't break main flow)
- [ ] Tested creating a deal → notification appears
- [ ] Tested assigning deal → notification appears
- [ ] Checked database → notifications saved in Notifications table
- [ ] Checked browser → Socket.IO delivers notification in real-time

---

## 🎯 Summary

**Current Status:**
- ❌ Triggers exist but are NOT called from your APIs
- ❌ No automatic notifications happen when you create/update deals

**What You Need to Do:**
1. Add import: `const NotificationTriggers = require(...)`
2. Add trigger calls after deal/activity/lead operations
3. Test to verify notifications work

**Do you want me to:**
- ✅ Add these triggers to your dealController.js for you?
- ✅ Add triggers to activity controller?
- ✅ Add triggers to lead controller?

Just let me know and I'll modify the files! 🚀
