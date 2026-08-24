const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.json());
app.use(express.static('public'));

// Global State Variables
let waitingQueue = [];
let activeRooms = {};
let onlineUsers = {}; // username -> socket.id Mapping
let pendingRequests = {}; // targetUser -> Array of senders
let userScores = {}; // username -> { elo, coins } (Leaderboard Data)

io.on('connection', (socket) => {

  // Register User & Leaderboard Sync
  socket.on('registerUser', (data) => {
    const username = typeof data === 'string' ? data : data.username;
    if (!username) return;

    socket.username = username;
    onlineUsers[username] = socket.id;

    if (typeof data === 'object' && data.username) {
      userScores[username] = {
        elo: data.elo || 1200,
        coins: data.coins || 500
      };
    } else if (!userScores[username]) {
      userScores[username] = { elo: 1200, coins: 500 };
    }

    // Leaderboard Update Broadcast
    io.emit('updateLeaderboard', getLeaderboardData());

    // Send pending friend requests if any
    if (pendingRequests[username]) {
      socket.emit('updatePendingRequests', pendingRequests[username]);
    }
  });

  // Real-time Stats Update (Elo / Coins change)
  socket.on('updateStats', (data) => {
    if (data && data.username) {
      userScores[data.username] = { 
        elo: data.elo !== undefined ? data.elo : 1200, 
        coins: data.coins !== undefined ? data.coins : 500 
      };
      io.emit('updateLeaderboard', getLeaderboardData());
    }
  });

  // Matchmaking System
  socket.on('findMatch', (data) => {
    if (!data || !data.username) return;

    waitingQueue = waitingQueue.filter(p => p.socketId !== socket.id && p.username !== data.username);

    if (waitingQueue.length > 0) {
      const opponent = waitingQueue.shift();
      const roomId = `room_${socket.id}_${opponent.socketId}`;

      socket.join(roomId);
      const oppSocket = io.sockets.sockets.get(opponent.socketId);
      if (oppSocket) oppSocket.join(roomId);

      activeRooms[roomId] = {
        white: socket.id,
        whiteUser: data.username,
        black: opponent.socketId,
        blackUser: opponent.username,
        whiteTime: 300,
        blackTime: 300,
        currentTurn: 'w',
        interval: null
      };

      io.to(socket.id).emit('matchFound', { roomId, color: 'w', opponent: opponent.username });
      io.to(opponent.socketId).emit('matchFound', { roomId, color: 'b', opponent: data.username });

      startTimer(roomId);
    } else {
      waitingQueue.push({ socketId: socket.id, username: data.username });
    }
  });

  socket.on('cancelMatch', () => {
    waitingQueue = waitingQueue.filter(p => p.socketId !== socket.id);
  });

  // Custom Room System
  socket.on('createCustomRoom', (data) => {
    if (!data || !data.username) return;

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const timeInSecs = (data.minutes || 5) * 60;

    socket.join(code);
    activeRooms[code] = {
      white: socket.id,
      whiteUser: data.username,
      black: null,
      blackUser: null,
      whiteTime: timeInSecs,
      blackTime: timeInSecs,
      currentTurn: 'w',
      interval: null
    };
    socket.emit('customRoomCreated', { roomCode: code });
  });

  socket.on('joinCustomRoom', (data) => {
    if (!data || !data.roomCode) return;

    const room = activeRooms[data.roomCode];
    if (!room) return socket.emit('roomError', 'အခန်းသင်္ကေတ မှားယွင်းနေပါသည်။');
    if (room.black) return socket.emit('roomError', 'အခန်းပြည့်သွားပါပြီ။');

    socket.join(data.roomCode);
    room.black = socket.id;
    room.blackUser = data.username;

    io.to(room.white).emit('matchFound', { roomId: data.roomCode, color: 'w', opponent: data.username });
    io.to(socket.id).emit('matchFound', { roomId: data.roomCode, color: 'b', opponent: room.whiteUser });

    startTimer(data.roomCode);
  });

  // Friend Request Logic
  socket.on('sendFriendRequest', (data) => {
    if (!data || !data.target || !data.sender) return;

    const { sender, target } = data;
    if (!pendingRequests[target]) pendingRequests[target] = [];

    if (!pendingRequests[target].includes(sender)) {
      pendingRequests[target].push(sender);
    }

    const targetSocketId = onlineUsers[target];
    if (targetSocketId) {
      io.to(targetSocketId).emit('updatePendingRequests', pendingRequests[target]);
    }
  });

  socket.on('respondFriendRequest', (data) => {
    if (!data || !data.target || !data.sender) return;

    const { sender, target, accept } = data;

    if (pendingRequests[target]) {
      pendingRequests[target] = pendingRequests[target].filter(u => u !== sender);
    }

    const targetSocketId = onlineUsers[target];
    if (targetSocketId) {
      io.to(targetSocketId).emit('updatePendingRequests', pendingRequests[target] || []);
    }

    if (accept) {
      const senderSocketId = onlineUsers[sender];
      if (senderSocketId) io.to(senderSocketId).emit('friendRequestAccepted', { friendName: target });
      socket.emit('friendRequestAccepted', { friendName: sender });
    }
  });

  // In-Game Gameplay Actions
  socket.on('makeMove', (data) => {
    if (!data || !data.roomId) return;

    const room = activeRooms[data.roomId];
    if (room) {
      socket.to(data.roomId).emit('opponentMove', data.move);
      room.currentTurn = room.currentTurn === 'w' ? 'b' : 'w';
    }
  });

  socket.on('sendEmote', (data) => {
    if (data && data.roomId) {
      io.to(data.roomId).emit('receiveEmote', { sender: data.sender, emote: data.emote });
    }
  });

  socket.on('sendChatMessage', (data) => {
    if (data && data.roomId) {
      io.to(data.roomId).emit('receiveChatMessage', { sender: data.sender, text: data.text });
    }
  });

  // Spectator System
  socket.on('spectateRoom', (roomId) => {
    if (roomId && activeRooms[roomId]) {
      socket.join(roomId);
      socket.emit('spectateSuccess', { roomId });
    }
  });

  socket.on('leaveGame', (data) => {
    if (data && data.roomId) {
      handleLeave(socket, data.roomId);
    }
  });

  socket.on('disconnect', () => {
    if (socket.username) {
      delete onlineUsers[socket.username];
    }
    waitingQueue = waitingQueue.filter(p => p.socketId !== socket.id);
    for (const [roomId, room] of Object.entries(activeRooms)) {
      if (room.white === socket.id || room.black === socket.id) {
        handleLeave(socket, roomId);
      }
    }
  });
});

