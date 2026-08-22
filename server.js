const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static('public'));

app.post('/api/login', (req, res) => res.json({ username: req.body.username }));
app.post('/api/signup', (req, res) => res.json({ username: req.body.username }));

let waitingQueue = [];
let activeRooms = {};

io.on('connection', (socket) => {
  // Random Matchmaking & Cancel
  socket.on('findMatch', (data) => {
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
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    socket.join(code);
    activeRooms[code] = {
      white: socket.id,
      whiteUser: data.username,
      black: null,
      blackUser: null,
      whiteTime: 300,
      blackTime: 300,
      currentTurn: 'w',
      interval: null
    };
    socket.emit('customRoomCreated', { roomCode: code });
  });

  socket.on('joinCustomRoom', (data) => {
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

  // Gameplay & Chat
  socket.on('makeMove', (data) => {
    const room = activeRooms[data.roomId];
    if (room) {
      socket.to(data.roomId).emit('opponentMove', data.move);
      room.currentTurn = room.currentTurn === 'w' ? 'b' : 'w';
    }
  });

  socket.on('sendChatMessage', (data) => {
    io.to(data.roomId).emit('receiveChatMessage', { sender: data.sender, text: data.text });
  });

  socket.on('leaveGame', (data) => {
    handleLeave(socket, data.roomId);
  });

  socket.on('disconnect', () => {
    waitingQueue = waitingQueue.filter(p => p.socketId !== socket.id);
    for (const [roomId, room] of Object.entries(activeRooms)) {
      if (room.white === socket.id || room.black === socket.id) {
        handleLeave(socket, roomId);
      }
    }
  });
});

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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
