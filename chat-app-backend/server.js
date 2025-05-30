const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.IO
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:5173", "https://chat-app-frontend-ph10.onrender.com"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://chat-app-frontend-ph10.onrender.com"
  ],
  credentials: true
}));
app.use(express.json());

// In-memory storage for chat rooms (no database needed)
const chatRooms = new Map();

// Room management functions
const createRoom = (roomCode) => {
  if (!chatRooms.has(roomCode)) {
    chatRooms.set(roomCode, {
      users: new Map(),
      messages: [],
      createdAt: new Date()
    });
  }
  return chatRooms.get(roomCode);
};

const getRoomUsers = (roomCode) => {
  const room = chatRooms.get(roomCode);
  return room ? Array.from(room.users.values()) : [];
};

const addUserToRoom = (roomCode, socketId, username) => {
  const room = createRoom(roomCode);
  
  // Check if room is full (max 2 users)
  if (room.users.size >= 2) {
    return false;
  }
  
  room.users.set(socketId, {
    id: socketId,
    username,
    joinedAt: new Date()
  });
  
  return true;
};

const removeUserFromRoom = (roomCode, socketId) => {
  const room = chatRooms.get(roomCode);
  if (room) {
    const user = room.users.get(socketId);
    room.users.delete(socketId);
    
    // Clean up empty rooms
    if (room.users.size === 0) {
      chatRooms.delete(roomCode);
      console.log(`🗑️  Room ${roomCode} deleted (empty)`);
    }
    
    return user;
  }
  return null;
};

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);
  
  let currentRoom = null;
  let currentUsername = null;

  // Handle joining a room
  socket.on('join-room', ({ roomCode, username }) => {
    console.log(`👤 ${username} trying to join room: ${roomCode}`);
    
    // Leave current room if in one
    if (currentRoom) {
      socket.leave(currentRoom);
      removeUserFromRoom(currentRoom, socket.id);
    }
    
    // Try to add user to new room
    const success = addUserToRoom(roomCode, socket.id, username);
    
    if (!success) {
      socket.emit('room-full');
      console.log(`❌ Room ${roomCode} is full`);
      return;
    }
    
    // Join the room
    socket.join(roomCode);
    currentRoom = roomCode;
    currentUsername = username;
    
    const roomUsers = getRoomUsers(roomCode);
    
    // Notify user they joined successfully
    socket.emit('room-joined', { 
      roomCode, 
      users: roomUsers.length 
    });
    
    // Notify other users in the room
    socket.to(roomCode).emit('user-joined', { 
      username, 
      users: roomUsers.length 
    });
    
    console.log(`✅ ${username} joined room ${roomCode} (${roomUsers.length}/2 users)`);
  });

  // Handle sending messages
  socket.on('send-message', (message) => {
    if (!currentRoom) return;
    
    console.log(`💬 Message in room ${currentRoom} from ${currentUsername}: ${message.type}`);
    
    // Add server timestamp
    const messageWithTimestamp = {
      ...message,
      serverTimestamp: new Date(),
      socketId: socket.id
    };
    
    // Store message in room (optional - for message history)
    const room = chatRooms.get(currentRoom);
    if (room) {
      room.messages.push(messageWithTimestamp);
      
      // Keep only last 100 messages per room to prevent memory issues
      if (room.messages.length > 100) {
        room.messages = room.messages.slice(-100);
      }
    }
    
    // Broadcast message to other users in the room
    socket.to(currentRoom).emit('message', messageWithTimestamp);
  });

  // Handle user disconnect
  socket.on('disconnect', () => {
    console.log(`🔌 User disconnected: ${socket.id}`);
    
    if (currentRoom && currentUsername) {
      const removedUser = removeUserFromRoom(currentRoom, socket.id);
      
      if (removedUser) {
        const remainingUsers = getRoomUsers(currentRoom);
        
        // Notify remaining users
        socket.to(currentRoom).emit('user-left', { 
          username: currentUsername,
          users: remainingUsers.length 
        });
        
        console.log(`👋 ${currentUsername} left room ${currentRoom} (${remainingUsers.length}/2 users remaining)`);
      }
    }
  });

  // Handle manual leave room
  socket.on('leave-room', () => {
    if (currentRoom && currentUsername) {
      socket.leave(currentRoom);
      const removedUser = removeUserFromRoom(currentRoom, socket.id);
      
      if (removedUser) {
        const remainingUsers = getRoomUsers(currentRoom);
        
        socket.to(currentRoom).emit('user-left', { 
          username: currentUsername,
          users: remainingUsers.length 
        });
        
        console.log(`👋 ${currentUsername} manually left room ${currentRoom}`);
      }
      
      currentRoom = null;
      currentUsername = null;
    }
  });
});

// Basic health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Privacy-First Chat Server is running!',
    activeRooms: chatRooms.size,
    timestamp: new Date().toISOString()
  });
});

// Get room statistics (optional - for monitoring)
app.get('/stats', (req, res) => {
  const stats = {
    totalRooms: chatRooms.size,
    rooms: []
  };
  
  chatRooms.forEach((room, roomCode) => {
    stats.rooms.push({
      code: roomCode,
      users: room.users.size,
      messages: room.messages.length,
      createdAt: room.createdAt
    });
  });
  
  res.json(stats);
});

// Cleanup old empty rooms periodically (every 30 minutes)
setInterval(() => {
  const now = new Date();
  let cleanedRooms = 0;
  
  chatRooms.forEach((room, roomCode) => {
    // Remove rooms that are empty and older than 1 hour
    const roomAge = now - room.createdAt;
    const oneHour = 60 * 60 * 1000;
    
    if (room.users.size === 0 && roomAge > oneHour) {
      chatRooms.delete(roomCode);
      cleanedRooms++;
    }
  });
  
  if (cleanedRooms > 0) {
    console.log(`🧹 Cleaned up ${cleanedRooms} old empty rooms`);
  }
}, 30 * 60 * 1000); // 30 minutes

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Privacy-First Chat Server running on port ${PORT}`);
  console.log(`🔒 No data persistence - messages live only during active sessions`);
  console.log(`👥 Maximum 2 users per room`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Server shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});