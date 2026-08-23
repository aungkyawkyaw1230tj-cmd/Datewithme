const socket = io();
const game = new Chess();

let currentUser = null;
let currentRoom = null;
let currentOpponent = null;
let playerColor = 'w';
let selectedSquare = null;
let selectedTimeLimit = 5;
let lastMove = null; // Recent Move Tracking

// User Data State
let userCoins = 500;
let userElo = 1200;
let friendsList = [];
let pendingRequests = [];
let gameHistory = [];
let ownedBoards = ['wood'];
let equippedBoard = 'wood';

// Expanded Shop Items
const shopItems = [
  { id: 'wood', name: 'Classic Wood', price: 0, previewClass: 'wood-preview' },
  { id: 'marble', name: 'Royal Marble', price: 300, previewClass: 'marble-preview' },
  { id: 'glass', name: 'Cyber Glass', price: 500, previewClass: 'glass-preview' },
  { id: 'gold', name: 'Imperial Gold', price: 800, previewClass: 'gold-preview' },
  { id: 'neon', name: 'Neon Dark', price: 1200, previewClass: 'neon-preview' }
];

window.addEventListener('DOMContentLoaded', () => {
  const savedUser = localStorage.getItem('chess_username');
  if (savedUser) {
    currentUser = savedUser;
    socket.emit('registerUser', currentUser);
    loadUserData();
    showMainApp();
  }
});

function loadUserData() {
  if (!currentUser) return;
  const savedCoins = localStorage.getItem(`coins_${currentUser}`);
  const savedElo = localStorage.getItem(`elo_${currentUser}`);
  const savedOwned = localStorage.getItem(`owned_${currentUser}`);
  const savedEquipped = localStorage.getItem(`equipped_${currentUser}`);
  const savedFriends = localStorage.getItem(`friends_${currentUser}`);
  const savedHistory = localStorage.getItem(`history_${currentUser}`);

  if (savedCoins !== null) userCoins = parseInt(savedCoins);
  if (savedElo !== null) userElo = parseInt(savedElo);
  if (savedOwned !== null) ownedBoards = JSON.parse(savedOwned);
  if (savedEquipped !== null) equippedBoard = savedEquipped;
  if (savedFriends !== null) friendsList = JSON.parse(savedFriends);
  if (savedHistory !== null) gameHistory = JSON.parse(savedHistory);

  updateProfileUI();
}

function updateProfileUI() {
  const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser}`;
  
  if (document.getElementById('topAvatar')) document.getElementById('topAvatar').src = avatarUrl;
  if (document.getElementById('profileAvatar')) document.getElementById('profileAvatar').src = avatarUrl;
  if (document.getElementById('gameYourAvatar')) document.getElementById('gameYourAvatar').src = avatarUrl;

  if (document.getElementById('topUsername')) document.getElementById('topUsername').innerText = currentUser;
  if (document.getElementById('profileName')) document.getElementById('profileName').innerText = currentUser;
  if (document.getElementById('userElo')) document.getElementById('userElo').innerText = userElo;
  if (document.getElementById('topCoins')) document.getElementById('topCoins').innerText = userCoins;

  renderFriends();
  renderPendingRequests();
  renderGameHistory();
  renderShop();
}

function switchNav(tabName) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-view').forEach(el => el.classList.remove('active'));

  const indexMap = { 'Play': 0, 'Friends': 1, 'Shop': 2, 'Profile': 3 };
  document.querySelectorAll('.nav-item')[indexMap[tabName]].classList.add('active');
  document.getElementById(`view${tabName}`).classList.add('active');

  if (tabName === 'Shop') renderShop();
  if (tabName === 'Profile') renderGameHistory();
  if (tabName === 'Friends') renderFriends();
}

function handleAuth() {
  const username = document.getElementById('authUsername').value.trim();
  if (!username) return alert('Username ဖြည့်ပါ။');

  currentUser = username;
  localStorage.setItem('chess_username', currentUser);
  socket.emit('registerUser', currentUser);
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

// Matchmaking
function findMatch() {
  document.getElementById('matchSearchStatus').style.display = 'block';
  document.getElementById('searchMsg').innerText = 'Match searching...';
  socket.emit('findMatch', { username: currentUser });
}

function cancelMatch() {
  socket.emit('cancelMatch');
  document.getElementById('matchSearchStatus').style.display = 'none';
}

function openCustomRoomModal() { document.getElementById('customModal').style.display = 'flex'; }
function closeCustomModal() { document.getElementById('customModal').style.display = 'none'; }

function selectTime(mins, btn) {
  selectedTimeLimit = mins;
  document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function createCustomRoomSubmit() {
  closeCustomModal();
  socket.emit('createCustomRoom', { username: currentUser, minutes: selectedTimeLimit });
}

socket.on('customRoomCreated', (data) => {
  document.getElementById('matchSearchStatus').style.display = 'block';
  document.getElementById('searchMsg').innerText = `Your Code: ${data.roomCode}\nWaiting for opponent...`;
});

function promptJoinRoom() {
  const code = prompt('6-Digit Lobby Code ရိုက်ထည့်ပါ:');
  if (code) socket.emit('joinCustomRoom', { roomCode: code.trim(), username: currentUser });
}

socket.on('roomError', (msg) => alert(msg));

socket.on('matchFound', (data) => {
  currentRoom = data.roomId;
  playerColor = data.color;
  currentOpponent = data.opponent;
  lastMove = null;

  document.getElementById('matchSearchStatus').style.display = 'none';
  document.getElementById('mainApp').classList.remove('active');
  document.getElementById('gameScreen').classList.add('active');

  document.getElementById('yourName').innerText = currentUser;
  document.getElementById('opponentName').innerText = data.opponent;
  document.getElementById('gameOpponentAvatar').src = `https://api.dicebear.com/7.x/bottts/svg?seed=${data.opponent}`;

  game.reset();
  renderBoard();
});

