const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Chess } = require('chess.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const games = {}; // Game rooms သိမ်းရန်

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // Room ထဲဝင်ခြင်း
  socket.on('joinRoom', (roomId) => {
    socket.join(roomId);
    
    if (!games[roomId]) {
      games[roomId] = new Chess();
    }
    
    // လက်ရှိ Board အခြေအနေ ပို့ပေးခြင်း
    socket.emit('boardState', games[roomId].fen());
  });

  // အကွက်ရွှေ့ခြင်း
  socket.on('makeMove', ({ roomId, move }) => {
    const game = games[roomId];
    if (!game) return;

    try {
      const result = game.move(move); // chess.js စည်းမျဉ်း စစ်ဆေးခြင်း
      if (result) {
        io.to(roomId).emit('moveMade', {
          move: result,
          fen: game.fen()
        });
      }
    } catch (e) {
      socket.emit('invalidMove', 'အကွက်ရွှေ့မှု မမှန်ပါ');
    }
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
  });
});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});