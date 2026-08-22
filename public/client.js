const socket = io();
const game = new Chess();

let currentUser = null;
let currentRoom = null;
let playerColor = 'w';
let isAuthModeLogin = true;
let selectedSquare = null;

const boardGrid = document.getElementById('board-grid');

// Login / Register တလှည့်စီပြောင်းရန်
function toggleAuthMode() {
  isAuthModeLogin = !isAuthModeLogin;
  document.getElementById('authTitle').innerText = isAuthModeLogin ? 'Sign In' : 'Sign Up';
  document.getElementById('authBtn').innerText = isAuthModeLogin ? 'Sign In' : 'Sign Up';
  document.getElementById('toggleText').innerText = isAuthModeLogin 
    ? 'အကောင့်မရှိသေးပါက ဒီမှာနှိပ်ပြီး Sign Up လုပ်ပါ' 
    : 'အကောင့်ရှိပြီးသားပါက ဒီမှာနှိပ်ပြီး Sign In လုပ်ပါ';
}

// Auth API ခေါ်ယူခြင်း
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
      showLobby();
    } else {
      alert('Sign Up အောင်မြင်ပါသည်။ Sign In ပြန်ဝင်ပါ။');
      toggleAuthMode();
    }
  }
}

function showLobby() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('lobbyScreen').style.display = 'block';
  document.getElementById('displayUsername').innerText = currentUser;
}

// Match Finding စတင်ခြင်း
function findMatch() {
  document.getElementById('findMatchBtn').disabled = true;
  document.getElementById('matchStatus').innerText = 'ပြိုင်ဘက် ရှာဖွေနေပါသည်... ⏳';
  socket.emit('findMatch', { username: currentUser });
}

// Socket Events
socket.on('waitingForOpponent', () => {
  document.getElementById('matchStatus').innerText = 'ပြိုင်ဘက် စောင့်ဆိုင်းနေပါသည်...';
});

socket.on('matchFound', (data) => {
  currentRoom = data.roomId;
  playerColor = data.color;

  document.getElementById('lobbyScreen').style.display = 'none';
  document.getElementById('gameScreen').style.display = 'block';
  document.getElementById('yourName').innerText = `${currentUser} (${playerColor === 'w' ? 'White' : 'Black'})`;
  document.getElementById('opponentName').innerText = data.opponent;

  renderBoard();
});

socket.on('opponentMove', (move) => {
  game.move(move);
  renderBoard();
});

// Board Rendering & Move Logic
function getSquareNotation(row, col) {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
  return files[col] + ranks[row];
}

function renderBoard() {
  boardGrid.innerHTML = '';
  const boardState = game.board();

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
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
}

function handleSquareClick(square) {
  // မိမိ အလှည့်ဟုတ်မဟုတ် စစ်ဆေးခြင်း
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
