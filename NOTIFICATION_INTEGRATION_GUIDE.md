# 🚀 Quick Integration Guide - Adding Notifications to Your Features

This guide shows you exactly where and how to add notification triggers in your existing CRM code.

---

## 📍 Where to Add Notifications

### 1. Deal Notifications

#### File: `controllers/deals/dealsController.js`

```javascript
// Add this import at the top
const NotificationTriggers = require('../../services/notification/notificationTriggers');

// ✅ When creating a deal
exports.createDeal = async (req, res) => {
  try {
    const deal = await Deal.create({...});
    
    // 🔔 Send notification
    await NotificationTriggers.dealCreated(deal, req.user);
    
    res.json({ success: true, deal });
  } catch (error) {
    // error handling
  }
};

// ✅ When updating a deal
exports.updateDeal = async (req, res) => {
  try {
    const deal = await Deal.findByPk(req.params.dealId);
    const oldValues = { ...deal.dataValues };
    
    await deal.update(req.body);
    
    // Track changes
    const changes = {};
    if (oldValues.dealTitle !== deal.dealTitle) {
      changes.dealTitle = { old: oldValues.dealTitle, new: deal.dealTitle };
    }
    if (oldValues.dealValue !== deal.dealValue) {
      changes.dealValue = { old: oldValues.dealValue, new: deal.dealValue };
    }
    
    // 🔔 Send notification
    if (Object.keys(changes).length > 0) {
      await NotificationTriggers.dealUpdated(deal, req.user, changes);
    }
    
    res.json({ success: true, deal });
  } catch (error) {
    // error handling
  }
};

// ✅ When assigning a deal
exports.assignDeal = async (req, res) => {
  try {
    const { dealId, newOwnerId } = req.body;
    const deal = await Deal.findByPk(dealId);
    
    await deal.update({ ownerId: newOwnerId });
    
    // 🔔 Send notification
    await NotificationTriggers.dealAssigned(deal, newOwnerId, req.user);
    
    res.json({ success: true });
  } catch (error) {
    // error handling
  }
};

// ✅ When marking deal as won
exports.markDealAsWon = async (req, res) => {
  try {
    const deal = await Deal.findByPk(req.params.dealId);
    await deal.update({ status: 'won', wonDate: new Date() });
    
    // 🔔 Send notification
    await NotificationTriggers.dealWon(deal, req.user);
    
    res.json({ success: true });
  } catch (error) {
    // error handling
  }
};

// ✅ When marking deal as lost
exports.markDealAsLost = async (req, res) => {
  try {
    const { dealId, lostReason } = req.body;
    const deal = await Deal.findByPk(dealId);
    
    await deal.update({ status: 'lost', lostReason, lostDate: new Date() });
    
    // 🔔 Send notification
    await NotificationTriggers.dealLost(deal, req.user, lostReason);
    
    res.json({ success: true });
  } catch (error) {
    // error handling
  }
};

// ✅ When changing deal stage
exports.updateDealStage = async (req, res) => {
  try {
    const { dealId, newStage } = req.body;
    const deal = await Deal.findByPk(dealId);
    const oldStage = deal.stage;
    
    await deal.update({ stage: newStage });
    
    // 🔔 Send notification
    await NotificationTriggers.dealStageChanged(deal, newStage, oldStage, req.user);
    
    res.json({ success: true });
  } catch (error) {
    // error handling
  }
};
```

---

### 2. Lead Notifications

#### File: `controllers/leads/leadController.js`

```javascript
// Add this import at the top
const NotificationTriggers = require('../../services/notification/notificationTriggers');

// ✅ When creating a lead
exports.createLead = async (req, res) => {
  try {
    const lead = await Lead.create({...});
    
    // 🔔 Send notification
    await NotificationTriggers.leadCreated(lead, req.user);
    
    res.json({ success: true, lead });
  } catch (error) {
    // error handling
  }
};

// ✅ When assigning a lead
exports.assignLead = async (req, res) => {
  try {
    const { leadId, newOwnerId } = req.body;
    const lead = await Lead.findByPk(leadId);
    
    await lead.update({ ownerId: newOwnerId });
    
    // 🔔 Send notification
    await NotificationTriggers.leadAssigned(lead, newOwnerId, req.user);
    
    res.json({ success: true });
  } catch (error) {
    // error handling
  }
};

// ✅ When converting lead to deal
exports.convertLeadToDeal = async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.leadId);
    
    // Create deal from lead
    const deal = await Deal.create({
      dealTitle: lead.leadTitle,
      ownerId: lead.ownerId,
      // ... other fields
    });
    
    // Mark lead as converted
    await lead.update({ status: 'converted', convertedToDealId: deal.dealId });
    
    // 🔔 Send notification
    await NotificationTriggers.leadConverted(lead, deal, req.user);
    
    res.json({ success: true, deal });
  } catch (error) {
    // error handling
  }
};
```

