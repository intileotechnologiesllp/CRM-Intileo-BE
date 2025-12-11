# MongoDB Setup Guide for Pipedrive CRM

This guide explains how MongoDB has been integrated into your existing Pipedrive CRM system alongside MySQL.

## 🔧 Setup Complete

MongoDB has been successfully configured in your CRM project with the following components:

### Files Created/Modified:

1. **`config/mongodb.js`** - MongoDB connection configuration
2. **`.env`** - Added MongoDB URI configuration
3. **`models/mongodb/`** - Directory for MongoDB models
4. **`models/mongodb/analyticsModel.js`** - User analytics tracking model
5. **`models/mongodb/emailActivityLogModel.js`** - Email interaction logging model
6. **`models/mongodb/index.js`** - MongoDB models export file
7. **`services/mongodbService.js`** - Service layer for MongoDB operations
8. **`routes/mongodb/mongodbRoutes.js`** - API routes for MongoDB features
9. **`app.js`** - Updated to initialize MongoDB connection

## 🚀 Getting Started

### 1. Install MongoDB (if not already installed)

**Windows:**
```powershell
# Using Chocolatey
choco install mongodb

# Or download from: https://www.mongodb.com/try/download/community
```

**Alternative: Use MongoDB Atlas (Cloud)**
- Sign up at https://www.mongodb.com/atlas
- Create a free cluster
- Update MONGODB_URI in .env with your Atlas connection string

### 2. Start MongoDB Service

**Windows:**
```powershell
# Start MongoDB service
net start MongoDB

# Or if installed manually:
mongod --dbpath "C:\data\db"
```

### 3. Update Environment Variables

The `.env` file has been updated with MongoDB configuration:

```env
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/pipedrive_crm
# For production with authentication:
# MONGODB_URI=mongodb://username:password@host:port/pipedrive_crm
# For MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/pipedrive_crm
```

### 4. Start Your Application

```powershell
npm start
```

You should see logs indicating both MySQL and MongoDB connections:
```
✅ MongoDB connected successfully!
📊 Database: pipedrive_crm
🚀 Server running on port 3056
📊 MySQL Database: Connected via Sequelize
🍃 MongoDB: Connected via Mongoose
```

## 📊 Available Features

### Analytics Tracking
- User activity logging
- Email interaction tracking
- Engagement metrics
- Dashboard analytics

### API Endpoints

**Health Check:**
```
GET /api/mongodb/health
```

**Analytics:**
```
POST /api/mongodb/analytics/log
GET /api/mongodb/analytics/user/:userId
GET /api/mongodb/analytics/events/:eventType
```

**Email Analytics:**
```
POST /api/mongodb/email/activity
GET /api/mongodb/email/analytics/:emailId
```

**Dashboard:**
```
GET /api/mongodb/dashboard/:userId
GET /api/mongodb/engagement/:userId
```

## 💡 Usage Examples

### 1. Log User Activity
```javascript
const MongoDBService = require('./services/mongodbService');

// Log when user creates a lead
await MongoDBService.logUserActivity(
  userId, 
  userEmail, 
  'lead_created', 
  { leadId: '123', leadTitle: 'New Lead' }
);
```

### 2. Track Email Interactions
```javascript
// Log when email is opened
await MongoDBService.logEmailActivity(
  emailId,
  userId,
  'opened',
  { ipAddress: req.ip, userAgent: req.get('User-Agent') }
);
```

### 3. Get Analytics Dashboard
```javascript
// Get user's dashboard analytics for last 7 days
const dashboard = await MongoDBService.getDashboardAnalytics(userId, 7);
```

## 🔄 Integration Points

### With Existing Email System
- Enhanced email tracking beyond MySQL capabilities
- Detailed interaction analytics
- Performance metrics

### With Lead/Deal Management
- Activity correlation with business outcomes
- User behavior insights
- Engagement scoring

### With Reporting System
- Advanced analytics queries
- Time-series data analysis
- Custom dashboard metrics

## 🏗️ Database Architecture

**MySQL (Existing)**: Core business data
- Users, Leads, Deals, Organizations
- Transactional data
- Relational data integrity

**MongoDB (New)**: Analytics & Logging
- User activity logs
- Email interaction tracking
- Time-series analytics data
- Flexible schema for evolving metrics

## 🔧 Customization

### Adding New MongoDB Models

1. Create model in `models/mongodb/yourModel.js`:
```javascript
const mongoose = require('mongoose');

const yourSchema = new mongoose.Schema({
  // Your schema definition
});

module.exports = mongoose.model('YourModel', yourSchema);
```

2. Export in `models/mongodb/index.js`:
```javascript
const YourModel = require('./yourModel');

module.exports = {
  // ... existing models
  YourModel,
};
```

3. Use in services or controllers:
```javascript
const { YourModel } = require('../models/mongodb');
```

## 🔍 Monitoring

### Check Connection Status
```
GET /api/mongodb/health
```

### View Logs
MongoDB connection logs will appear in your console with:
- ✅ Success indicators
- ❌ Error messages
- 📊 Connection details

## 🚨 Troubleshooting

**Connection Issues:**
1. Ensure MongoDB service is running
2. Check MONGODB_URI in .env
3. Verify network connectivity (for Atlas)
4. Check firewall settings

**Performance:**
- MongoDB indexes are automatically created for common queries
- Monitor query performance in production
- Consider connection pooling for high load

## 🔄 Next Steps

1. **Test the Integration**: Start your application and check both database connections
2. **Explore APIs**: Test the MongoDB routes using Postman or your frontend
3. **Add Analytics**: Integrate MongoDB logging into your existing CRM workflows
4. **Monitor Performance**: Watch both MySQL and MongoDB performance metrics
5. **Customize Models**: Add domain-specific models as needed

Your CRM now has dual-database capabilities, combining the reliability of MySQL for core business data with the flexibility of MongoDB for analytics and logging! 🎉