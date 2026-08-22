const socket = io(); // Socket.io Connection
const game = new Chess(); // chess.js ဖြင့် စည်းမျဉ်းများ ထိန်းချုပ်ခြင်း

const boardGrid = document.getElementById('board-grid');
const skinSelect = document.getElementById('skinSelect');
const boardContainer = document.getElementById('board');

let selectedSquare = null;

// Board Skin ပြောင်းလဲသည့် Logic
skinSelect.addEventListener('change', (e) => {
  boardContainer.className = `chess-board ${e.target.value}`;
});

// Row/Col ကို စစ်တုရင် အကွက်နာမည် (ဥပမာ - a8, e4) သို့ ပြောင်းပေးသည့် Function
function getSquareNotation(row, col) {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
  return files[col] + ranks[row];
}

// ခုံနှင့် အရုပ်များကို ရေးဆွဲပေးသည့် Function
function renderBoard() {
  boardGrid.innerHTML = '';
  const boardState = game.board(); // chess.js မှ 8x8 Board Data ယူခြင်း

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const squareDiv = document.createElement('div');
      const squareName = getSquareNotation(r, c);

      const isLight = (r + c) % 2 === 0;
      squareDiv.className = `square ${isLight ? 'light' : 'dark'}`;

      // Highlight ရွေးထားသည့် အကွက်
      if (selectedSquare === squareName) {
        squareDiv.classList.add('selected');
      }

      // အရုပ် ရှိပါက ပုံ ထည့်ပေးခြင်း (wk.png, bp.png စသည်ဖြင့်)
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

// အကွက် နှိပ်သည့်အခါ စည်းမျဉ်းအတိုင်း ရွှေ့ပေးသည့် Logic
function handleSquareClick(square) {
  if (!selectedSquare) {
    // နှိပ်လိုက်သည့် အကွက်တွင် အရုပ်ရှိပြီး မိမိအလှည့်ဖြစ်ပါက Select လုပ်မည်
    const piece = game.get(square);
    if (piece && piece.color === game.turn()) {
      selectedSquare = square;
    }
  } else {
    // ရွှေ့ရန် ကြိုးစားခြင်း
    const move = game.move({
      from: selectedSquare,
      to: square,
      promotion: 'q' // နယ်ရုပ် အဆုံးထိရောက်ပါက မိဖုရား တန်းပြောင်းမည်
    });

    // ရွှေ့တာ အောင်မြင်ပါက မူလ Select လုပ်ထားတာ ဖျက်မည်
    selectedSquare = null;
  }

  renderBoard(); // Board ကို ပြန်ဆွဲမည်
}

// စတင်ချိန် Render ခေါ်ပေးရန်
renderBoard();
