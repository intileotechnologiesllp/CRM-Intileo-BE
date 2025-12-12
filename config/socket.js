const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

let io = null;

/**
 * Initialize Socket.IO with HTTP server
 * @param {Object} server - HTTP server instance
 */
function initializeSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(" ")[1];
      
      if (!token) {
        return next(new Error("Authentication token required"));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.userData = decoded;
      
      console.log(`✅ [Socket.IO] User ${decoded.userId} authenticated`);
      next();
    } catch (error) {
      console.error("❌ [Socket.IO] Authentication failed:", error.message);
      next(new Error("Authentication failed"));
    }
  });

  // Connection handling
  io.on("connection", (socket) => {
    const userId = socket.userId;
    console.log(`🔌 [Socket.IO] User ${userId} connected (Socket ID: ${socket.id})`);

    // Join user's personal room
    socket.join(`user_${userId}`);

    // Handle joining additional rooms (e.g., deal rooms, team rooms)
    socket.on("join_room", (roomName) => {
      socket.join(roomName);
      console.log(`👥 [Socket.IO] User ${userId} joined room: ${roomName}`);
    });

    socket.on("leave_room", (roomName) => {
      socket.leave(roomName);
      console.log(`👋 [Socket.IO] User ${userId} left room: ${roomName}`);
    });

    // Handle notification read status
    socket.on("notification_read", (notificationId) => {
      console.log(`✓ [Socket.IO] User ${userId} marked notification ${notificationId} as read`);
      // Emit back to user for real-time UI update
      socket.emit("notification_updated", { notificationId, isRead: true });
    });

    // Handle user typing indicators (for comments, chat, etc.)
    socket.on("typing_start", (data) => {
      socket.to(data.room).emit("user_typing", {
        userId,
        userName: socket.userData.name,
        room: data.room,
      });
    });

    socket.on("typing_stop", (data) => {
      socket.to(data.room).emit("user_stopped_typing", {
        userId,
        room: data.room,
      });
    });

    // Handle presence updates
    socket.on("update_presence", (status) => {
      io.emit("user_presence", {
        userId,
        status, // online, away, busy, offline
        timestamp: new Date(),
      });
    });

    // Disconnection handling
    socket.on("disconnect", (reason) => {
      console.log(`🔌 [Socket.IO] User ${userId} disconnected: ${reason}`);
      
      // Broadcast user offline status
      io.emit("user_presence", {
        userId,
        status: "offline",
        timestamp: new Date(),
      });
    });
  });

  console.log("✅ [Socket.IO] Server initialized");
  return io;
}

/**
 * Get Socket.IO instance
 * @returns {Object} Socket.IO instance
 */
function getIO() {
  if (!io) {
    throw new Error("Socket.IO not initialized. Call initializeSocket() first.");
  }
  return io;
}

/**
 * Emit notification to specific user
 * @param {Number} userId - User ID to send notification to
 * @param {String} event - Event name
 * @param {Object} data - Notification data
 */
function emitToUser(userId, event, data) {
  if (io) {
    io.to(`user_${userId}`).emit(event, data);
    console.log(`📤 [Socket.IO] Emitted '${event}' to user ${userId}`);
  }
}

/**
 * Emit notification to multiple users
 * @param {Array} userIds - Array of user IDs
 * @param {String} event - Event name
 * @param {Object} data - Notification data
 */
function emitToUsers(userIds, event, data) {
  if (io) {
    userIds.forEach((userId) => {
      io.to(`user_${userId}`).emit(event, data);
    });
    console.log(`📤 [Socket.IO] Emitted '${event}' to ${userIds.length} users`);
  }
}

/**
 * Emit to a specific room
 * @param {String} room - Room name
 * @param {String} event - Event name
 * @param {Object} data - Notification data
 */
function emitToRoom(room, event, data) {
  if (io) {
    io.to(room).emit(event, data);
    console.log(`📤 [Socket.IO] Emitted '${event}' to room ${room}`);
  }
}

/**
 * Broadcast to all connected clients
 * @param {String} event - Event name
 * @param {Object} data - Notification data
 */
function broadcast(event, data) {
  if (io) {
    io.emit(event, data);
    console.log(`📢 [Socket.IO] Broadcast '${event}' to all users`);
  }
}

/**
 * Get connected users count
 * @returns {Number} Number of connected users
 */
async function getConnectedUsersCount() {
  if (io) {
    const sockets = await io.fetchSockets();
    return sockets.length;
  }
  return 0;
}

/**
 * Check if user is online
 * @param {Number} userId - User ID to check
 * @returns {Boolean} Whether user is connected
 */
async function isUserOnline(userId) {
  if (io) {
    const socketsInRoom = await io.in(`user_${userId}`).fetchSockets();
    return socketsInRoom.length > 0;
  }
  return false;
}

module.exports = {
  initializeSocket,
  getIO,
  emitToUser,
  emitToUsers,
  emitToRoom,
  broadcast,
  getConnectedUsersCount,
  isUserOnline,
};