---

### 3. Activity Notifications

#### File: `controllers/activity/activityController.js`

```javascript
// Add this import at the top
const NotificationTriggers = require('../../services/notification/notificationTriggers');

// ✅ When creating an activity
exports.createActivity = async (req, res) => {
  try {
    const activity = await Activity.create({...});
    
    // 🔔 Send notification if assigned to someone
    if (activity.assignedTo) {
      await NotificationTriggers.activityCreated(activity, req.user);
    }
    
    res.json({ success: true, activity });
  } catch (error) {
    // error handling
  }
};

// ✅ When assigning an activity
exports.assignActivity = async (req, res) => {
  try {
    const { activityId, assignedTo } = req.body;
    const activity = await Activity.findByPk(activityId);
    
    await activity.update({ assignedTo });
    
    // 🔔 Send notification
    await NotificationTriggers.activityAssigned(activity, assignedTo, req.user);
    
    res.json({ success: true });
  } catch (error) {
    // error handling
  }
};

// ✅ When completing an activity
exports.completeActivity = async (req, res) => {
  try {
    const activity = await Activity.findByPk(req.params.activityId);
    
    await activity.update({ 
      status: 'completed', 
      completedDate: new Date() 
    });
    
    // 🔔 Send notification
    await NotificationTriggers.activityCompleted(activity, req.user);
    
    res.json({ success: true });
  } catch (error) {
    // error handling
  }
};
```

---

### 4. Email Notifications

#### File: `controllers/email/emailController.js`

```javascript
// Add this import at the top
const NotificationTriggers = require('../../services/notification/notificationTriggers');

// ✅ When receiving an email
exports.processIncomingEmail = async (email, userId) => {
  try {
    // Save email to database
    const savedEmail = await Email.create({...});
    
    // 🔔 Send notification
    await NotificationTriggers.emailReceived(savedEmail, userId);
    
  } catch (error) {
    console.error('Error processing email:', error);
  }
};

// ✅ When receiving an email reply
exports.processEmailReply = async (email, originalEmailId, userId) => {
  try {
    const savedEmail = await Email.create({...});
    
    // Get original email sender
    const originalEmail = await Email.findByPk(originalEmailId);
    
    // 🔔 Send notification to original sender
    if (originalEmail && originalEmail.userId) {
      await NotificationTriggers.emailReplied(
        savedEmail, 
        { userId, name: email.fromName }, 
        originalEmail.userId
      );
    }
    
  } catch (error) {
    console.error('Error processing reply:', error);
  }
};
```

---

### 5. Mention & Comment Notifications

#### Example: When user is mentioned in a comment

```javascript
// In any controller where comments/mentions are handled

// ✅ Parse mentions from comment text
function extractMentions(text) {
  const mentionRegex = /@(\w+)/g;
  const mentions = [];
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1]); // username or userId
  }
  
  return mentions;
}

// ✅ Send notification for each mentioned user
exports.addComment = async (req, res) => {
  try {
    const { entityType, entityId, commentText } = req.body;
    
    // Save comment
    const comment = await Comment.create({
      entityType,
      entityId,
      userId: req.user.userId,
      text: commentText
    });
    
    // Extract mentions
    const mentions = extractMentions(commentText);
    
    // 🔔 Send notifications to mentioned users
    for (const username of mentions) {
      const mentionedUser = await MasterUser.findOne({ where: { username } });
      if (mentionedUser) {
        await NotificationTriggers.userMentioned(
          mentionedUser.userId,
          entityType,
          entityId,
          req.user,
          commentText
        );
      }
    }
    
    res.json({ success: true, comment });
  } catch (error) {
    // error handling
  }
};
```

---

## ⏰ Cron Jobs for Due/Overdue Activities

#### File: `utils/cronJob.js`

