const socket = io();
const game = new Chess();

let currentUser = null;
let currentRoom = null;
let playerColor = 'w';
let isAuthModeLogin = true;
let selectedSquare = null;

const boardGrid = document.getElementById('board-grid');

// Page Reload လုပ်ပါက Auto Login စစ်ပေးခြင်း
window.addEventListener('DOMContentLoaded', () => {
  const savedUser = localStorage.getItem('chess_username');
  if (savedUser) {
    currentUser = savedUser;
    showLobby();
  }
});

// Logout လုပ်ရန်
function handleLogout() {
  localStorage.removeItem('chess_username');
  currentUser = null;
  document.getElementById('lobbyScreen').style.display = 'none';
  document.getElementById('gameScreen').style.display = 'none';
  document.getElementById('authScreen').style.display = 'block';
}

function toggleAuthMode() {
  isAuthModeLogin = !isAuthModeLogin;
  document.getElementById('authTitle').innerText = isAuthModeLogin ? 'Sign In' : 'Sign Up';
  document.getElementById('authBtn').innerText = isAuthModeLogin ? 'Sign In' : 'Sign Up';
  document.getElementById('toggleText').innerText = isAuthModeLogin 
    ? 'အကောင့်မရှိသေးပါက Sign Up လုပ်ပါ' 
    : 'အကောင့်ရှိပြီးသားပါက Sign In လုပ်ပါ';
}

async function handleAuth() {
  const username = document.getElementById('authUsername').value.trim();
  const password = document.getElementById('authPassword').value.trim();
  const errorDiv = document.getElementById('authError');
  errorDiv.innerText = '';

  if (!username || !password) return errorDiv.innerText = 'အချက်အလက်များ ဖြည့်သွင်းပါ';

  const endpoint = isAuthModeLogin ? '/api/login' : '/api/signup';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  const data = await response.json();
  if (!response.ok) {
    errorDiv.innerText = data.error;
  } else {
    if (isAuthModeLogin) {
      currentUser = data.username;
      localStorage.setItem('chess_username', currentUser); // LocalStorage တွင် မှတ်ထားခြင်း
      showLobby();
    } else {
      alert('Sign Up အောင်မြင်ပါသည်။ Sign In ပြန်ဝင်ပါ။');
      toggleAuthMode();
    }
  }
}

function showLobby() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('gameScreen').style.display = 'none';
  document.getElementById('lobbyScreen').style.display = 'block';
  document.getElementById('displayUsername').innerText = currentUser;
}

function findMatch() {
  document.getElementById('findMatchBtn').disabled = true;
  document.getElementById('matchStatus').innerText = 'ပြိုင်ဘက် ရှာဖွေနေပါသည်... ⏳';
  socket.emit('findMatch', { username: currentUser });
}

socket.on('waitingForOpponent', () => {
  document.getElementById('matchStatus').innerText = 'ပြိုင်ဘက် စောင့်ဆိုင်းနေပါသည်...';
});

socket.on('matchFound', (data) => {
  currentRoom = data.roomId;
  playerColor = data.color;

  document.getElementById('lobbyScreen').style.display = 'none';
  document.getElementById('gameScreen').style.display = 'block';
  document.getElementById('yourName').innerText = `${currentUser} (${playerColor === 'w' ? 'White' : 'Black'})`;
  document.getElementById('opponentName').innerText = `${data.opponent} (${playerColor === 'w' ? 'Black' : 'White'})`;

  renderBoard();
});

socket.on('opponentMove', (move) => {
  game.move(move);
  renderBoard();
});

function getSquareNotation(row, col) {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
  return files[col] + ranks[row];
}

// Board ရေးဆွဲခြင်း (Black ဖြစ်ပါက Board ကို လှည့်ဆွဲပေးမည်)
function renderBoard() {
  boardGrid.innerHTML = '';
  const boardState = game.board();

  // White ဆိုရင် 0->7 ၊ Black ဆိုရင် 7->0 လှည့်မည်
  const rows = playerColor === 'b' ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];
  const cols = playerColor === 'b' ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];

  for (let rIdx = 0; rIdx < 8; rIdx++) {
    for (let cIdx = 0; cIdx < 8; cIdx++) {
      const r = rows[rIdx];
      const c = cols[cIdx];

      const squareDiv = document.createElement('div');
      const squareName = getSquareNotation(r, c);
      squareDiv.className = 'square';

      if (selectedSquare === squareName) squareDiv.classList.add('selected');

      const piece = boardState[r][c];
      if (piece) {
        const img = document.createElement('img');
        img.src = `assets/images/pieces/${piece.color}${piece.type}.png`;
        squareDiv.appendChild(img);
      }

      squareDiv.addEventListener('click', () => handleSquareClick(squareName));
      boardGrid.appendChild(squareDiv);
    }
  }

  // Turn Indicator ပြရန်
  const isMyTurn = game.turn() === playerColor;
  document.getElementById('turnBadge').innerText = isMyTurn ? "Your Turn" : "Opponent's Turn";
  document.getElementById('turnBadge').className = `turn-badge ${isMyTurn ? 'my-turn' : 'op-turn'}`;
}

function handleSquareClick(square) {
  if (game.turn() !== playerColor) return;

  if (!selectedSquare) {
    const piece = game.get(square);
    if (piece && piece.color === playerColor) {
      selectedSquare = square;
    }
  } else {
    const moveData = { from: selectedSquare, to: square, promotion: 'q' };
    const move = game.move(moveData);

    if (move) {
      socket.emit('makeMove', { roomId: currentRoom, move: moveData });
    }
    selectedSquare = null;
  }
  renderBoard();
}
