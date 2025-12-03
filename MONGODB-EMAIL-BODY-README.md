# MongoDB Email Body Storage Implementation

## Overview

This implementation moves email body storage from MySQL to MongoDB for better performance and scalability. The system provides:

- **Hybrid Storage**: MongoDB for email bodies, MySQL for structured email metadata
- **Automatic Migration**: Seamless migration from MySQL to MongoDB
- **Performance Optimization**: Reduced MySQL table size and improved query performance
- **Body Processing**: Intelligent cleaning and CID reference replacement
- **Backward Compatibility**: Maintains existing API contracts

## Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    MySQL    │    │   MongoDB   │    │    IMAP     │
│   (Email    │    │  (Bodies)   │    │  (Source)   │
│  Metadata)  │    │             │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                    ┌─────────────┐
                    │ getOneEmail │
                    │     API     │
                    └─────────────┘
```

## Key Components

### 1. EmailBody MongoDB Model (`models/mongodb/emailBodyModel.js`)

```javascript
{
  emailID: String,           // Reference to MySQL email record
  masterUserID: Number,      // User identifier
  bodyHtml: String,          // HTML content
  bodyText: String,          // Plain text content
  processedBody: String,     // Cleaned body for display
  fetchStatus: String,       // 'pending', 'completed', 'failed'
  metadata: {
    originalSize: Number,
    processedSize: Number,
    contentType: String,
    hasImages: Boolean,
    hasAttachments: Boolean,
    hasCidReferences: Boolean,
    encoding: String
  },
  source: {
    provider: String,        // 'gmail', 'outlook', etc.
    imapFolder: String,
    messageId: String,
    uid: Number
  },
  performance: {
    fetchTime: Number,
    cleanTime: Number,
    saveTime: Number
  },
  originalContent: {         // For migration verification
    enabled: Boolean,
    bodyHtml: String,
    bodyText: String
  }
}
```

### 2. EmailBodyMongoService (`services/emailBodyMongoService.js`)

Core service providing:

- **saveEmailBody**: Store email body with processing
- **getEmailBody**: Retrieve and optionally clean email body
- **hasEmailBody**: Check if body exists in MongoDB
- **migrateEmailBodyFromMySQL**: Migration utility
- **updateBodyStatus**: Status management
- **deleteEmailBody**: Cleanup operations
- **getBodyStatistics**: Analytics and monitoring
- **cleanupOldBodies**: Maintenance operations

### 3. Updated getOneEmail API

The `getOneEmail` API now follows this flow:

1. **MongoDB Check**: First try to get body from MongoDB
2. **MySQL Fallback**: If not in MongoDB, check MySQL
3. **On-Demand Fetch**: If missing, fetch from IMAP
4. **MongoDB Save**: Store fetched body in MongoDB
5. **MySQL Cleanup**: Clear MySQL body to save space
6. **Migration**: Automatically migrate existing MySQL bodies

## Usage Examples

### Basic Email Body Retrieval

```javascript
const EmailBodyMongoService = require('./services/emailBodyMongoService');

// Get email body with cleaning
const result = await EmailBodyMongoService.getEmailBody(
  'email-123', 
  1, 
  {
    cleanBody: true,
    preserveOriginal: false,
    attachments: emailAttachments
  }
);

if (result.success) {
  console.log('Body:', result.body);
  console.log('Length:', result.body.length);
}
```

### Save Email Body

```javascript
// Save fetched email body
const bodyData = {
  bodyHtml: '<html><body>Email content</body></html>',
  bodyText: 'Email content'
};

const saveResult = await EmailBodyMongoService.saveEmailBody(
  'email-123',
  1,
  bodyData,
  {
    shouldClean: true,
    attachments: attachments,
    provider: 'gmail'
  }
);
```

### Migration from MySQL

```javascript
// Migrate existing MySQL body to MongoDB
const migrationResult = await EmailBodyMongoService.migrateEmailBodyFromMySQL(
  'email-123',
  1,
  mysqlBodyContent,
  attachments
);
```

## API Endpoints

### Check Email Body Status
```
GET /api/mongodb/email-body/:emailId/check
```

### Get Email Body
```
GET /api/mongodb/email-body/:emailId?preserveOriginal=false&cleanBody=true
```

### Migrate Email Body
```
POST /api/mongodb/email-body/:emailId/migrate
Body: { mysqlBody: "...", attachments: [...] }
```

### Get Statistics
```
GET /api/mongodb/email-body/stats
```

### Cleanup Old Bodies
```
DELETE /api/mongodb/email-body/cleanup?daysOld=365&dryRun=true
```

## 🚀 Performance Optimization

The MongoDB integration includes several performance optimizations:

### 1. Smart Body Retrieval
- **MongoDB First**: Always checks MongoDB for existing processed bodies
- **Processed Body Cache**: Uses pre-processed bodies when available (skips cleaning)
- **Fallback Strategy**: Falls back to MySQL if MongoDB is unavailable

### 2. Redundancy Elimination
- **Skip Processing**: If body comes from MongoDB and is already processed, skips expensive cleaning operations
- **MySQL Cleanup**: Clears MySQL body storage after successful MongoDB migration
- **Single Source**: Eliminates duplicate body storage between MySQL and MongoDB

### 3. Optimization Indicators
Look for these console logs to verify optimization is working:

```javascript
// ✅ Optimized (using MongoDB processed body)
"[getOneEmail] 🚀 MONGODB: Successfully retrieved processed body from MongoDB"
"[getOneEmail] ⚡ MONGODB: Using pre-processed body from MongoDB, skipping cleaning"