// Socket Game Events
socket.on('opponentMove', (move) => {
  game.move(move);
  lastMove = { from: move.from, to: move.to };
  renderBoard();
  checkGameStatus();
});

socket.on('opponentLeft', () => {
  alert('Opponent ထွက်သွားသည်။ သင်နိုင်ပါပြီ!');
  saveGameResult(currentOpponent, 'WIN', 'Opponent Left', 25, 50);
  leaveGame();
});

socket.on('gameOver', (data) => {
  const isWin = data.winner === playerColor;
  alert(`Game Over! Winner: ${isWin ? 'You' : 'Opponent'} (${data.reason})`);
  saveGameResult(currentOpponent, isWin ? 'WIN' : 'LOSS', data.reason, isWin ? 25 : -15, isWin ? 50 : 10);
  leaveGame();
});

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

  let legalMoves = [];
  if (selectedSquare) {
    legalMoves = game.moves({ square: selectedSquare, verbose: true }).map(m => m.to);
  }

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

      // Highlight Recent Move
      if (lastMove && (squareName === lastMove.from || squareName === lastMove.to)) {
        squareDiv.classList.add('last-move');
      }

      const piece = boardState[r][c];
      if (piece) {
        const img = document.createElement('img');
        img.src = `assets/images/pieces/${piece.color}${piece.type}.png`;
        squareDiv.appendChild(img);
      }

      if (legalMoves.includes(squareName)) {
        const dotDiv = document.createElement('div');
        dotDiv.className = piece ? 'legal-capture' : 'legal-dot';
        squareDiv.appendChild(dotDiv);
      }

      squareDiv.addEventListener('click', () => handleSquareClick(squareName));
      boardGrid.appendChild(squareDiv);
    }
  }

  document.getElementById('turnBadge').innerText = (game.turn() === playerColor) ? "Your Turn" : "Opponent's Turn";
  updateMoveHistory();
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
      lastMove = { from: move.from, to: move.to };
      socket.emit('makeMove', { roomId: currentRoom, move: moveData });
      checkGameStatus();
    }
    selectedSquare = null;
  }
  renderBoard();
}

