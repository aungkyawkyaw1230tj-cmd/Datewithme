const socket = io();
const game = new Chess();

let currentUser = null;
let currentRoom = null;
let playerColor = 'w';
let isAuthModeLogin = true;
let selectedSquare = null;

let userCoins = 500;
let userElo = 1200;
let friendsList = [];
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
  const savedOwned = localStorage.getItem(`owned_${currentUser}`);
  const savedEquipped = localStorage.getItem(`equipped_${currentUser}`);
  const savedFriends = localStorage.getItem(`friends_${currentUser}`);

  if (savedCoins !== null) userCoins = parseInt(savedCoins);
  if (savedOwned !== null) ownedBoards = JSON.parse(savedOwned);
  if (savedEquipped !== null) equippedBoard = savedEquipped;
  if (savedFriends !== null) friendsList = JSON.parse(savedFriends);

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

  const boardElem = document.getElementById('board');
  if (boardElem) boardElem.className = `chess-board ${equippedBoard}`;
}

function switchNav(tabName) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-view').forEach(el => el.classList.remove('active'));

  const indexMap = { 'Play': 0, 'Friends': 1, 'Shop': 2, 'Profile': 3 };
  document.querySelectorAll('.nav-item')[indexMap[tabName]].classList.add('active');
  document.getElementById(`view${tabName}`).classList.add('active');

  if (tabName === 'Shop') renderShop();
  if (tabName === 'Friends') renderFriends();
}

function switchAuthTab(isLogin) {
  isAuthModeLogin = isLogin;
  document.getElementById('tabLoginBtn').className = `auth-tab ${isLogin ? 'active' : ''}`;
  document.getElementById('tabSignupBtn').className = `auth-tab ${!isLogin ? 'active' : ''}`;
  document.getElementById('authSubmitBtn').innerText = isLogin ? 'Sign In' : 'Sign Up';
}

