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

// 🐼 PandaScore API Token ချိတ်ဆက်ခြင်း
const PANDASCORE_TOKEN = 'LI8GZXN_LDFTJOKO9EWDo8jJZqSYHopn7OzCLKx0nopEw05b0wI';

// ဒိုင်အတွက် ၄% မှ ၅% ကြား အမြဲတမ်း အသားတင်ကျန်စေမည့် Dynamic Margin
const BASE_MARGIN = 0.05;

// === [၁] FOOTBALL DATA SYNC ENGINE (Premier League) ===
async function syncFootballMatches() {
    try {
        if (!FOOTBALL_API_TOKEN) return console.log("Football Token မရှိသေးပါ။");
        
        const response = await axios.get('https://api.football-data.org/v4/competitions/PL/matches', {
            headers: { 'X-Auth-Token': FOOTBALL_API_TOKEN }
        });

        const matches = response.data.matches;
        const leagueName = response.data.competition.name; 
        const today = new Date(); today.setHours(0, 0, 0, 0);

        let syncedCount = 0;
        for (let m of matches) {
            const matchDate = new Date(m.utcDate);
            if (matchDate >= today) {
                let dynamicMargin = BASE_MARGIN - (Math.random() * 0.01); 
                let calculatedOddsA = (2.00 * (1 - dynamicMargin)).toFixed(2);
                let calculatedOddsB = (2.00 * (1 - dynamicMargin)).toFixed(2);

                await supabase.from('match').upsert({
                    id: `fb-${m.id}`, // ID မထပ်စေရန် prefix တပ်ခြင်း
                    team_a: m.homeTeam.name,
                    team_b: m.awayTeam.name,
                    match_date: m.utcDate,
                    league: leagueName, 
                    odds_a: parseFloat(calculatedOddsA),
                    odds_b: parseFloat(calculatedOddsB),
                    game_type: 'Football'
                });
                syncedCount++;
            }
        }
        console.log(`Successfully synced ${syncedCount} Football matches!`);
    } catch (err) {
        console.error("Football Sync Error:", err.message);
    }
}

// === [၂] ESPORTS DATA SYNC ENGINE (PandaScore) ===
async function syncEsportsMatches() {
    try {
        const response = await axios.get('https://api.pandascore.co/matches/upcoming', {
            params: { token: PANDASCORE_TOKEN, per_page: 20 }
        });

        const matches = response.data;
        let syncedCount = 0;

        for (let m of matches) {
            if (m.opponents && m.opponents.length >= 2) {
                const teamA = m.opponents[0].opponent.name;
                const teamB = m.opponents[1].opponent.name;
                const gameName = m.videogame ? m.videogame.name : 'Esports';
                const leagueName = m.league ? m.league.name : 'Esports Tournament';

                let dynamicMargin = BASE_MARGIN - (Math.random() * 0.01); 
                let calculatedOddsA = (1.95 * (1 - dynamicMargin)).toFixed(2);
                let calculatedOddsB = (1.95 * (1 - dynamicMargin)).toFixed(2);

                await supabase.from('match').upsert({
                    id: `es-${m.id}`, 
                    team_a: teamA,
                    team_b: teamB,
                    match_date: m.begin_at || m.original_scheduled_at,
                    league: leagueName,
                    odds_a: parseFloat(calculatedOddsA),
                    odds_b: parseFloat(calculatedOddsB),
                    game_type: gameName
                });
                syncedCount++;
            }
        }
        console.log(`Successfully synced ${syncedCount} Esports matches from PandaScore!`);
    } catch (err) {
        console.error("PandaScore Sync Error:", err.message);
    }
}

