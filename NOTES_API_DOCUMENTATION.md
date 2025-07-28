# Person and Organization Notes API Documentation

This document describes the complete CRUD (Create, Read, Update, Delete) operations for managing notes associated with Persons and Organizations.

## Models

### PersonNote Model

- **noteId**: Primary key, auto-increment
- **personId**: Foreign key to Person table
- **masterUserID**: Master user ID (required)
- **content**: Note content (TEXT LONG for large notes)
- **createdBy**: User who created the note
- **createdAt/updatedAt**: Timestamps

### OrganizationNote Model

- **noteId**: Primary key, auto-increment
- **leadOrganizationId**: Foreign key to Organization table
- **masterUserID**: Master user ID (required)
- **content**: Note content (TEXT LONG for large notes)
- **createdBy**: User who created the note
- **createdAt/updatedAt**: Timestamps

## API Endpoints

### Person Notes

#### 1. Create Person Note

**POST** `/api/lead-contacts/create-person-note/:personId`

**Headers:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "content": "This is a note about the person"
}
```

**Response:**

```json
{
  "message": "Note added to person successfully",
  "note": {
    "noteId": 1,
    "personId": 123,
    "content": "This is a note about the person",
    "createdBy": 456,
    "createdAt": "2024-01-01T12:00:00.000Z",
    "updatedAt": "2024-01-01T12:00:00.000Z",
    "creator": {
      "masterUserID": 456,
      "name": "John Doe"
    }
  }
}
```

#### 2. Get Person Notes

**GET** `/api/lead-contacts/get-person-notes/:personId?page=1&limit=20`

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "message": "Person notes fetched successfully",
  "pagination": {
    "total": 25,
    "page": 1,
    "limit": 20,
    "totalPages": 2
  },
  "notes": [
    {
      "noteId": 1,
      "personId": 123,
      "content": "This is a note about the person",
      "createdBy": 456,
      "createdAt": "2024-01-01T12:00:00.000Z",
      "updatedAt": "2024-01-01T12:00:00.000Z",
      "creator": {
        "masterUserID": 456,
        "name": "John Doe"
      }
    }
  ]
}
```

#### 3. Update Person Note

**PUT** `/api/lead-contacts/update-person-note/:personId/:noteId`

**Headers:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "content": "Updated note content"
}
```

**Response:**

```json
{
  "message": "Person note updated successfully",
  "note": {
    "noteId": 1,
    "personId": 123,
    "content": "Updated note content",
    "createdBy": 456,
    "createdAt": "2024-01-01T12:00:00.000Z",
    "updatedAt": "2024-01-01T12:30:00.000Z",
    "creator": {
      "masterUserID": 456,
      "name": "John Doe"
    }
  }
}
```

#### 4. Delete Person Note

**DELETE** `/api/lead-contacts/delete-person-note/:personId/:noteId`

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "message": "Person note deleted successfully"
}
```

### Organization Notes

#### 1. Create Organization Note

**POST** `/api/lead-contacts/create-organization-note/:leadOrganizationId`

**Headers:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "content": "This is a note about the organization"
}
```

**Response:**

```json
{
  "message": "Note added to organization successfully",
  "note": {
    "noteId": 1,
    "leadOrganizationId": 123,
    "content": "This is a note about the organization",
    "createdBy": 456,
    "createdAt": "2024-01-01T12:00:00.000Z",
    "updatedAt": "2024-01-01T12:00:00.000Z",
    "creator": {
      "masterUserID": 456,
      "name": "John Doe"
    }
  }
}
```

#### 2. Get Organization Notes

**GET** `/api/lead-contacts/get-organization-notes/:leadOrganizationId?page=1&limit=20`

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "message": "Organization notes fetched successfully",
  "pagination": {
    "total": 15,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  },
  "notes": [
    {
      "noteId": 1,
      "leadOrganizationId": 123,
      "content": "This is a note about the organization",
      "createdBy": 456,
      "createdAt": "2024-01-01T12:00:00.000Z",
      "updatedAt": "2024-01-01T12:00:00.000Z",
      "creator": {
        "masterUserID": 456,
        "name": "John Doe"
      }
    }
  ]
}
```

