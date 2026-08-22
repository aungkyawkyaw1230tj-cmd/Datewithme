const socket = io();
const game = new Chess();

let currentUser = null;
let currentRoom = null;
let playerColor = 'w';
let isAuthModeLogin = true;
let selectedSquare = null;

// User Data & Profile State
let userCoins = 500;
let userElo = 1200;
let userStats = { played: 0, wins: 0, losses: 0 };
let ownedBoards = ['wood', 'marble'];
let equippedBoard = 'wood';

const SHOP_BOARDS = [
  { id: 'wood', name: 'Classic Wood', price: 0, img: '/assets/images/wood.png' },
  { id: 'marble', name: 'Royal Marble', price: 0, img: '/assets/images/marble.png' },
  { id: 'gxw', name: 'Emerald Green', price: 150, img: '/assets/images/gxw.png' },
  { id: 'dxw', name: 'Dark Walnut', price: 250, img: '/assets/images/dxw.png' },
  { id: 'bxw', name: 'Ocean Blue', price: 350, img: '/assets/images/bxw.png' },
  { id: 'bxb', name: 'Cyber Blue', price: 500, img: '/assets/images/bxb.png' }
];

window.addEventListener('DOMContentLoaded', () => {
  const savedUser = localStorage.getItem('chess_username');
  if (savedUser) {
    currentUser = savedUser;
    loadUserData();
    showMainApp();
  }
});

function loadUserData() {
  if (!currentUser) return;
  const savedCoins = localStorage.getItem(`coins_${currentUser}`);
  const savedStats = localStorage.getItem(`stats_${currentUser}`);
  const savedOwned = localStorage.getItem(`owned_${currentUser}`);
  const savedEquipped = localStorage.getItem(`equipped_${currentUser}`);

  if (savedCoins !== null) userCoins = parseInt(savedCoins);
  if (savedStats !== null) userStats = JSON.parse(savedStats);
  if (savedOwned !== null) ownedBoards = JSON.parse(savedOwned);
  if (savedEquipped !== null) equippedBoard = savedEquipped;

  updateProfileUI();
}

