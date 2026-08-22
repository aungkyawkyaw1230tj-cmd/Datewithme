const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static('public'));

// In-Memory Database (စမ်းသပ်ရန်)
const users = {}; 
let waitingQueue = null; // Matchfind စောင့်နေသူ
const activeGames = {};  // လက်ရှိ ပွဲစဉ်များ

// Sign Up API
app.post('/api/signup', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'အချက်အလက် အပြည့်အစုံ ဖြည့်ပါ' });
  if (users[username]) return res.status(400).json({ error: 'ဒီအကောင့် နာမည်ရှိပြီးသားပါ' });

  users[username] = { username, password };
  res.json({ success: true, message: 'အကောင့်ဖွင့်ခြင်း အောင်မြင်ပါသည်' });
});

// Sign In API
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = users[username];
  if (!user || user.password !== password) {
    return res.status(400).json({ error: 'အကောင့်နာမည် သို့မဟုတ် စကားဝှက် မှားယွင်းနေပါသည်' });
  }
  res.json({ success: true, username: user.username });
});

// Socket.io Real-time Matchmaking Logic
io.on('connection', (socket) => {
  
  // Match ရှာခြင်း
  socket.on('findMatch', (data) => {
    socket.username = data.username;

    if (waitingQueue && waitingQueue.id !== socket.id) {
      // ပြိုင်ဘက် တွေ့သွားပြီ (Game Room ဖန်တီးမည်)
      const roomId = `room_${socket.id}_${waitingQueue.id}`;
      const player1 = waitingQueue;
      const player2 = socket;

      player1.join(roomId);
      player2.join(roomId);

      activeGames[roomId] = { players: [player1.id, player2.id] };

      // Player 1 ကို အဖြူ၊ Player 2 ကို အမဲ ပေးမည်
      player1.emit('matchFound', { roomId, color: 'w', opponent: player2.username });
      player2.emit('matchFound', { roomId, color: 'b', opponent: player1.username });

      waitingQueue = null;
    } else {
      // ပြိုင်ဘက်မရှိသေးပါက တန်းစီစနစ်တွင် ခဏထားမည်
      waitingQueue = socket;
      socket.emit('waitingForOpponent');
    }
  });

  // အရုပ်ရွှေ့ခြင်း လွှဲပြောင်းပေးခြင်း
  socket.on('makeMove', (data) => {
    const { roomId, move } = data;
    socket.to(roomId).emit('opponentMove', move);
  });

  // Disconnect ဖြစ်ပါက Queue မှ ယ်ထုတ်ခြင်း
  socket.on('disconnect', () => {
    if (waitingQueue && waitingQueue.id === socket.id) {
      waitingQueue = null;
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