// Helper Functions
function startTimer(roomId) {
  const room = activeRooms[roomId];
  if (!room) return;
  if (room.interval) clearInterval(room.interval);

  room.interval = setInterval(() => {
    if (room.currentTurn === 'w') {
      room.whiteTime--;
      if (room.whiteTime <= 0) {
        clearInterval(room.interval);
        io.to(roomId).emit('gameOver', { winner: 'b', reason: 'Time Out' });
      }
    } else {
      room.blackTime--;
      if (room.blackTime <= 0) {
        clearInterval(room.interval);
        io.to(roomId).emit('gameOver', { winner: 'w', reason: 'Time Out' });
      }
    }
    io.to(roomId).emit('timeUpdate', { whiteTime: room.whiteTime, blackTime: room.blackTime });
  }, 1000);
}

function handleLeave(socket, roomId) {
  const room = activeRooms[roomId];
  if (room) {
    if (room.interval) clearInterval(room.interval);
    socket.to(roomId).emit('opponentLeft');
    delete activeRooms[roomId];
  }
}

function getLeaderboardData() {
  return Object.entries(userScores)
    .map(([username, stats]) => ({ username, elo: stats.elo, coins: stats.coins }))
    .sort((a, b) => b.elo - a.elo)
    .slice(0, 20);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
