require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const FOOTBALL_API_TOKEN = process.env.FOOTBALL_API_TOKEN;

// API မှ Data ဆွဲပြီး Database ထဲထည့်သည့် Function (Date ပါထည့်ပေးထားပါတယ်)
async function syncMatches() {
    try {
        console.log("Syncing started...");
        const response = await axios.get('https://api.football-data.org/v4/competitions/PL/matches', {
            headers: { 'X-Auth-Token': FOOTBALL_API_TOKEN }
        });

        const matches = response.data.matches;
        for (let m of matches) {
            await supabase.from('match').upsert({
                id: m.id,
                team_a: m.homeTeam.name,
                team_b: m.awayTeam.name,
                match_date: m.utcDate, // API ကလာတဲ့အချိန်ကို တိုက်ရိုက်ထည့်မယ်
                odds_a: 1.9,
                odds_b: 1.9,
                game_type: 'Football'
            });
        }
        console.log("Matches synced successfully with Dates!");
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
        // အချိန်အလိုက် စီပေးထားတယ် (order)
        const { data, error } = await supabase
            .from('match')
            .select('*')
            .order('match_date', { ascending: true });
            
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ၃။ Sync လုပ်ရန် Endpoint
app.get('/api/sync', async (req, res) => {
    await syncMatches();
    res.send("Syncing completed! Check your Database.");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
