require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const path = require('path');
const axios = require('axios'); // API ခေါ်ဖို့ လိုပါတယ်

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const FOOTBALL_API_TOKEN = process.env.FOOTBALL_API_TOKEN; // .env ထဲမှာ သိမ်းထားပါ

// API မှ Data ဆွဲပြီး Database ထဲထည့်သည့် Function
async function syncMatches() {
    try {
        // Premier League (PL) ပွဲစဉ်များကို ဆွဲယူခြင်း
        const response = await axios.get('https://api.football-data.org/v4/competitions/PL/matches', {
            headers: { 'X-Auth-Token': FOOTBALL_API_TOKEN }
        });

        const matches = response.data.matches;
        for (let m of matches) {
            await supabase.from('match').upsert({
                id: m.id,
                team_a: m.homeTeam.name,
                team_b: m.awayTeam.name,
                odds_a: 1.9, // API မှာ Odds မပါရင် default တန်ဖိုးထားပေးရပါမယ်
                odds_b: 1.9,
                game_type: 'Football'
            });
        }
        console.log("Matches synced successfully!");
    } catch (err) {
        console.error("Sync Error:", err.message);
    }
}

// ၁။ Home Page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ၂။ ပွဲစဉ်များထုတ်ပေးခြင်း
app.get('/api/matches', async (req, res) => {
    try {
        const { data, error } = await supabase.from('match').select('*');
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ၃။ Sync လုပ်ရန် Endpoint (လိုအပ်မှ browser ကနေ လှမ်းခေါ်ပါ)
app.get('/api/sync', async (req, res) => {
    await syncMatches();
    res.send("Syncing completed!");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
