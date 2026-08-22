const socket = io();
const roomId = "room1"; // စမ်းသပ်ရန် မူသေ Room
const boardGrid = document.getElementById('board-grid');
const skinSelect = document.getElementById('skinSelect');
const boardElement = document.getElementById('board');

let selectedSquare = null;

// ၁။ 64 ကွက် ဆောက်ခြင်း
function createBoard() {
  boardGrid.innerHTML = '';
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  
  for (let r = 8; r >= 1; r--) {
    for (let f = 0; f < 8; f++) {
      const squareId = files[f] + r;
      const square = document.createElement('div');
      square.className = 'square';
      square.dataset.square = squareId;
      square.addEventListener('click', () => onSquareClick(squareId));
      boardGrid.appendChild(square);
    }
  }
}

// ၂။ Square Click နှိပ်၍ အကွက်ရွှေ့ခြင်း
function onSquareClick(squareId) {
  if (!selectedSquare) {
    selectedSquare = squareId;
  } else {
    socket.emit('makeMove', {
      roomId: roomId,
      move: { from: selectedSquare, to: squareId, promotion: 'q' }
    });
    selectedSquare = null;
  }
}

// ၃။ Board Skin ပြောင်းခြင်း
skinSelect.addEventListener('change', (e) => {
  boardElement.className = `chess-board ${e.target.value}`;
});

// Socket Events
socket.on('connect', () => {
  socket.emit('joinRoom', roomId);
});

socket.on('moveMade', (data) => {
  console.log("Move updated:", data);
  // ဒီနေရာမှာ FEN အလိုက် အရုပ်ပုံများ Update ပြန်တင်ပေးရပါမည်
});

createBoard();