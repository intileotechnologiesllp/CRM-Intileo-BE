# Follower Feature - Quick Setup Guide

## ✅ Implementation Complete!

The follower functionality has been successfully implemented for your CRM system. Users can now follow deals, leads, persons, and organizations.

---

## 📁 Files Created

### 1. Model
- `models/follower/followerModel.js` - Sequelize model for the Followers table

### 2. Controller
- `controllers/follower/followerController.js` - All follower management logic (8 APIs)

### 3. Routes
- `routes/followerRoutes.js` - REST API endpoints for follower operations

### 4. Documentation
- `FOLLOWER_API_DOCUMENTATION.md` - Complete API documentation with examples
- `create-followers-table.sql` - Database migration script

### 5. Updated Files
- `app.js` - Added follower routes registration
- `models/index.js` - Added Follower model and associations

---

## 🚀 Setup Instructions

### Step 1: Create the Database Table

Run the SQL migration to create the Followers table:

```bash
# Option 1: Using MySQL command line
mysql -u your_username -p your_database < create-followers-table.sql

# Option 2: Using a MySQL client (phpMyAdmin, MySQL Workbench, etc.)
# - Open create-followers-table.sql
# - Copy and run the SQL commands
```

### Step 2: Restart Your Application

```bash
# Stop your application (Ctrl+C or PM2 stop)
pm2 stop all

# Start your application
pm2 start ecosystem.config.js

# Or if running directly
npm start
```

### Step 3: Verify Installation

Test the API endpoints:

```bash
# Test: Get followers for a deal (should return empty array initially)
curl -X GET http://localhost:3000/api/followers/deal/1 \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected response:
# {
#   "statusCode": 200,
#   "status": "success",
#   "message": "Followers retrieved successfully",
#   "data": {
#     "count": 0,
#     "followers": []
#   }
# }
```

---

## 📚 API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/followers/:entityType/:entityId` | Add a follower |
| DELETE | `/api/followers/:entityType/:entityId/:userId` | Remove a follower |
| GET | `/api/followers/:entityType/:entityId` | Get all followers |
| GET | `/api/followers/:entityType/:entityId/count` | Get follower count |
| GET | `/api/followers/:entityType/:entityId/check/:userId` | Check if following |
| GET | `/api/followers/user/:userId` | Get user's following list |
| POST | `/api/followers/:entityType/:entityId/bulk` | Bulk add followers |
| DELETE | `/api/followers/:entityType/:entityId/bulk` | Bulk remove followers |

**Entity Types:** `deal`, `lead`, `person`, `organization`

---

## 🎯 Quick Testing Examples

### 1. Add a Follower to a Deal

```bash
curl -X POST http://localhost:3000/api/followers/deal/1 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId": 5}'
```

### 2. Get All Followers for a Lead

```bash
curl -X GET http://localhost:3000/api/followers/lead/10 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Remove a Follower from a Person

```bash
curl -X DELETE http://localhost:3000/api/followers/person/25/5 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Get What a User is Following

