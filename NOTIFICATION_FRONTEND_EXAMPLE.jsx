// NotificationBell.jsx
// React component example for notification bell icon

import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import './NotificationBell.css'; // See CSS below

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const socketRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    initializeNotifications();
    
    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const initializeNotifications = async () => {
    try {
      // Get auth token from localStorage or your auth system
      const token = localStorage.getItem('authToken');
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4001';

      // Connect to Socket.IO
      socketRef.current = io(API_URL, {
        auth: { token },
        transports: ['websocket', 'polling']
      });

      // Socket event listeners
      socketRef.current.on('connect', () => {
        console.log('✅ Connected to notification server');
      });

      socketRef.current.on('new_notification', (data) => {
        console.log('📬 New notification:', data);
        
        // Update unread count
        setUnreadCount(data.unreadCount);
        
        // Add to notifications list
        setNotifications(prev => [data.notification, ...prev]);

        // Show browser notification
        if (Notification.permission === 'granted') {
          new Notification(data.notification.title, {
            body: data.notification.message,
            icon: '/notification-icon.png',
            tag: data.notification.notificationId
          });
        }

        // Play sound (optional)
        // new Audio('/notification-sound.mp3').play();
      });

      socketRef.current.on('notification_read', (data) => {
        setUnreadCount(data.unreadCount);
        setNotifications(prev =>
          prev.map(n =>
            n.notificationId === data.notificationId
              ? { ...n, isRead: true }
              : n
          )
        );
      });

      socketRef.current.on('all_notifications_read', (data) => {
        setUnreadCount(0);
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      });

      // Fetch initial notifications
      await fetchNotifications();
      
      // Request browser notification permission
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    } catch (error) {
      console.error('Error initializing notifications:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4001';

      const response = await axios.get(`${API_URL}/api/notifications`, {
        params: { page: 1, limit: 50 },
        headers: { Authorization: `Bearer ${token}` }
      });

      setNotifications(response.data.notifications);
      setUnreadCount(response.data.unreadCount);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const token = localStorage.getItem('authToken');
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4001';

      await axios.put(
        `${API_URL}/api/notifications/${notificationId}/read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4001';

      await axios.put(
        `${API_URL}/api/notifications/read-all`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleNotificationClick = (notification) => {
    // Mark as read
    if (!notification.isRead) {
      markAsRead(notification.notificationId);
    }

    // Navigate to related entity
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }

    setIsOpen(false);
  };

  const getPriorityClass = (priority) => {
    const classes = {
      urgent: 'priority-urgent',
      high: 'priority-high',
      medium: 'priority-medium',
      low: 'priority-low'
    };
    return classes[priority] || 'priority-medium';
  };

  const getTypeIcon = (type) => {
    const icons = {
      deal_created: '💼',
      deal_won: '🎉',
      deal_lost: '😢',
      deal_assigned: '👤',
      lead_created: '📝',
      lead_assigned: '👤',
      activity_assigned: '✓',
      activity_due: '⏰',
      activity_overdue: '🚨',
      email_received: '📧',
      mention: '@',
      comment: '💬',
      goal_achieved: '🎯',
      system: '⚙️'
    };
    return icons[type] || '🔔';
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now - date;
    const diffInMins = Math.floor(diffInMs / 60000);
    const diffInHours = Math.floor(diffInMins / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMins < 1) return 'Just now';
    if (diffInMins < 60) return `${diffInMins}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="notification-bell-container" ref={dropdownRef}>
      <button
        className="notification-bell-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        <span className="bell-icon">🔔</span>
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button
                className="mark-all-read-btn"
                onClick={markAllAsRead}
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="notification-list">
            {loading ? (
              <div className="notification-loading">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="notification-empty">
                <span className="empty-icon">📭</span>
                <p>No notifications</p>
              </div>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.notificationId}
                  className={`notification-item ${!notification.isRead ? 'unread' : ''} ${getPriorityClass(notification.priority)}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-icon">
                    {getTypeIcon(notification.type)}
                  </div>
                  <div className="notification-content">
                    <div className="notification-title">
                      {notification.title}
                    </div>
                    <div className="notification-message">
                      {notification.message}
                    </div>
                    <div className="notification-time">
                      {formatTime(notification.createdAt)}
                    </div>
                  </div>
                  {!notification.isRead && (
                    <div className="notification-unread-indicator"></div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="notification-footer">
            <a href="/notifications" onClick={() => setIsOpen(false)}>
              View all notifications
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;


/*
 * NotificationBell.css
 * Add this CSS file to style the notification component
 */

/*
.notification-bell-container {
  position: relative;
}

.notification-bell-button {
  position: relative;
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.notification-bell-button:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.notification-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  background: #dc3545;
  color: white;
  font-size: 11px;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
}

.notification-dropdown {
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: 8px;
  width: 400px;
  max-height: 600px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
}

.notification-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.mark-all-read-btn {
  background: none;
  border: none;
  color: #667eea;
  font-size: 13px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.mark-all-read-btn:hover {
  background-color: rgba(102, 126, 234, 0.1);
}

.notification-list {
  flex: 1;
  overflow-y: auto;
  max-height: 500px;
}

.notification-item {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid #f5f5f5;
  cursor: pointer;
  transition: background-color 0.2s;
  position: relative;
}

.notification-item:hover {
  background-color: #f8f9fa;
}

.notification-item.unread {
  background-color: #f0f4ff;
}

.notification-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-title {
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
  font-size: 14px;
}

.notification-message {
  color: #666;
  font-size: 13px;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.notification-time {
  color: #999;
  font-size: 12px;
}

.notification-unread-indicator {
  width: 8px;
  height: 8px;
  background: #667eea;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 8px;
}

.priority-urgent {
  border-left: 4px solid #ff4757;
}

.priority-high {
  border-left: 4px solid #dc3545;
}

.priority-medium {
  border-left: 4px solid #ffc107;
}

.priority-low {
  border-left: 4px solid #28a745;
}

.notification-loading,
.notification-empty {
  padding: 40px 20px;
  text-align: center;
  color: #999;
}

.empty-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 12px;
}

.notification-footer {
  padding: 12px 20px;
  border-top: 1px solid #f0f0f0;
  text-align: center;
}

.notification-footer a {
  color: #667eea;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
}

.notification-footer a:hover {
  text-decoration: underline;
}
*/