async function handleAuth() {
  const username = document.getElementById('authUsername').value.trim();
  const password = document.getElementById('authPassword').value.trim();
  if (!username || !password) return alert('Username/Password ဖြည့်ပါ။');

  currentUser = username;
  localStorage.setItem('chess_username', currentUser);
  loadUserData();
  showMainApp();
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

// Matchmaking System
function findMatch() {
  document.getElementById('matchSearchStatus').style.display = 'block';
  document.getElementById('searchMsg').innerText = 'Match searching...';
  socket.emit('findMatch', { username: currentUser });
}

function cancelMatch() {
  socket.emit('cancelMatch');
  document.getElementById('matchSearchStatus').style.display = 'none';
}

// Custom Room System
function createCustomRoom() {
  socket.emit('createCustomRoom', { username: currentUser });
}

socket.on('customRoomCreated', (data) => {
  document.getElementById('matchSearchStatus').style.display = 'block';
  document.getElementById('searchMsg').innerText = `Your Lobby Code: ${data.roomCode}\nWaiting for opponent...`;
});

function promptJoinRoom() {
  const code = prompt('6-Digit Lobby Code ရိုက်ထည့်ပါ:');
  if (code) socket.emit('joinCustomRoom', { roomCode: code.trim(), username: currentUser });
}

socket.on('roomError', (msg) => alert(msg));

socket.on('matchFound', (data) => {
  currentRoom = data.roomId;
  playerColor = data.color;

  document.getElementById('matchSearchStatus').style.display = 'none';
  document.getElementById('mainApp').classList.remove('active');
  document.getElementById('gameScreen').classList.add('active');

  document.getElementById('yourName').innerText = currentUser;
  document.getElementById('opponentName').innerText = data.opponent;
  document.getElementById('gameOpponentAvatar').src = `https://api.dicebear.com/7.x/bottts/svg?seed=${data.opponent}`;

  game.reset();
  renderBoard();
});

socket.on('opponentMove', (move) => {
  game.move(move);
  renderBoard();
});

socket.on('opponentLeft', () => {
  alert('Opponent ထွက်သွားသည်/လိုင်းကျသွားသည်။ သင်နိုင်ပါပြီ!');
  leaveGame();
});

socket.on('gameOver', (data) => {
  alert(`Game Over! Winner: ${data.winner === playerColor ? 'You' : 'Opponent'} (${data.reason})`);
  leaveGame();
});

// Timer Updates
socket.on('timeUpdate', (data) => {
  const formatTime = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (playerColor === 'w') {
    document.getElementById('yourTimer').innerText = formatTime(data.whiteTime);
    document.getElementById('opponentTimer').innerText = formatTime(data.blackTime);
  } else {
    document.getElementById('yourTimer').innerText = formatTime(data.blackTime);
    document.getElementById('opponentTimer').innerText = formatTime(data.whiteTime);
  }
});

function leaveGame() {
  if (currentRoom) socket.emit('leaveGame', { roomId: currentRoom });
  showMainApp();
}

function renderBoard() {
  const boardElem = document.getElementById('board');
  if (boardElem) boardElem.className = `chess-board ${equippedBoard}`;

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
      const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
      const squareName = files[c] + ranks[r];

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

  document.getElementById('turnBadge').innerText = (game.turn() === playerColor) ? "Your Turn" : "Opponent's Turn";
  updateMoveHistory();
}

function updateMoveHistory() {
  const moveList = document.getElementById('moveList');
  if (!moveList) return;
  moveList.innerHTML = '';
  game.history().forEach((m, idx) => {
    const span = document.createElement('span');
    span.className = `move-item ${idx === game.history().length - 1 ? 'active' : ''}`;
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
    if (move) socket.emit('makeMove', { roomId: currentRoom, move: moveData });
    selectedSquare = null;
  }
  renderBoard();
}

// Chat System
function toggleChat() {
  const overlay = document.getElementById('chatOverlay');
  overlay.style.display = overlay.style.display === 'none' ? 'flex' : 'none';
}

function sendChat() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (text && currentRoom) {
    socket.emit('sendChatMessage', { roomId: currentRoom, sender: currentUser, text });
    input.value = '';
  }
}

socket.on('receiveChatMessage', (data) => {
  const chatBox = document.getElementById('chatBox');
  const p = document.createElement('p');
  p.style.margin = '4px 0';
  p.innerHTML = `<b style="color:${data.sender === currentUser ? '#81b64c' : '#faac42'}">${data.sender}:</b> ${data.text}`;
  chatBox.appendChild(p);
  chatBox.scrollTop = chatBox.scrollHeight;
});

// Friends System
function addFriend() {
  const input = document.getElementById('friendInput');
  const name = input.value.trim();
  if (!name) return;
  if (name === currentUser) return alert('မိမိကိုယ်ကို Friend Add ဟု မပြုလုပ်နိုင်ပါ။');

  if (!friendsList.includes(name)) {
    friendsList.push(name);
    localStorage.setItem(`friends_${currentUser}`, JSON.stringify(friendsList));
    input.value = '';
    renderFriends();
  }
}

function renderFriends() {
  const container = document.getElementById('friendsList');
  if (!container) return;
  container.innerHTML = '';

  if (friendsList.length === 0) {
    container.innerHTML = '<p style="color:#888;">Friends မရှိသေးပါ။</p>';
    return;
  }

  friendsList.forEach(name => {
    const div = document.createElement('div');
    div.className = 'mode-card';
    div.style.marginBottom = '10px';
    div.innerHTML = `
      <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${name}" style="width:36px; height:36px; border-radius:50%;">
      <div class="mode-info"><h3>${name}</h3></div>
    `;
    container.appendChild(div);
  });
}

// Shop System
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
      <div style="width: 44px; height: 44px; background-image: url('${item.img}'); background-size: cover; border-radius: 8px;"></div>
      <div class="mode-info"><h3>${item.name}</h3></div>
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

  if (currentUser) {
    localStorage.setItem(`coins_${currentUser}`, userCoins);
    localStorage.setItem(`owned_${currentUser}`, JSON.stringify(ownedBoards));
    localStorage.setItem(`equipped_${currentUser}`, equippedBoard);
  }
  updateProfileUI();
  renderShop();
}
