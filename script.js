// စစ်တုရင်ခုံ စတင်ချိန် အရုပ်များ နေရာချထားမှု (Initial Board Setup)
const initialBoard = [
  ["br", "bn", "bb", "bq", "bk", "bb", "bn", "br"],
  ["bp", "bp", "bp", "bp", "bp", "bp", "bp", "bp"],
  ["", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", ""],
  ["wp", "wp", "wp", "wp", "wp", "wp", "wp", "wp"],
  ["wr", "wn", "wb", "wq", "wk", "wb", "wn", "wr"]
];

let boardState = JSON.parse(JSON.stringify(initialBoard));
let selectedSquare = null; // ရွေးချယ်ထားသော အကွက် { row, col }

// HTML ထဲမှ ခုံ Container ကို ယူခြင်း
const boardElement = document.querySelector(".board-grid") || document.querySelector(".chess-board");

// Board ကို HTML ပေါ် ရေးဆွဲပေးသည့် Function
function renderBoard() {
  boardElement.innerHTML = ""; // အဟောင်းများကို ရှင်းထုတ်ပါ

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const square = document.createElement("div");
      
      // Light / Dark Square ခွဲခြားခြင်း
      const isLight = (r + c) % 2 === 0;
      square.className = `square ${isLight ? "light" : "dark"}`;
      
      // ရွေးချယ်ထားသော အကွက်ဖြစ်ပါက Yellow Highlight ပြရန်
      if (selectedSquare && selectedSquare.row === r && selectedSquare.col === c) {
        square.classList.add("selected");
      }

      // အကွက်ထဲ အရုပ်ရှိပါက ပုံ ထည့်ပေးခြင်း
      const piece = boardState[r][c];
      if (piece) {
        const img = document.createElement("img");
        img.src = `assets/images/pieces/${piece}.png`;
        square.appendChild(img);
      }

      // Square ကို နှိပ်သည့် Event ထည့်ခြင်း
      square.addEventListener("click", () => handleSquareClick(r, c));

      boardElement.appendChild(square);
    }
  }
}

// အကွက်များ နှိပ်သည့်အခါ အရုပ်ရွှေ့သည့် Logic
function handleSquareClick(row, col) {
  const clickedPiece = boardState[row][col];

  // ၁။ အရုပ် မရွေးရသေးပါက - မိမိနှိပ်သည့် အရုပ်ကို Select လုပ်မည်
  if (!selectedSquare) {
    if (clickedPiece !== "") {
      selectedSquare = { row, col };
    }
  } 
  // ၂။ အရုပ် ရွေးထားပြီးပါက - နှိပ်လိုက်သည့် အကွက်သို့ ရွှေ့မည်
  else {
    const fromRow = selectedSquare.row;
    const fromCol = selectedSquare.col;

    // မိမိ ရွေးထားသည့် အကွက် မဟုတ်သည့် အခြားအကွက်ကို နှိပ်မှ ရွှေ့မည်
    if (fromRow !== row || fromCol !== col) {
      boardState[row][col] = boardState[fromRow][fromCol]; // အသစ်နေရာသို့ ပြောင်းမည်
      boardState[fromRow][fromCol] = ""; // မူလနေရာကို အလွတ်လုပ်မည်
    }
    
    selectedSquare = null; // Select လုပ်ထားတာ ဖြုတ်မည်
  }

  renderBoard(); // Board ကို ပြန်လည် ဆွဲပေးမည်
}

// ပထမဆုံး စတင်ချိန် Render ခေါ်ပေးရန်
renderBoard();