function updateProfileUI() {
  const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser}`;
  
  if (document.getElementById('topAvatar')) document.getElementById('topAvatar').src = avatarUrl;
  if (document.getElementById('profileAvatar')) document.getElementById('profileAvatar').src = avatarUrl;
  if (document.getElementById('gameYourAvatar')) document.getElementById('gameYourAvatar').src = avatarUrl;

  if (document.getElementById('topUsername')) document.getElementById('topUsername').innerText = currentUser;
  if (document.getElementById('profileName')) document.getElementById('profileName').innerText = currentUser;
  if (document.getElementById('topCoins')) document.getElementById('topCoins').innerText = userCoins;
  if (document.getElementById('userElo')) document.getElementById('userElo').innerText = userElo;

  if (document.getElementById('statGames')) document.getElementById('statGames').innerText = userStats.played;
  if (document.getElementById('statWins')) document.getElementById('statWins').innerText = userStats.wins;
  if (document.getElementById('statLosses')) document.getElementById('statLosses').innerText = userStats.losses;

  // Board Element Class Name ကို equippedBoard အတိုင်း တိုက်ရိုက်ပြောင်းလဲပေးခြင်း
  const boardElem = document.getElementById('board');
  if (boardElem) {
    boardElem.className = `chess-board ${equippedBoard}`;
  }
}

// Navigation Bar Switcher
function switchNav(tabName) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-view').forEach(el => el.classList.remove('active'));

  const indexMap = { 'Play': 0, 'Puzzles': 1, 'Shop': 2, 'Profile': 3 };
  document.querySelectorAll('.nav-item')[indexMap[tabName]].classList.add('active');
  document.getElementById(`view${tabName}`).classList.add('active');

  if (tabName === 'Shop') renderShop();
}

// Auth Handlers
function switchAuthTab(isLogin) {
  isAuthModeLogin = isLogin;
  document.getElementById('tabLoginBtn').className = `auth-tab ${isLogin ? 'active' : ''}`;
  document.getElementById('tabSignupBtn').className = `auth-tab ${!isLogin ? 'active' : ''}`;
  document.getElementById('authSubmitBtn').innerText = isLogin ? 'Sign In' : 'Sign Up';
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
      localStorage.setItem('chess_username', currentUser);
      loadUserData();
      showMainApp();
    } else {
      alert('Sign Up အောင်မြင်ပါသည်။ Sign In ပြန်ဝင်ပါ။');
      switchAuthTab(true);
    }
  }
}

function handleLogout() {
  localStorage.removeItem('chess_username');
  currentUser = null;
  document.getElementById('mainApp').classList.remove('active');
  document.getElementById('gameScreen').classList.remove('active');
  document.getElementById('authScreen').classList.add('active');
}

function showMainApp() {
  document.getElementById('authScreen').classList.remove('active');
  document.getElementById('gameScreen').classList.remove('active');
  document.getElementById('mainApp').classList.add('active');
  updateProfileUI();
}

// Matchmaking
function findMatch() {
  document.getElementById('matchSearchStatus').style.display = 'flex';
  socket.emit('findMatch', { username: currentUser });
}

socket.on('matchFound', (data) => {
  currentRoom = data.roomId;
  playerColor = data.color;

  document.getElementById('matchSearchStatus').style.display = 'none';
  document.getElementById('mainApp').classList.remove('active');
  document.getElementById('gameScreen').classList.add('active');

  document.getElementById('yourName').innerText = `${currentUser} (${playerColor === 'w' ? 'White' : 'Black'})`;
  document.getElementById('opponentName').innerText = `${data.opponent} (${playerColor === 'w' ? 'Black' : 'White'})`;

  renderBoard();
});

socket.on('opponentMove', (move) => {
  game.move(move);
  renderBoard();
});

function leaveGame() {
  showMainApp();
}

function getSquareNotation(row, col) {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
  return files[col] + ranks[row];
}

// Board ရေးဆွဲချိန်တွင် လက်ရှိ Equip လုပ်ထားသော Skin ကို အမြဲတမ်း ယူသုံးရန်
function renderBoard() {
  const boardElem = document.getElementById('board');
  if (boardElem) {
    boardElem.className = `chess-board ${equippedBoard}`;
  }

  const boardGrid = document.getElementById('board-grid');
  boardGrid.innerHTML = '';
  const boardState = game.board();

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

  const isMyTurn = game.turn() === playerColor;
  document.getElementById('turnBadge').innerText = isMyTurn ? "Your Turn" : "Opponent's Turn";
  updateMoveHistory();
}

function updateMoveHistory() {
  const moveList = document.getElementById('moveList');
  if (!moveList) return;
  moveList.innerHTML = '';
  const history = game.history();

  history.forEach((m, idx) => {
    const span = document.createElement('span');
    span.className = `move-item ${idx === history.length - 1 ? 'active' : ''}`;
    span.innerText = m;
    moveList.appendChild(span);
  });
  moveList.scrollLeft = moveList.scrollWidth;
}

function handleSquareClick(square) {
  if (game.turn() !== playerColor) return;

  if (!selectedSquare) {
    const piece = game.get(square);
    if (piece && piece.color === playerColor) selectedSquare = square;
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

// Shop Rendering & Buying Logic
function renderShop() {
  const shopGrid = document.getElementById('shopGrid');
  if (!shopGrid) return;
  shopGrid.innerHTML = '';

  SHOP_BOARDS.forEach(item => {
    const isOwned = ownedBoards.includes(item.id);
    const isEquipped = equippedBoard === item.id;

    const div = document.createElement('div');
    div.className = 'mode-card';
    div.style.marginBottom = '10px';

    let btnText = isEquipped ? 'Equipped' : (isOwned ? 'Equip' : `Buy 🪙${item.price}`);
    let btnStyle = isEquipped ? 'background: #363431; color: #989795; cursor: default;' : '';

    div.innerHTML = `
      <div style="width: 44px; height: 44px; background-image: url('${item.img}'); background-size: cover; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);"></div>
      <div class="mode-info">
        <h3>${item.name}</h3>
      </div>
      <button class="green-btn" style="padding: 6px 14px; font-size: 0.85rem; ${btnStyle}" onclick="handleShopClick('${item.id}', ${item.price})">${btnText}</button>
    `;
    shopGrid.appendChild(div);
  });
}

function handleShopClick(id, price) {
  if (equippedBoard === id) return;

  if (ownedBoards.includes(id)) {
    equippedBoard = id;
  } else if (userCoins >= price) {
    userCoins -= price;
    ownedBoards.push(id);
    equippedBoard = id;
  } else {
    alert('Coin မလုံလောက်ပါ!');
    return;
  }

  // LocalStorage ထဲ သိမ်းဆည်းခြင်း
  if (currentUser) {
    localStorage.setItem(`coins_${currentUser}`, userCoins);
    localStorage.setItem(`owned_${currentUser}`, JSON.stringify(ownedBoards));
    localStorage.setItem(`equipped_${currentUser}`, equippedBoard);
  }

  updateProfileUI();
  renderShop();
  }