function checkGameStatus() {
  if (game.in_checkmate()) {
    const winner = game.turn() === 'w' ? 'b' : 'w';
    const isWin = winner === playerColor;
    alert(isWin ? 'Checkmate! သင်နိုင်ပါပြီ!' : 'Checkmate! Opponent နိုင်သွားပါပြီ!');
    saveGameResult(currentOpponent, isWin ? 'WIN' : 'LOSS', 'Checkmate', isWin ? 25 : -15, isWin ? 50 : 10);
    leaveGame();
  }
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

// Shop Rendering with Previews
function renderShop() {
  const grid = document.getElementById('shopGrid');
  if (!grid) return;
  grid.innerHTML = '';

  shopItems.forEach(item => {
    const isOwned = ownedBoards.includes(item.id);
    const isEquipped = equippedBoard === item.id;

    const div = document.createElement('div');
    div.style.cssText = 'background:#32302c; padding:12px; border-radius:10px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; gap:12px;';

    let btnHtml = '';
    if (isEquipped) {
      btnHtml = `<button class="green-btn" disabled style="opacity:0.6;">Equipped</button>`;
    } else if (isOwned) {
      btnHtml = `<button class="green-btn" onclick="equipBoard('${item.id}')">Equip</button>`;
    } else {
      btnHtml = `<button class="green-btn" onclick="buyBoard('${item.id}', ${item.price})">🪙 ${item.price}</button>`;
    }

    div.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px;">
        <div class="board-preview-box ${item.previewClass}"></div>
        <div>
          <h4 style="font-size:0.95rem;">${item.name}</h4>
          <p style="font-size:0.75rem; color:#aaa;">${isOwned ? 'Owned' : `Price: 🪙 ${item.price}`}</p>
        </div>
      </div>
      <div>${btnHtml}</div>
    `;
    grid.appendChild(div);
  });
}

function buyBoard(boardId, price) {
  if (userCoins < price) return alert('Coin မလုံလောက်ပါ။');
  userCoins -= price;
  ownedBoards.push(boardId);
  equippedBoard = boardId;

  saveShopData();
  updateProfileUI();
  alert('Shop မှ အောင်မြင်စွာ ဝယ်ယူပြီးပါပြီ။');
}

function equipBoard(boardId) {
  equippedBoard = boardId;
  saveShopData();
  updateProfileUI();
}

function saveShopData() {
  localStorage.setItem(`coins_${currentUser}`, userCoins);
  localStorage.setItem(`owned_${currentUser}`, JSON.stringify(ownedBoards));
  localStorage.setItem(`equipped_${currentUser}`, equippedBoard);
}

// Profile & History
function saveGameResult(opponent, result, reason, eloChange, coinReward) {
  if (!currentUser || !opponent) return;

  userElo = Math.max(0, userElo + eloChange);
  userCoins += coinReward;

  const record = {
    opponent,
    result,
    reason,
    date: new Date().toLocaleDateString()
  };

  gameHistory.unshift(record);
  if (gameHistory.length > 20) gameHistory.pop();

  localStorage.setItem(`elo_${currentUser}`, userElo);
  localStorage.setItem(`coins_${currentUser}`, userCoins);
  localStorage.setItem(`history_${currentUser}`, JSON.stringify(gameHistory));

  updateProfileUI();
}

function renderGameHistory() {
  const container = document.getElementById('gameHistoryList');
  if (!container) return;
  container.innerHTML = '';

  if (gameHistory.length === 0) {
    container.innerHTML = '<p style="color:#888; text-align:center;">ကစားခဲ့သော ပွဲစဉ်မှတ်တမ်း မရှိသေးပါ။</p>';
    return;
  }

  gameHistory.forEach(item => {
    const div = document.createElement('div');
    div.className = 'history-card';
    const isWin = item.result === 'WIN';
    div.innerHTML = `
      <div>
        <div style="font-weight:bold;">vs ${item.opponent}</div>
        <div style="font-size:0.75rem; color:#888;">${item.reason} • ${item.date}</div>
      </div>
      <span class="history-badge ${isWin ? 'badge-win' : 'badge-loss'}">${item.result}</span>
    `;
    container.appendChild(div);
  });
}

// Friends System
function sendFriendRequest() {
  const input = document.getElementById('friendInput');
  const name = input.value.trim();
  if (!name) return;
  if (name === currentUser) return alert('မိမိကိုယ်ကို Request ပို့၍မရပါ။');

  socket.emit('sendFriendRequest', { sender: currentUser, target: name });
  alert(`${name} သို့ Friend Request ပို့လိုက်ပါပြီ။`);
  input.value = '';
}

socket.on('updatePendingRequests', (requests) => {
  pendingRequests = requests || [];
  renderPendingRequests();
});

function respondRequest(sender, accept) {
  socket.emit('respondFriendRequest', { sender, target: currentUser, accept });
}

socket.on('friendRequestAccepted', (data) => {
  if (!friendsList.includes(data.friendName)) {
    friendsList.push(data.friendName);
    localStorage.setItem(`friends_${currentUser}`, JSON.stringify(friendsList));
    renderFriends();
  }
});

function renderPendingRequests() {
  const container = document.getElementById('pendingRequestsList');
  if (!container) return;
  container.innerHTML = '';

  if (pendingRequests.length === 0) {
    container.innerHTML = '<p style="color:#666; font-size:0.85rem;">Pending Request မရှိပါ။</p>';
    return;
  }

  pendingRequests.forEach(sender => {
    const div = document.createElement('div');
    div.className = 'req-card';
    div.innerHTML = `
      <span><b>${sender}</b></span>
      <div style="display:flex; gap:6px;">
        <button class="accept-btn" onclick="respondRequest('${sender}', true)">Accept</button>
        <button class="red-btn" onclick="respondRequest('${sender}', false)">Reject</button>
      </div>
    `;
    container.appendChild(div);
  });
}

function renderFriends() {
  const container = document.getElementById('friendsList');
  if (!container) return;
  container.innerHTML = '';

  if (friendsList.length === 0) {
    container.innerHTML = '<p style="color:#666; font-size:0.85rem;">Friends မရှိသေးပါ။</p>';
    return;
  }

  friendsList.forEach(name => {
    const div = document.createElement('div');
    div.className = 'mode-card';
    div.style.marginBottom = '8px';
    div.innerHTML = `
      <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${name}" style="width:32px; height:32px; border-radius:50%;">
      <div class="mode-info"><h3>${name}</h3></div>
    `;
    container.appendChild(div);
  });
}

// In-Game Chat
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
