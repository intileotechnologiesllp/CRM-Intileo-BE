# Notification Progress Stats - Frontend Integration

## 📊 API Endpoint

**GET** `/api/notifications/progress`

### Response Format:
```json
{
  "success": true,
  "data": {
    "daily": {
      "meetings": 5,
      "emails": 12,
      "activities": 8
    },
    "monthly": {
      "newDeals": {
        "count": 15,
        "change": 3,
        "percentChange": "25.0"
      },
      "wonDeals": {
        "count": 8,
        "change": 2,
        "percentChange": "33.3"
      },
      "revenue": {
        "total": 125000.50,
        "change": 25000.00,
        "percentChange": "25.0"
      }
    }
  }
}
```

---

## 🎨 Frontend React/Vue Component Example

### **React Component:**

```jsx
import React, { useState, useEffect } from 'react';
import { Bell, Settings, X, TrendingUp, TrendingDown } from 'lucide-react';

const NotificationPanel = () => {
  const [progress, setProgress] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchProgress();
      fetchNotifications();
    }
  }, [isOpen]);

  const fetchProgress = async () => {
    const response = await fetch('http://213.136.77.55:4001/api/notifications/progress', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    const data = await response.json();
    setProgress(data.data);
  };

  const fetchNotifications = async () => {
    const response = await fetch('http://213.136.77.55:4001/api/notifications?limit=10', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    const data = await response.json();
    setNotifications(data.data.notifications);
  };

  const renderChange = (change, percentChange) => {
    const isPositive = change >= 0;
    return (
      <div className={`flex items-center gap-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        <span className="text-xs">{Math.abs(percentChange)}%</span>
      </div>
    );
  };

  return (
    <div className="relative">
      {/* Bell Icon */}
      <button onClick={() => setIsOpen(!isOpen)} className="relative p-2">
        <Bell size={24} />
        <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
          3
        </span>
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-96 bg-white rounded-lg shadow-xl border z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold text-lg">Notifications</h3>
            <div className="flex gap-2">
              <button><Settings size={20} /></button>
              <button onClick={() => setIsOpen(false)}><X size={20} /></button>
            </div>
          </div>

          {/* Progress Section */}
          {progress && (
            <div className="p-4 bg-gray-50 border-b">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-sm text-gray-700">YOUR PROGRESS</h4>
                <button className="text-gray-400">...</button>
              </div>

              {/* Daily Progress */}
              <div className="mb-4">
                <div className="flex items-center gap-1 mb-2">
                  <span className="text-sm font-medium">Daily progress</span>
                  <span className="text-gray-400 text-xs">ⓘ</span>
                </div>
                <div className="flex justify-around">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mb-1">
                      <span className="text-xl font-semibold">{progress.daily.meetings}</span>
                    </div>
                    <span className="text-xs text-gray-600">meetings</span>
                  </div>
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mb-1">
                      <span className="text-xl font-semibold">{progress.daily.emails}</span>
                    </div>
                    <span className="text-xs text-gray-600">emails</span>
                  </div>
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mb-1">
                      <span className="text-xl font-semibold">{progress.daily.activities}</span>
                    </div>
                    <span className="text-xs text-gray-600">activities</span>
                  </div>
                </div>
              </div>

              {/* Monthly Progress */}
              <div>
                <div className="flex items-center gap-1 mb-2">
                  <span className="text-sm font-medium">Monthly progress</span>
                  <span className="text-gray-400 text-xs">ⓘ</span>
                </div>
                <div className="flex justify-around">
                  <div className="text-center">
                    <div className="text-xl font-semibold">{progress.monthly.newDeals.count}</div>
                    {renderChange(progress.monthly.newDeals.change, progress.monthly.newDeals.percentChange)}
                    <div className="text-xs text-gray-600">New deals</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-semibold">{progress.monthly.wonDeals.count}</div>
                    {renderChange(progress.monthly.wonDeals.change, progress.monthly.wonDeals.percentChange)}
                    <div className="text-xs text-gray-600">Won deals</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-semibold">₹{progress.monthly.revenue.total.toFixed(2)}</div>
                    {renderChange(progress.monthly.revenue.change, progress.monthly.revenue.percentChange)}
                    <div className="text-xs text-gray-600">Rev. forecast</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.map((notif) => (
              <div key={notif.notificationId} className="p-4 border-b hover:bg-gray-50 cursor-pointer">
                <div className="flex gap-3">
                  <div className={`w-2 h-2 rounded-full mt-2 ${notif.isRead ? 'bg-gray-300' : 'bg-blue-500'}`} />
                  <div className="flex-1">
                    <h5 className="font-medium text-sm">{notif.title}</h5>
                    <p className="text-xs text-gray-600 mt-1">{notif.message}</p>
                    <span className="text-xs text-gray-400 mt-1">
                      {new Date(notif.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="p-3 text-center border-t">
            <button className="text-sm text-blue-600 hover:underline">
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;
```

---

## 📱 Vue.js Component Example:

```vue
<template>
  <div class="relative">
    <!-- Bell Icon -->
    <button @click="togglePanel" class="relative p-2">
      <BellIcon />
      <span class="badge">{{ unreadCount }}</span>
    </button>

    <!-- Notification Panel -->
    <div v-if="isOpen" class="notification-panel">
      <!-- Header -->
      <div class="panel-header">
        <h3>Notifications</h3>
        <button @click="isOpen = false">×</button>
      </div>

      <!-- Progress Section -->
      <div v-if="progress" class="progress-section">
        <h4>YOUR PROGRESS</h4>
        
        <!-- Daily Progress -->
        <div class="daily-progress">
          <p>Daily progress</p>
          <div class="stats-row">
            <div class="stat-item">
              <div class="circle">{{ progress.daily.meetings }}</div>
              <span>meetings</span>
            </div>
            <div class="stat-item">
              <div class="circle">{{ progress.daily.emails }}</div>
              <span>emails</span>
            </div>
            <div class="stat-item">
              <div class="circle">{{ progress.daily.activities }}</div>
              <span>activities</span>
            </div>
          </div>
        </div>

        <!-- Monthly Progress -->
        <div class="monthly-progress">
          <p>Monthly progress</p>
          <div class="stats-row">
            <div class="stat-item">
              <div class="value">{{ progress.monthly.newDeals.count }}</div>
              <div :class="changeClass(progress.monthly.newDeals.change)">
                {{ progress.monthly.newDeals.percentChange }}%
              </div>
              <span>New deals</span>
            </div>
            <div class="stat-item">
              <div class="value">{{ progress.monthly.wonDeals.count }}</div>
              <div :class="changeClass(progress.monthly.wonDeals.change)">
                {{ progress.monthly.wonDeals.percentChange }}%
              </div>
              <span>Won deals</span>
            </div>
            <div class="stat-item">
              <div class="value">₹{{ progress.monthly.revenue.total.toFixed(2) }}</div>
              <div :class="changeClass(progress.monthly.revenue.change)">
                {{ progress.monthly.revenue.percentChange }}%
              </div>
              <span>Rev. forecast</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Notifications List -->
      <div class="notifications-list">
        <div 
          v-for="notif in notifications" 
          :key="notif.notificationId"
          class="notification-item"
        >
          <div :class="['dot', notif.isRead ? 'read' : 'unread']"></div>
          <div class="content">
            <h5>{{ notif.title }}</h5>
            <p>{{ notif.message }}</p>
            <span>{{ formatDate(notif.createdAt) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      isOpen: false,
      progress: null,
      notifications: [],
      unreadCount: 0
    }
  },
  methods: {
    async togglePanel() {
      this.isOpen = !this.isOpen;
      if (this.isOpen) {
        await this.fetchProgress();
        await this.fetchNotifications();
      }
    },
    async fetchProgress() {
      const response = await fetch('http://213.136.77.55:4001/api/notifications/progress', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      this.progress = data.data;
    },
    async fetchNotifications() {
      const response = await fetch('http://213.136.77.55:4001/api/notifications?limit=10', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      this.notifications = data.data.notifications;
    },
    changeClass(change) {
      return change >= 0 ? 'positive-change' : 'negative-change';
    },
    formatDate(date) {
      return new Date(date).toLocaleString();
    }
  }
}
</script>
```

---

## 🔌 Socket.IO Integration (Real-time Updates)

```javascript
// Update progress when new notifications arrive
socket.on('new_notification', async (data) => {
  // Add notification to list
  notifications.unshift(data.notification);
  
  // Update unread count
  unreadCount = data.unreadCount;
  
  // Refresh progress stats
  await fetchProgress();
});
```

---

## ✅ Backend is Ready!

**New API Endpoint:** `GET /api/notifications/progress`

**Features:**
- ✅ Daily progress: meetings, emails, activities (today's count)
- ✅ Monthly progress: new deals, won deals, revenue
- ✅ Shows change from previous month
- ✅ Calculates percentage change
- ✅ Authenticated (requires JWT token)

**Test it now:**
```bash
curl -X GET http://213.136.77.55:4001/api/notifications/progress \
  -H "Authorization: Bearer <your-token>"
```

Your notification panel is now complete with progress tracking just like Pipedrive! 🎉
