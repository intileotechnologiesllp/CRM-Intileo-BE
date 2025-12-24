# Notification Socket Test Guide

## Quick Test Instructions

### Step 1: Start the Socket Test Client
```powershell
# Set your JWT token (replace with actual token)
$env:TEST_JWT = "eyJ..."

# Set API URL (optional, defaults to localhost:4001)
$env:SOCKET_URL = "http://localhost:4001"

# Start the socket listener
node test-notification-socket.js
```

### Step 2: In a new terminal, trigger the notification
```powershell
# Set the same JWT token
$env:TEST_JWT = "eyJ..."

# Set API URL (optional)
$env:API_URL = "http://localhost:4001"

# Trigger notification creation
node test-notification-api.js
```

### Step 3: Alternative - Use PowerShell directly
```powershell
# Set variables
$token = "YOUR_JWT_HERE"
$apiUrl = "http://localhost:4001"

# Create test notification
$body = @{
    type = "system"
    title = "PowerShell Test"
    message = "Testing notification emission"
    priority = "high"
} | ConvertTo-Json

Invoke-RestMethod -Uri "$apiUrl/api/notifications/test" -Method Post -Body $body -ContentType "application/json" -Headers @{ Authorization = "Bearer $token" }
```

## What to Look For

### Socket Client Output (test-notification-socket.js)
- ✅ "Socket connected successfully"
- 🔔 "RECEIVED: new_notification" 
- Check that User ID matches your JWT's userId claim
- Verify notification details are correct

### API Response (test-notification-api.js)  
- ✅ Status: 200
- 📋 Created notification with ID and user ID

### Server Logs
Look for these log messages in your backend:
- `🔔 [NotificationService] Step 7: Emitting to Socket.IO for userId: X`
- `📤 [Socket.IO] Emitted 'new_notification' to user X`

## Troubleshooting

### Socket Connection Issues
1. **JWT Token**: Ensure your JWT is valid and contains `userId` claim
2. **Server Running**: Check backend server is running on correct port
3. **Authentication**: Look for socket auth success in server logs

### No Notification Received
1. **User ID Mismatch**: Socket connects with one user, notification sent to different user
2. **Room Joining**: Check server logs for "User X joined room: user_X" 
3. **Preferences**: User may have notifications disabled in preferences

### Debug the User ID
Add this to check JWT payload:
```javascript
const jwt = require('jsonwebtoken');
const decoded = jwt.decode('YOUR_JWT_HERE');
console.log('JWT userId:', decoded.userId);
```

## Expected Flow

1. Socket connects → Server authenticates → Socket joins room `user_${userId}`
2. API call creates notification for `userId` 
3. `emitToUser(userId, "new_notification", payload)` sends to room `user_${userId}`
4. Socket client receives event if in correct room

## Files Created
- `test-notification-socket.js` - Socket client listener
- `test-notification-api.js` - API trigger script
- `README-notification-test.md` - This guide