```bash
curl -X GET http://localhost:3000/api/followers/user/5 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5. Bulk Add Followers to an Organization

```bash
curl -X POST http://localhost:3000/api/followers/organization/15/bulk \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userIds": [5, 10, 15, 20]}'
```

---

## 🔧 Frontend Integration Example

### React/Vue Component Example

```javascript
// Add follower button component
const FollowButton = ({ entityType, entityId, userId, initialFollowing }) => {
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  const toggleFollow = async () => {
    setLoading(true);
    try {
      if (isFollowing) {
        // Unfollow
        await fetch(`/api/followers/${entityType}/${entityId}/${userId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        });
        setIsFollowing(false);
      } else {
        // Follow
        await fetch(`/api/followers/${entityType}/${entityId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId })
        });
        setIsFollowing(true);
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
    setLoading(false);
  };

  return (
    <button onClick={toggleFollow} disabled={loading}>
      {isFollowing ? 'Unfollow' : 'Follow'}
    </button>
  );
};
```

### Display Follower Count

```javascript
const FollowerCount = ({ entityType, entityId }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    fetch(`/api/followers/${entityType}/${entityId}/count`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setCount(data.data.count));
  }, [entityType, entityId]);

  return <span>{count} followers</span>;
};
```

---

## 📊 Database Schema

```
Followers Table Structure:
┌──────────────┬──────────────┬────────────────────────────────────┐
│ Field        │ Type         │ Description                        │
├──────────────┼──────────────┼────────────────────────────────────┤
│ followerId   │ INT (PK)     │ Auto-increment primary key         │
│ entityType   │ ENUM         │ deal/lead/person/organization      │
│ entityId     │ INT          │ ID of the entity being followed    │
│ userId       │ INT (FK)     │ User who is following              │
│ masterUserID │ INT (FK)     │ Organization ID (multi-tenancy)    │
│ addedAt      │ DATETIME     │ When user started following        │
│ addedBy      │ INT (FK)     │ Who added the follower             │
└──────────────┴──────────────┴────────────────────────────────────┘

Indexes:
- UNIQUE: (entityType, entityId, userId) - Prevent duplicate follows
- INDEX: (entityType, entityId) - Fast entity follower lookup
- INDEX: (userId) - Fast user following lookup
- INDEX: (masterUserID) - Multi-tenancy filtering
```

---

## ✨ Features Included

✅ **Multi-entity Support:** Follow deals, leads, persons, and organizations  
✅ **Bulk Operations:** Add/remove multiple followers at once  
✅ **User Following List:** See all entities a user follows  
✅ **Follow Status Check:** Check if a user is following an entity  
✅ **Follower Count:** Get total follower count for any entity  
✅ **Multi-tenancy:** Isolated by organization (masterUserID)  
✅ **Authentication:** All endpoints require valid JWT token  
✅ **Associations:** Proper Sequelize relationships  
✅ **Error Handling:** Comprehensive error responses with statusCode  
✅ **Documentation:** Complete API docs with examples  

---

## 🎨 UI Integration Ideas

### 1. Entity Detail Pages
Add a "Follow" button on:
- Deal detail page
- Lead detail page
- Person detail page
- Organization detail page

### 2. Follower List Component
Show all followers with:
- User avatars
- Names and roles
- "Added on" date

### 3. Following Feed
Create a dashboard showing:
- All entities the current user is following
- Recent activity on followed entities
- Quick access to followed items

### 4. Notification Integration
Send notifications when:
- Followed deal moves to next stage
- Followed lead is contacted
- Followed person has new activity
- Followed organization has updates

---

## 🔐 Security & Permissions

- All endpoints require authentication via JWT token
- Users can only follow entities within their organization (masterUserID)
- Entity existence is verified before allowing follow operations
- Duplicate follows are prevented by unique index

---

## 📝 Next Steps

1. ✅ **Database Setup** - Run the SQL migration
2. ✅ **Restart App** - Restart Node.js to load new routes
3. 🔲 **Frontend Integration** - Add follow buttons to your UI
4. 🔲 **Notification System** - Implement notifications for followed entities
5. 🔲 **Analytics** - Track which entities are most followed
6. 🔲 **Email Digests** - Send daily/weekly digests of followed entity updates

---

## 🐛 Troubleshooting

### Issue: "Table doesn't exist" error
**Solution:** Make sure you ran the SQL migration script

### Issue: "Cannot find module './follower/followerModel'"
**Solution:** Restart your Node.js application to load new files

### Issue: "404 Not Found" on follower endpoints
**Solution:** Check that follower routes are registered in app.js (already done)

### Issue: Foreign key constraint fails
**Solution:** Ensure the userId exists in the MasterUsers table

---

## 📞 Support

For complete API documentation, see: `FOLLOWER_API_DOCUMENTATION.md`

For questions or issues, please contact the development team.

---

**🎉 Congratulations! The follower feature is ready to use!**