```javascript
const cron = require('node-cron');
const { Op } = require('sequelize');
const Activity = require('../models/activity/activityModel');
const NotificationTriggers = require('../services/notification/notificationTriggers');

// ✅ Check for activities due in next 2 hours (runs every hour)
cron.schedule('0 * * * *', async () => {
  console.log('🔔 Checking for due activities...');
  
  try {
    const now = new Date();
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    
    const dueActivities = await Activity.findAll({
      where: {
        dueDate: {
          [Op.between]: [now, twoHoursLater]
        },
        status: 'pending',
        notificationSent: false
      }
    });
    
    for (const activity of dueActivities) {
      const hoursUntilDue = Math.floor(
        (new Date(activity.dueDate) - now) / (1000 * 60 * 60)
      );
      
      await NotificationTriggers.activityDueSoon(activity, hoursUntilDue);
      
      // Mark notification as sent
      await activity.update({ notificationSent: true });
    }
    
    console.log(`✅ Sent ${dueActivities.length} due activity notifications`);
  } catch (error) {
    console.error('Error checking due activities:', error);
  }
});

// ✅ Check for overdue activities (runs every 6 hours)
cron.schedule('0 */6 * * *', async () => {
  console.log('🔔 Checking for overdue activities...');
  
  try {
    const overdueActivities = await Activity.findAll({
      where: {
        dueDate: {
          [Op.lt]: new Date()
        },
        status: 'pending',
        overdueNotificationSent: false
      }
    });
    
    for (const activity of overdueActivities) {
      await NotificationTriggers.activityOverdue(activity);
      await activity.update({ overdueNotificationSent: true });
    }
    
    console.log(`✅ Sent ${overdueActivities.length} overdue activity notifications`);
  } catch (error) {
    console.error('Error checking overdue activities:', error);
  }
});

// ✅ Clean up old notifications (runs daily at 2 AM)
cron.schedule('0 2 * * *', async () => {
  console.log('🗑️ Cleaning up old notifications...');
  
  try {
    const NotificationService = require('../services/notification/notificationService');
    const deleted = await NotificationService.cleanupExpiredNotifications();
    console.log(`✅ Cleaned up ${deleted} expired notifications`);
  } catch (error) {
    console.error('Error cleaning notifications:', error);
  }
});
```

---

## 🎯 Real-time Updates with Socket.IO

### Emit notification to specific user
```javascript
const { emitToUser } = require('../config/socket');

// Emit custom event to a user
emitToUser(userId, 'deal_updated', {
  dealId: 123,
  updates: { stage: 'Negotiation' }
});
```

### Emit to multiple users
```javascript
const { emitToUsers } = require('../config/socket');

// Notify all team members
const teamUserIds = [1, 2, 3, 4];
emitToUsers(teamUserIds, 'team_announcement', {
  message: 'Monthly target achieved! 🎉'
});
```

### Emit to a room (e.g., all users viewing a deal)
```javascript
const { emitToRoom } = require('../config/socket');

// Emit to all users in deal room
emitToRoom(`deal_${dealId}`, 'deal_comment_added', {
  dealId,
  comment: commentData
});
```

---

## 📝 Checklist for Integration

- [ ] Import `NotificationTriggers` in your controllers
- [ ] Add `dealCreated()` call in create deal endpoint
- [ ] Add `dealAssigned()` call in assign deal endpoint
- [ ] Add `dealWon()` / `dealLost()` calls in status update endpoints
- [ ] Add `leadCreated()` call in create lead endpoint
- [ ] Add `leadAssigned()` call in assign lead endpoint
- [ ] Add `leadConverted()` call in convert lead endpoint
- [ ] Add `activityCreated()` call in create activity endpoint
- [ ] Add `activityAssigned()` call in assign activity endpoint
- [ ] Add `activityCompleted()` call in complete activity endpoint
- [ ] Add `emailReceived()` call in email processing
- [ ] Add mention detection in comment system
- [ ] Set up cron jobs for due/overdue activities
- [ ] Test Socket.IO connection from frontend
- [ ] Build notification bell UI component
- [ ] Test notification preferences API

---

## 🚀 You're Ready!

Now you can add notifications anywhere in your CRM. Just call the appropriate trigger function from `NotificationTriggers` after your business logic.

**Remember:** Notifications are non-blocking and will fail silently if there's an error, so your main operations won't be affected.
