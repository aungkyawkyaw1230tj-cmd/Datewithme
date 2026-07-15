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

// API မှ Data ဆွဲခြင်း (League နာမည်ပါ ထည့်သွင်းခြင်း)
async function syncMatches() {
    try {
        const response = await axios.get('https://api.football-data.org/v4/competitions/PL/matches', {
            headers: { 'X-Auth-Token': FOOTBALL_API_TOKEN }
        });

        const matches = response.data.matches;
        // API ကပေးတဲ့ Competition Name ကို အသုံးပြုခြင်း
        const leagueName = response.data.competition.name; 

        for (let m of matches) {
            await supabase.from('match').upsert({
                id: m.id,
                team_a: m.homeTeam.name,
                team_b: m.awayTeam.name,
                match_date: m.utcDate,
                league: leagueName, // လိဂ်နာမည်ထည့်ခြင်း (Supabase မှာ league column ရှိရမယ်)
                odds_a: 1.9,
                odds_b: 1.9,
                game_type: 'Football'
            });
        }
        console.log("Matches and League synced successfully!");
    } catch (err) {
        console.error("Sync Error:", err.message);
    }
}

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.get('/api/matches', async (req, res) => {
    // League အလိုက် စီပြီးထုတ်ပေးခြင်း
    const { data, error } = await supabase.from('match').select('*').order('match_date', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.get('/api/sync', async (req, res) => {
    await syncMatches();
    res.send("Syncing completed!");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