// ⚠️ Not optimized (first-time migration or fallback)
"[getOneEmail] 💾 MIGRATION: Migrating email body to MongoDB"
"[getOneEmail] 🔧 AFTER CLEAN: Email body length" // Processing occurred
```

### Before (MySQL Only)
- Large `Emails.body` column impacting all queries
- Full table scans for email retrieval
- Memory pressure from large text fields
- Backup and replication overhead

### After (MongoDB Hybrid)
- Smaller MySQL tables with faster queries
- Selective body loading when needed
- Better memory utilization
- Optimized storage for text content

## Migration Strategy

### Phase 1: Parallel Storage
- New bodies saved to both MySQL and MongoDB
- API reads from MySQL for backward compatibility
- Background migration of existing bodies

### Phase 2: MongoDB Primary (Current)
- API reads from MongoDB first, MySQL fallback
- New bodies saved to MongoDB only
- MySQL bodies cleared after successful MongoDB save

### Phase 3: MongoDB Only (Future)
- Complete removal of MySQL body column
- Full MongoDB-based body storage
- Legacy MySQL cleanup

## Monitoring and Maintenance

### Statistics Monitoring
```javascript
const stats = await EmailBodyMongoService.getBodyStatistics(userID);
// Returns: totalBodies, statusBreakdown, performance metrics
```

### Cleanup Operations
```javascript
// Dry run to see what would be deleted
const dryRun = await EmailBodyMongoService.cleanupOldBodies(365, true);

// Actual cleanup
const cleanup = await EmailBodyMongoService.cleanupOldBodies(365, false);
```

### Health Checks
```javascript
// Check MongoDB connection
GET /api/mongodb/health

// Check specific user's body storage
GET /api/mongodb/email-body/stats
```

## Error Handling

The system includes comprehensive error handling:

- **MongoDB Unavailable**: Falls back to MySQL
- **Migration Failures**: Continues with existing data
- **Fetch Failures**: Marks status appropriately
- **Partial Data**: Graceful degradation

## Testing

Run the test suite:

```bash
node test-mongodb-email-body.js
```

This tests:
- Body saving and retrieval
- Migration functionality
- Statistics and monitoring
- Cleanup operations
- Error scenarios

## Configuration

### MongoDB Connection
```javascript
// config/mongodb.js
const connectMongoDB = async () => {
  await mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
};
```

### Environment Variables
```env
MONGODB_URI=mongodb://localhost:27017/pipedrive_crm
```

## Future Enhancements

1. **Compression**: Implement body compression for storage efficiency
2. **Indexing**: Add text search indexes for email content search
3. **Caching**: Redis cache layer for frequently accessed bodies
4. **Analytics**: Advanced analytics on email content patterns
5. **Archiving**: Tiered storage with cold storage for old emails

## Troubleshooting

### Common Issues

1. **MongoDB Connection Errors**
   - Check connection string
   - Verify MongoDB service is running
   - Check network connectivity

2. **Migration Failures**
   - Check email body encoding
   - Verify attachment references
   - Monitor memory usage during migration

3. **Performance Issues**
   - Monitor MongoDB indexes
   - Check query patterns
   - Optimize cleaning operations

### Logging

The system provides detailed logging:
- `[getOneEmail]` - API operations
- `[EmailBodyMongoService]` - Service operations
- `[MONGODB]` - MongoDB-specific operations
- `[MIGRATION]` - Migration operations

## Security Considerations

- Email bodies may contain sensitive information
- MongoDB access should be properly secured
- Consider encryption for sensitive content
- Implement proper access controls
- Regular security audits recommended

## Conclusion

This MongoDB email body storage implementation provides a scalable, performant solution for handling large email content while maintaining backward compatibility with existing systems. The hybrid approach ensures reliability while enabling future growth and optimization.