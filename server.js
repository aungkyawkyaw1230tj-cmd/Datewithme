const express = require('express');
const app = express();
const path = require('path');

// အရေးကြီး: CSS, JS ဖိုင်တွေနဲ့ index.html ရှိတဲ့နေရာကို Render ကို ပြောပြပေးရမယ်
app.use(express.static(__dirname)); 

// Home Page လမ်းကြောင်း
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API Routes
app.get('/api/matches', async (req, res) => {
    // ... အစ်ကို့ရဲ့ Supabase code တွေ ဒီမှာ ထည့်ထားပါ
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
