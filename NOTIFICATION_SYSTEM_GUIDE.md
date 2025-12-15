# 🔔 CRM Notification System - Complete Guide

## 📋 Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Installation & Setup](#installation--setup)
4. [Backend API Reference](#backend-api-reference)
5. [Frontend Integration](#frontend-integration)
6. [Notification Types](#notification-types)
7. [Push Notifications Setup](#push-notifications-setup)
8. [Examples & Usage](#examples--usage)
9. [Testing](#testing)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

This CRM system includes a **Pipedrive-style notification system** with:

✅ **In-App Notifications** - Real-time bell icon notifications using Socket.IO
✅ **Browser Push Notifications** - System notifications even when CRM is closed
✅ **User Preferences** - Granular control over notification types
✅ **Real-time Updates** - Instant notification delivery via WebSockets
✅ **Smart Filtering** - Quiet hours, mute, and per-type preferences

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React/Vue)                  │
│  ┌──────────────┐  ┌────────────┐  ┌─────────────────┐ │
│  │ Bell Icon UI │  │ Socket.IO  │  │ Push Permission │ │
│  │  Component   │◄─┤   Client   │  │     Dialog      │ │
│  └──────────────┘  └────────────┘  └─────────────────┘ │
└────────────┬───────────┬──────────────────┬─────────────┘
             │           │                  │
             │ REST API  │ WebSocket        │ Service Worker
             │           │                  │
┌────────────▼───────────▼──────────────────▼─────────────┐
│                    Backend (Node.js/Express)             │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────┐│
│  │ Notification   │  │   Socket.IO    │  │  Firebase  ││
│  │  Controller    │  │     Server     │  │    FCM     ││
│  └────────┬───────┘  └────────┬───────┘  └─────┬──────┘│
│           │                   │                 │       │
│  ┌────────▼───────────────────▼─────────────────▼────┐ │
│  │         Notification Service Layer                 │ │
│  │  - Create notifications                            │ │
│  │  - Check user preferences                          │ │
│  │  - Send via Socket.IO & Push                       │ │
│  └────────────────────────┬───────────────────────────┘ │
│                           │                             │
│  ┌────────────────────────▼───────────────────────────┐ │
│  │              MySQL Database                         │ │
│  │  - Notifications                                    │ │
│  │  - NotificationPreferences                          │ │
│  │  - PushSubscriptions                                │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

---

## 🚀 Installation & Setup

### Step 1: Dependencies Installed ✅
```bash
npm install socket.io firebase-admin web-push
```

### Step 2: Database Setup
Run the server to auto-create notification tables:
```bash
npm start
```

The following tables will be created:
- `Notifications` - Stores all notifications
- `NotificationPreferences` - User notification settings
- `PushSubscriptions` - Browser push subscriptions

### Step 3: Environment Variables
Add to your `.env` file:
```env
# Socket.IO Configuration
FRONTEND_URL=http://localhost:3000

# Firebase (Optional - for Push Notifications)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="your-private-key"
FIREBASE_CLIENT_EMAIL=your-client-email@firebase.com

# Web Push (Alternative to Firebase)
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:your-email@example.com
```

---

## 📡 Backend API Reference

### Authentication
All notification endpoints require authentication via JWT token in the `Authorization` header:
```
Authorization: Bearer <your-jwt-token>
```

### Endpoints

#### 1. Get Notifications
```http
GET /api/notifications?page=1&limit=20&isRead=false
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `isRead` (optional): Filter by read status (true/false)
- `type` (optional): Filter by notification type
- `priority` (optional): Filter by priority (low/medium/high/urgent)
- `startDate` (optional): Filter from date
- `endDate` (optional): Filter to date

**Response:**
```json
{
  "success": true,
  "notifications": [
    {
      "notificationId": 123,
      "type": "deal_assigned",
      "title": "Deal Assigned to You",
      "message": "John Doe assigned deal 'Big Contract' to you",
      "isRead": false,
      "priority": "high",
      "entityType": "deal",
      "entityId": 456,
      "actionUrl": "/deals/456",
      "createdAt": "2025-12-11T10:30:00Z",
      "actor": {
        "userId": 789,
        "name": "John Doe",
        "email": "john@example.com"
      }
    }
  ],
  "pagination": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  },
  "unreadCount": 12
}
```

#### 2. Get Unread Count
```http
GET /api/notifications/unread-count
```

**Response:**
```json
{
  "success": true,
  "count": 12
}
```

#### 3. Mark Notification as Read
```http
PUT /api/notifications/:notificationId/read
```

**Response:**
```json
{
  "success": true,
  "message": "Notification marked as read",
  "notification": { ... }
}
```

#### 4. Mark All as Read
```http
PUT /api/notifications/read-all
```

**Response:**
```json
{
  "success": true,
  "message": "Marked 12 notifications as read",
  "updated": 12
}
```

#### 5. Delete Notification
```http
DELETE /api/notifications/:notificationId
```

#### 6. Delete All Notifications
```http
DELETE /api/notifications/delete-all/all
```

#### 7. Get Preferences
```http
GET /api/notifications/preferences/settings
```

**Response:**
```json
{
  "success": true,
  "preferences": {
    "inAppEnabled": true,
    "inAppDealCreated": true,
    "inAppDealAssigned": true,
    "pushEnabled": false,
    "emailEnabled": true,
    "emailDigestFrequency": "daily",
    "quietHoursStart": "22:00",
    "quietHoursEnd": "08:00"
  }
}
```

#### 8. Update Preferences
```http
PUT /api/notifications/preferences/settings
Content-Type: application/json

{
  "inAppDealCreated": false,
  "pushEnabled": true,
  "quietHoursStart": "23:00",
  "quietHoursEnd": "07:00"
}
```

#### 9. Subscribe to Push Notifications
```http
POST /api/notifications/push/subscribe
Content-Type: application/json

{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "keys": {
    "p256dh": "BN...",
    "auth": "kp..."
  },
  "deviceInfo": {
    "browser": "Chrome",
    "os": "Windows 10"
  }
}
```

#### 10. Send Test Notification
```http
POST /api/notifications/test
Content-Type: application/json

{
  "type": "system",
  "title": "Test Notification",
  "message": "This is a test",
  "priority": "medium"
}
```

---

## 🌐 Frontend Integration

### Socket.IO Client Setup

#### 1. Install Socket.IO Client
```bash
npm install socket.io-client
```

#### 2. Create Socket Connection
```javascript
// src/services/socketService.js
import io from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_API_URL || 'http://localhost:4001';

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect(token) {
    this.socket = io(SOCKET_URL, {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log('✅ Connected to notification server');
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from notification server');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  emit(event, data) {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }
}

export default new SocketService();
```

#### 3. React Notification Component Example
```javascript
// src/components/NotificationBell.jsx
import React, { useState, useEffect } from 'react';
import socketService from '../services/socketService';
import axios from 'axios';

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Get token from localStorage or Redux
    const token = localStorage.getItem('authToken');
    
    // Connect to Socket.IO
    socketService.connect(token);

    // Listen for new notifications
    socketService.on('new_notification', (data) => {
      console.log('📬 New notification:', data);
      setUnreadCount(data.unreadCount);
      
      // Show browser notification
      if (Notification.permission === 'granted') {
        new Notification(data.notification.title, {
          body: data.notification.message,
          icon: '/notification-icon.png'
        });
      }
      
      // Add to local state
      setNotifications(prev => [data.notification, ...prev]);
    });

    // Listen for notification updates
    socketService.on('notification_read', (data) => {
      setUnreadCount(data.unreadCount);
      setNotifications(prev => 
        prev.map(n => 
          n.notificationId === data.notificationId 
            ? { ...n, isRead: true } 
            : n
        )
      );
    });

    socketService.on('all_notifications_read', (data) => {
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    });

    // Fetch initial notifications
    fetchNotifications();

    return () => {
      socketService.disconnect();
    };
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await axios.get('/api/notifications?limit=50');
      setNotifications(response.data.notifications);
      setUnreadCount(response.data.unreadCount);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await axios.put(`/api/notifications/${notificationId}/read`);
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.put('/api/notifications/read-all');
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  return (
    <div className="notification-bell">
      <button onClick={() => setIsOpen(!isOpen)}>
        🔔
        {unreadCount > 0 && (
          <span className="badge">{unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead}>Mark all as read</button>
            )}
          </div>

          <div className="notification-list">
            {notifications.length === 0 ? (
              <p>No notifications</p>
            ) : (
              notifications.map(notification => (
                <div 
                  key={notification.notificationId}
                  className={`notification-item ${!notification.isRead ? 'unread' : ''}`}
                  onClick={() => {
                    markAsRead(notification.notificationId);
                    if (notification.actionUrl) {
                      window.location.href = notification.actionUrl;
                    }
                  }}
                >
                  <div className="title">{notification.title}</div>
                  <div className="message">{notification.message}</div>
                  <div className="time">
                    {new Date(notification.createdAt).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
```

---

## 📢 Notification Types

The system supports the following notification types:

| Type | Description | Priority |
|------|-------------|----------|
| `deal_created` | New deal created | medium |
| `deal_updated` | Deal details updated | low |
| `deal_won` | Deal marked as won | high |
| `deal_lost` | Deal marked as lost | medium |
| `deal_assigned` | Deal assigned to user | high |
| `deal_stage_changed` | Deal moved to new stage | medium |
| `lead_created` | New lead created | medium |
| `lead_updated` | Lead details updated | low |
| `lead_assigned` | Lead assigned to user | high |
| `lead_converted` | Lead converted to deal | medium |
| `activity_created` | New activity created | medium |
| `activity_assigned` | Activity assigned to user | high |
| `activity_completed` | Activity marked complete | low |
| `activity_due` | Activity due soon | high |
| `activity_overdue` | Activity overdue | urgent |
| `email_received` | New email received | medium |
| `email_sent` | Email sent successfully | low |
| `email_replied` | Email reply received | medium |
| `contact_created` | New contact created | low |
| `contact_updated` | Contact updated | low |
| `organization_created` | New organization created | low |
| `organization_updated` | Organization updated | low |
| `mention` | User mentioned in comment | high |
| `comment` | New comment added | low |
| `task_assigned` | Task assigned to user | high |
| `goal_achieved` | Goal target achieved | high |
| `report_generated` | Report ready | medium |
| `system` | System notification | medium |

---

## 🔔 Push Notifications Setup

### Option 1: Firebase Cloud Messaging (FCM)

#### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable Cloud Messaging

#### 2. Get Service Account Key
1. Go to Project Settings → Service Accounts
2. Click "Generate new private key"
3. Save the JSON file

#### 3. Add to .env
```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
```

#### 4. Frontend Service Worker
Create `public/firebase-messaging-sw.js`:
```javascript
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/firebase-logo.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
```

### Option 2: Web Push API (No Firebase)

#### 1. Generate VAPID Keys
```javascript
const webpush = require('web-push');
const vapidKeys = webpush.generateVAPIDKeys();
console.log('Public Key:', vapidKeys.publicKey);
console.log('Private Key:', vapidKeys.privateKey);
```

#### 2. Add to .env
```env
VAPID_PUBLIC_KEY=your-public-key
VAPID_PRIVATE_KEY=your-private-key
VAPID_SUBJECT=mailto:your-email@example.com
```

---

## 💡 Examples & Usage

### Example 1: Send Notification When Deal is Created
```javascript
// In your dealController.js
const NotificationTriggers = require('../services/notification/notificationTriggers');

exports.createDeal = async (req, res) => {
  try {
    // Create deal logic...
    const deal = await Deal.create(dealData);

    // Send notification
    await NotificationTriggers.dealCreated(deal, req.user);

    res.json({ success: true, deal });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
```

### Example 2: Send Notification When Deal is Assigned
```javascript
exports.assignDeal = async (req, res) => {
  try {
    const { dealId, newOwnerId } = req.body;
    const deal = await Deal.findByPk(dealId);
    
    await deal.update({ ownerId: newOwnerId });

    // Send notification to new owner
    await NotificationTriggers.dealAssigned(deal, newOwnerId, req.user);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
```

### Example 3: Send Notification for Activity Due Soon
```javascript
// In a cron job (utils/cronJob.js)
const NotificationTriggers = require('../services/notification/notificationTriggers');
const { Op } = require('sequelize');

async function checkDueActivities() {
  const activities = await Activity.findAll({
    where: {
      dueDate: {
        [Op.between]: [new Date(), new Date(Date.now() + 2 * 60 * 60 * 1000)] // Next 2 hours
      },
      status: 'pending'
    }
  });

  for (const activity of activities) {
    const hoursUntilDue = (new Date(activity.dueDate) - new Date()) / (1000 * 60 * 60);
    await NotificationTriggers.activityDueSoon(activity, Math.floor(hoursUntilDue));
  }
}

// Run every hour
cron.schedule('0 * * * *', checkDueActivities);
```

---

## 🧪 Testing

### 1. Test Socket.IO Connection
```javascript
// In browser console
const socket = io('http://localhost:4001', {
  auth: { token: 'your-jwt-token' }
});

socket.on('connect', () => console.log('Connected!'));
socket.on('new_notification', (data) => console.log('Notification:', data));
```

### 2. Send Test Notification via API
```bash
curl -X POST http://localhost:4001/api/notifications/test \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Notification",
    "message": "This is a test",
    "priority": "high"
  }'
```

### 3. Test Preferences
```bash
# Get preferences
curl http://localhost:4001/api/notifications/preferences/settings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Update preferences
curl -X PUT http://localhost:4001/api/notifications/preferences/settings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "inAppDealCreated": false,
    "quietHoursStart": "22:00",
    "quietHoursEnd": "08:00"
  }'
```

---

## 🔍 Troubleshooting

### Socket.IO Not Connecting
**Problem:** Frontend can't connect to Socket.IO

**Solutions:**
1. Check CORS settings in `config/socket.js`
2. Verify FRONTEND_URL in `.env`
3. Check firewall/antivirus blocking WebSocket connections
4. Try polling transport: `transports: ['polling']`

### Notifications Not Appearing
**Problem:** Notifications created but not showing

**Solutions:**
1. Check user preferences (may be disabled)
2. Verify Socket.IO connection is active
3. Check browser console for errors
4. Verify JWT token is valid

### Push Notifications Not Working
**Problem:** Browser push notifications not appearing

**Solutions:**
1. Check browser notification permissions
2. Verify VAPID keys or Firebase config
3. Check service worker registration
4. Test on HTTPS (required for push notifications)

---

## 📊 Performance Tips

1. **Pagination:** Always use pagination for notification lists
2. **Cleanup:** Run periodic cleanup of old notifications (cron job)
3. **Indexing:** Database indexes are already configured
4. **Batching:** Use `createBulkNotifications` for multiple users
5. **Caching:** Consider Redis for unread counts

---

## 🎉 You're All Set!

Your CRM now has a complete notification system similar to Pipedrive!

**Next Steps:**
1. Integrate notification triggers in your existing controllers
2. Build the frontend notification bell component
3. Set up push notifications (optional)
4. Customize notification messages and types
5. Add email digest functionality

For questions or issues, refer to the code comments or check the troubleshooting section.