// ----------------- USER SYSTEM (REGISTER & LOGIN) -----------------
app.post('/api/register', async (req, res) => {
    const { username, password, device_id } = req.body;
    if (!username || !password || !device_id) return res.status(400).json({ error: "အချက်အလက်များ ပြည့်စုံစွာ ဖြည့်စွက်ပါ၊" });
    try {
        const { data: existingDevice } = await supabase.from('users').select('id').eq('device_id', device_id).single();
        if (existingDevice) return res.status(400).json({ error: "ဤဖုန်းဖြင့် အကောင့်တစ်ခု ဖွင့်ထားပြီးဖြစ်၍ ထပ်မံဖွင့်ခွင့်မရှိပါ။" });
        const { data: existingUser } = await supabase.from('users').select('id').eq('username', username).single();
        if (existingUser) return res.status(400).json({ error: "ဤ Username သည် ရှိပြီးသားဖြစ်ပါသည်။" });

        const { error } = await supabase.from('users').insert([{ username, password, device_id, balance: 0 }]);
        if (error) throw error;
        res.json({ success: true, message: "အကောင့်ဆောက်ခြင်း အောင်မြင်ပါသည်။" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const { data: user, error } = await supabase.from('users').select('*').eq('username', username).eq('password', password).single();
        if (error || !user) return res.status(400).json({ error: "Username သို့မဟုတ် Password မှားယွင်းနေပါသည်။" });
        res.json({ success: true, user: { username: user.username, balance: user.balance } });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ----------------- DEPOSIT / WITHDRAW TRANSACTION SYSTEM -----------------
app.post('/api/transaction', async (req, res) => {
    const { username, type, amount, method, details } = req.body;
    if (!username || !type || !amount || !method || !details) return res.status(400).json({ error: "သတင်းအချက်အလက် မပြည့်စုံပါ။" });
    try {
        const { error } = await supabase.from('transactions').insert([{ username, type, amount: parseFloat(amount), method, details, status: 'PENDING' }]);
        if (error) throw error;
        res.json({ success: true, message: "တောင်းဆိုမှုအား Admin ထံ ပေးပို့လိုက်ပါပြီ။" });
    } catch (err) { res.status(500).json({ error: "ဆာဗာအတွင်း ဒေတာသိမ်းဆည်းရန် အမှားတက်နေပါသည် - " + err.message }); }
});

// ----------------- ADMIN DASHBOARD MANAGEMENT -----------------
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'admin1234') return res.json({ success: true, token: 'admin_live_authenticated' });
    return res.status(400).json({ error: "အက်ဒမင် အကောင့်ဝင်ရောက်ခွင့် ငြင်းပယ်ခံရပါသည်၊၊" });
});

app.get('/api/admin/transactions', async (req, res) => {
    try {
        const { data, error } = await supabase.from('transactions').select('*').eq('status', 'PENDING').order('created_at', { ascending: false });
        if (error) throw error; res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/process-transaction', async (req, res) => {
    const { txId, action } = req.body;
    try {
        const { data: tx, error: findError } = await supabase.from('transactions').select('*').eq('id', txId).single();
        if (findError || !tx || tx.status !== 'PENDING') return res.status(400).json({ error: "အရောင်းအဝယ်မှတ်တမ်း ရှာမတွေ့ပါ။" });

        if (action === 'APPROVED') {
            const { data: user, error: userError } = await supabase.from('users').select('balance').eq('username', tx.username).single();
            if (!userError && user) {
                let updatedBalance = tx.type === 'deposit' ? user.balance + tx.amount : user.balance - tx.amount;
                if (tx.type === 'withdraw' && user.balance < tx.amount) return res.status(400).json({ error: "အသုံးပြုသူတွင် ထုတ်ယူရန် လက်ကျန်ငွေမလုံလောက်ပါ။" });
                await supabase.from('users').update({ balance: updatedBalance }).eq('username', tx.username);
            }
        }
        await supabase.from('transactions').update({ status: action }).eq('id', txId);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ----------------- BETTING SYSTEM -----------------
app.post('/api/place-bet', async (req, res) => {
    const { username, match_id, selected_team, bet_amount, odds, team_a, team_b } = req.body;
    if (!username || !match_id || !selected_team || !bet_amount || !odds) return res.status(400).json({ error: "သတင်းအချက်အလက် မပြည့်စုံပါ။" });

    const amount = parseFloat(bet_amount);
    try {
        const { data: user, error: userError } = await supabase.from('users').select('balance').eq('username', username).single();
        if (userError || !user) return res.status(400).json({ error: "အသုံးပြုသူအား မတွေ့ရှိပါ။" });
        if (user.balance < amount) return res.status(400).json({ error: "လောင်းကြေးထည့်ရန် balance မလုံလောက်ပါ။" });

        await supabase.from('users').update({ balance: user.balance - amount }).eq('username', username);
        const { error: betError } = await supabase.from('bets').insert({ username, match_id, selected_team, bet_amount: amount, odds: parseFloat(odds), team_a, team_b });

        if (betError) {
            await supabase.from('users').update({ balance: user.balance }).eq('username', username);
            return res.status(500).json({ error: "လောင်းကြေးမှတ်တမ်း တင်ရာတွင် အမှားတက်သွားသည်။" });
        }
        res.json({ success: true, newBalance: user.balance - amount });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/bet-history', async (req, res) => {
    try {
        const { data, error } = await supabase.from('bets').select('*').eq('username', req.query.username).order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ----------------- MATCHES & ROUTES -----------------
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.get('/api/matches', async (req, res) => {
    try {
        const { data, error } = await supabase.from('match').select('*').order('match_date', { ascending: true });
        if (error) throw error; res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Sync လုပ်သည့်အခါ ဘောလုံးနှင့် Esports နှစ်ခုလုံး ဝင်စေခြင်း
app.get('/api/sync', async (req, res) => {
    await syncFootballMatches();
    await syncEsportsMatches();
    res.send("Football and PandaScore Esports Sync completed successfully!");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