#### 3. Update Organization Note

**PUT** `/api/lead-contacts/update-organization-note/:leadOrganizationId/:noteId`

**Headers:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "content": "Updated organization note content"
}
```

**Response:**

```json
{
  "message": "Organization note updated successfully",
  "note": {
    "noteId": 1,
    "leadOrganizationId": 123,
    "content": "Updated organization note content",
    "createdBy": 456,
    "createdAt": "2024-01-01T12:00:00.000Z",
    "updatedAt": "2024-01-01T12:30:00.000Z",
    "creator": {
      "masterUserID": 456,
      "name": "John Doe"
    }
  }
}
```

#### 4. Delete Organization Note

**DELETE** `/api/lead-contacts/delete-organization-note/:leadOrganizationId/:noteId`

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "message": "Organization note deleted successfully"
}
```

## Error Responses

### Common Error Codes:

#### 400 - Bad Request

```json
{
  "message": "Note content is required."
}
```

#### 401 - Unauthorized

```json
{
  "message": "Access denied. No token provided."
}
```

#### 403 - Forbidden

```json
{
  "message": "You don't have permission to update this note."
}
```

#### 404 - Not Found

```json
{
  "message": "Person not found."
}
```

#### 500 - Internal Server Error

```json
{
  "message": "Internal server error"
}
```

## Usage Examples

### JavaScript/Fetch API

```javascript
// Create a person note
const createPersonNote = async (personId, content, token) => {
  const response = await fetch(
    `/api/lead-contacts/create-person-note/${personId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    }
  );
  return response.json();
};

// Get person notes with pagination
const getPersonNotes = async (personId, page = 1, limit = 20, token) => {
  const response = await fetch(
    `/api/lead-contacts/get-person-notes/${personId}?page=${page}&limit=${limit}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.json();
};

// Update a person note
const updatePersonNote = async (personId, noteId, content, token) => {
  const response = await fetch(
    `/api/lead-contacts/update-person-note/${personId}/${noteId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    }
  );
  return response.json();
};

// Delete a person note
const deletePersonNote = async (personId, noteId, token) => {
  const response = await fetch(
    `/api/lead-contacts/delete-person-note/${personId}/${noteId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.json();
};
```

## Security Features

1. **Authentication Required**: All note APIs require valid JWT token
2. **Permission Control**: Users can only update/delete notes they created (unless they're admin)
3. **Data Validation**: Content is required and trimmed before saving
4. **Entity Verification**: Checks if person/organization exists before creating notes
5. **SQL Injection Protection**: Uses Sequelize ORM with parameterized queries

## Database Migrations

If you need to create the database tables, here are the SQL commands:

```sql
-- PersonNotes table
CREATE TABLE PersonNotes (
  noteId INT AUTO_INCREMENT PRIMARY KEY,
  personId INT NOT NULL,
  masterUserID INT NOT NULL,
  content LONGTEXT NOT NULL,
  createdBy INT NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (personId) REFERENCES leadpeople(personId) ON DELETE CASCADE,
  FOREIGN KEY (createdBy) REFERENCES masterusers(masterUserID),
  FOREIGN KEY (masterUserID) REFERENCES masterusers(masterUserID)
);

-- OrganizationNotes table
CREATE TABLE OrganizationNotes (
  noteId INT AUTO_INCREMENT PRIMARY KEY,
  leadOrganizationId INT NOT NULL,
  masterUserID INT NOT NULL,
  content LONGTEXT NOT NULL,
  createdBy INT NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (leadOrganizationId) REFERENCES leadorganizations(leadOrganizationId) ON DELETE CASCADE,
  FOREIGN KEY (createdBy) REFERENCES masterusers(masterUserID),
  FOREIGN KEY (masterUserID) REFERENCES masterusers(masterUserID)
);
```
