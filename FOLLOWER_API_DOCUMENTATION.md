# Follower API Documentation

## Overview
The Follower API allows users to follow deals, leads, persons, and organizations in the CRM system. This enables users to stay updated on entities they're interested in, even if they're not the owner.

## Table of Contents
- [Database Setup](#database-setup)
- [API Endpoints](#api-endpoints)
- [Request/Response Examples](#requestresponse-examples)
- [Use Cases](#use-cases)
- [Error Handling](#error-handling)

---

## Database Setup

### 1. Run the SQL Migration
Execute the SQL file to create the Followers table:
```bash
mysql -u your_username -p your_database < create-followers-table.sql
```

### 2. Restart Your Application
After creating the table, restart your Node.js application to sync the Sequelize model.

---

## API Endpoints

All follower endpoints require authentication via the `verifyToken` middleware.

### Base URL
```
/api/followers
```

### Entity Types
Valid entity types: `deal`, `lead`, `person`, `organization`

---

## 1. Add a Follower

**Endpoint:** `POST /api/followers/:entityType/:entityId`

**Description:** Add a user as a follower to a specific entity.

**Parameters:**
- `entityType` (path) - Type of entity (deal, lead, person, organization)
- `entityId` (path) - ID of the entity to follow

**Request Body:**
```json
{
  "userId": 5
}
```

**Success Response (201):**
```json
{
  "statusCode": 201,
  "status": "success",
  "message": "Follower added successfully",
  "data": {
    "followerId": 1,
    "entityType": "deal",
    "entityId": 10,
    "userId": 5,
    "masterUserID": 1,
    "addedAt": "2026-01-06T10:30:00.000Z",
    "addedBy": 3
  }
}
```

**Error Response (409 - Already Following):**
```json
{
  "statusCode": 409,
  "status": "error",
  "message": "User is already following this entity",
  "data": { ... }
}
```

---

## 2. Remove a Follower

**Endpoint:** `DELETE /api/followers/:entityType/:entityId/:userId`

**Description:** Remove a user from following a specific entity.

**Parameters:**
- `entityType` (path) - Type of entity
- `entityId` (path) - ID of the entity
- `userId` (path) - ID of the user to unfollow

**Success Response (200):**
```json
{
  "statusCode": 200,
  "status": "success",
  "message": "Follower removed successfully"
}
```

**Error Response (404):**
```json
{
  "statusCode": 404,
  "status": "error",
  "message": "Follower relationship not found"
}
```

---

## 3. Get All Followers

**Endpoint:** `GET /api/followers/:entityType/:entityId`

**Description:** Get all followers for a specific entity with user details.

**Parameters:**
- `entityType` (path) - Type of entity
- `entityId` (path) - ID of the entity

**Success Response (200):**
```json
{
  "statusCode": 200,
  "status": "success",
  "message": "Followers retrieved successfully",
  "data": {
    "count": 3,
    "followers": [
      {
        "followerId": 1,
        "entityType": "deal",
        "entityId": 10,
        "userId": 5,
        "addedAt": "2026-01-06T10:30:00.000Z",
        "user": {
          "masterUserID": 5,
          "name": "John Doe",
          "email": "john@example.com",
          "profilePhoto": "https://..."
        }
      },
      // ... more followers
    ]
  }
}
```

---

## 4. Get Follower Count

**Endpoint:** `GET /api/followers/:entityType/:entityId/count`

**Description:** Get the total count of followers for an entity.

**Success Response (200):**
```json
{
  "statusCode": 200,
  "status": "success",
  "message": "Follower count retrieved successfully",
  "data": {
    "count": 5
  }
}
```

---

## 5. Check if User is Following

**Endpoint:** `GET /api/followers/:entityType/:entityId/check/:userId`

**Description:** Check if a specific user is following an entity.

**Parameters:**
- `entityType` (path) - Type of entity
- `entityId` (path) - ID of the entity
- `userId` (path) - ID of the user to check

**Success Response (200):**
```json
{
  "statusCode": 200,
  "status": "success",
  "message": "Follow status checked successfully",
  "data": {
    "isFollowing": true,
    "follower": {
      "followerId": 1,
      "entityType": "deal",
      "entityId": 10,
      "userId": 5,
      "addedAt": "2026-01-06T10:30:00.000Z"
    }
  }
}
```

---

## 6. Get User's Following List

**Endpoint:** `GET /api/followers/user/:userId`

**Description:** Get all entities that a user is following.

**Parameters:**
- `userId` (path) - ID of the user

**Query Parameters:**
- `entityType` (optional) - Filter by entity type (deal, lead, person, organization)

**Success Response (200):**
```json
{
  "statusCode": 200,
  "status": "success",
  "message": "User following retrieved successfully",
  "data": {
    "totalCount": 15,
    "groupedFollowing": {
      "deals": [
        {
          "followerId": 1,
          "entityType": "deal",
          "entityId": 10,
          "addedAt": "2026-01-06T10:30:00.000Z"
        }
      ],
      "leads": [ ... ],
      "persons": [ ... ],
      "organizations": [ ... ]
    },
    "following": [ ... ]
  }
}
```

---

## 7. Bulk Add Followers

**Endpoint:** `POST /api/followers/:entityType/:entityId/bulk`

**Description:** Add multiple users as followers to an entity at once.

**Request Body:**
```json
{
  "userIds": [5, 10, 15, 20]
}
```

**Success Response (201):**
```json
{
  "statusCode": 201,
  "status": "success",
  "message": "Bulk followers added successfully",
  "data": {
    "added": 3,
    "skipped": 1,
    "total": 4,
    "followers": [ ... ]
  }
}
```

---

## 8. Bulk Remove Followers

**Endpoint:** `DELETE /api/followers/:entityType/:entityId/bulk`

**Description:** Remove multiple followers from an entity at once.

**Request Body:**
```json
{
  "userIds": [5, 10, 15]
}
```

**Success Response (200):**
```json
{
  "statusCode": 200,
  "status": "success",
  "message": "Bulk followers removed successfully",
  "data": {
    "removed": 3,
    "total": 3
  }
}
```

---

## Request/Response Examples

### Example 1: Add Current User as Follower to a Deal

```javascript
// Frontend request
const response = await fetch('/api/followers/deal/123', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userId: 5  // Current user ID
  })
});

const data = await response.json();
console.log(data);
```

### Example 2: Get All Followers for a Lead

```javascript
const response = await fetch('/api/followers/lead/456', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  }
});

const data = await response.json();
console.log(`Lead has ${data.data.count} followers`);
```

### Example 3: Check if User is Following a Person

```javascript
const userId = 5;
const personId = 789;

const response = await fetch(`/api/followers/person/${personId}/check/${userId}`, {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  }
});

const data = await response.json();
if (data.data.isFollowing) {
  console.log('User is following this person');
}
```

---

## Use Cases

### 1. Sales Team Collaboration
- Sales reps can follow deals they're assisting with (even if not the owner)
- Get notifications when followed deals are updated

### 2. Lead Management
- Marketing team members can follow leads they've generated
- Track lead progress through the pipeline

### 3. Contact Tracking
- Follow key contacts (persons/organizations) for relationship management
- Stay informed about interactions with important contacts

### 4. Manager Oversight
- Managers can follow all deals in their team's pipeline
- Monitor progress without being the direct owner

---

## Error Handling

### Common Error Codes

| Status Code | Meaning | Common Cause |
|------------|---------|--------------|
| 400 | Bad Request | Invalid entity type or missing required fields |
| 404 | Not Found | Entity or follower relationship doesn't exist |
| 409 | Conflict | User is already following the entity |
| 500 | Server Error | Database or server issue |

### Error Response Format
```json
{
  "statusCode": 400,
  "status": "error",
  "message": "Descriptive error message",
  "error": "Technical error details (in development)"
}
```

---

## Integration Notes

### Frontend Integration

1. **Follow/Unfollow Button:**
```javascript
const toggleFollow = async (entityType, entityId, userId, isFollowing) => {
  const endpoint = `/api/followers/${entityType}/${entityId}`;
  
  if (isFollowing) {
    // Unfollow
    await fetch(`${endpoint}/${userId}`, { method: 'DELETE', ... });
  } else {
    // Follow
    await fetch(endpoint, { 
      method: 'POST', 
      body: JSON.stringify({ userId }),
      ...
    });
  }
};
```

2. **Display Follower Count:**
```javascript
const getFollowerCount = async (entityType, entityId) => {
  const response = await fetch(`/api/followers/${entityType}/${entityId}/count`, ...);
  const data = await response.json();
  return data.data.count;
};
```

### Backend Integration

- The `followers_count` field in custom fields will need to be calculated dynamically
- Use the follower count API or add a computed field to entity APIs

---

## Database Schema

```sql
Followers Table:
- followerId (PK, AUTO_INCREMENT)
- entityType (ENUM: deal, lead, person, organization)
- entityId (INT)
- userId (INT, FK to MasterUsers)
- masterUserID (INT, FK to MasterUsers)
- addedAt (DATETIME)
- addedBy (INT, nullable, FK to MasterUsers)

Indexes:
- UNIQUE (entityType, entityId, userId)
- INDEX (entityType, entityId)
- INDEX (userId)
- INDEX (masterUserID)
```

---

## Security Notes

1. **Multi-tenancy:** All queries filter by `masterUserID` to ensure data isolation
2. **Authentication:** All endpoints require valid JWT token via `verifyToken`
3. **Authorization:** Users can only follow entities within their organization
4. **Validation:** Entity existence is verified before allowing follow actions

---

## Future Enhancements

Potential features for future releases:
- Real-time notifications when followed entities are updated
- Email digests for followers
- Follow permissions (allow/deny certain users from following)
- Activity feed showing updates to followed entities
- Bulk follow operations from search results

---

## Support

For issues or questions about the Follower API, please contact the development team or create an issue in the repository.
