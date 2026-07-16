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

// 🐼 PandaScore API Config
const PANDASCORE_TOKEN = 'LI8GZXN_LDFTJOKO9EWDo8jJZqSYHopn7OzCLKx0nopEw05b0wI';
const BASE_MARGIN = 0.05;

// === [၁] FOOTBALL SYNC ENGINE (ဘောလုံးပွဲစဉ်များ သိမ်းဆည်းခြင်း) ===
async function syncFootballMatches() {
    try {
        if (!FOOTBALL_API_TOKEN) {
            return console.log("❌ Football Token (.env သို့မဟုတ် Render Env) ထဲမှာ မတွေ့ပါ။");
        }
        
        console.log("🔄 Football API (PL) ကနေ ပွဲစဉ်တွေ စတင်ဆွဲယူနေပါတယ်...");
        const response = await axios.get('https://api.football-data.org/v4/competitions/PL/matches', {
            headers: { 'X-Auth-Token': FOOTBALL_API_TOKEN }
        });

        const matches = response.data.matches;
        const leagueName = response.data.competition.name; 
        
        console.log(`📊 Football API ကနေ စုစုပေါင်း ပွဲစဉ် ${matches.length} ပွဲ တွေ့ရှိပါတယ်။`);

        // လက်ရှိအချိန်နဲ့ ကိုက်ညီမယ့် ပွဲစဉ်တွေ (ဥပမာ- Schedule ဖြစ်ထားဆဲ သို့မဟုတ် ကစားနေဆဲပွဲများ) ကိုပဲ ယူရန် Filter ညှိခြင်း
        // အရင်က ၁၀ ရက်စာ ကန့်သတ်ချက်ကို ဖြုတ်ပြီး ပွဲစဉ်တွေ အားလုံး ဝင်လာအောင် status သို့မဟုတ် date ပေါ်မူတည်ပြီး သွင်းပါမယ်
        let syncedCount = 0;
        for (let m of matches) {
            // FINISHED ဖြစ်သွားတဲ့ ပွဲဟောင်းတွေကို ဖယ်ပြီး လာမယ့်ပွဲစဉ် (SCHEDULED, LIVE, IN_PLAY) တွေကို ယူပါမယ်
            if (m.status !== 'FINISHED') {
                let dynamicMargin = BASE_MARGIN - (Math.random() * 0.01); 
                let calculatedOddsA = (2.00 * (1 - dynamicMargin)).toFixed(2);
                let calculatedOddsB = (2.00 * (1 - dynamicMargin)).toFixed(2);

                const { error } = await supabase.from('match').upsert({
                    id: String(m.id), 
                    team_a: m.homeTeam.name,
                    team_b: m.awayTeam.name,
                    match_date: m.utcDate,
                    league: leagueName, 
                    odds_a: parseFloat(calculatedOddsA),
                    odds_b: parseFloat(calculatedOddsB),
                    game_type: 'Football'
                });

                if (error) {
                    console.error(`❌ Match ID ${m.id} သွင်းရဆင် Error:`, error.message);
                } else {
                    syncedCount++;
                }
            }
        }
        console.log(`✅ Successfully synced ${syncedCount} Football matches to Supabase!`);
    } catch (err) { 
        console.error("❌ Football Sync Error:", err.response ? JSON.stringify(err.response.data) : err.message); 
    }
}

// === [၂] ESPORTS SYNC ENGINE (Esports သီးသန့် Table ထဲသို့ သိမ်းဆည်းခြင်း) ===
async function syncEsportsMatches() {
    try {
        console.log("🔄 PandaScore API ကနေ Esports ပွဲစဉ်တွေ စတင်ဆွဲယူနေပါတယ်...");
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

                await supabase.from('esport_matches').upsert({
                    id: String(m.id), 
                    team_a: teamA,
                    team_b: teamB,
                    match_date: m.begin_at || m.original_scheduled_at,
                    league: leagueName,
                    odds_a: parseFloat(calculatedOddsA),
                    odds_b: parseFloat(calculatedOddsB),
                    game_name: gameName
                });
                syncedCount++;
            }
        }
        console.log(`✅ Successfully synced ${syncedCount} Esports matches to esport_matches table!`);
    } catch (err) { console.error("❌ PandaScore Sync Error:", err.message); }
}

// ----------------- USER SYSTEM -----------------
app.post('/api/register', async (req, res) => {
    const { username, password, device_id } = req.body;
    if (!username || !password || !device_id) return res.status(400).json({ error: "အချက်အလက်များ ဖြည့်စွက်ပါ" });
    try {
        const { data: extDev } = await supabase.from('users').select('id').eq('device_id', device_id).single();
        if (extDev) return res.status(400).json({ error: "ဤဖုန်းဖြင့် အကောင့်ဖွင့်ထားပြီးဖြစ်ပါသည်" });
        const { data: extUsr } = await supabase.from('users').select('id').eq('username', username).single();
        if (extUsr) return res.status(400).json({ error: "ဤ Username ရှိပြီးသားဖြစ်ပါသည်" });
        
        const { error } = await supabase.from('users').insert([{ username, password, device_id, balance: 0 }]);
        if (error) throw error;
        res.json({ success: true, message: "အကောင့်ဆောက်ခြင်း အောင်မြင်ပါသည်" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const { data: user, error = null } = await supabase.from('users').select('*').eq('username', username).eq('password', password).single();
        if (error || !user) return res.status(400).json({ error: "Username သို့မဟုတ် Password မှားနေပါသည်" });
        res.json({ success: true, user: { username: user.username, balance: user.balance } });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ----------------- TRANSACTION SYSTEM -----------------
app.post('/api/transaction', async (req, res) => {
    const { username, type, amount, method, details } = req.body;
    try {
        const { error } = await supabase.from('transactions').insert([{ username, type, amount: parseFloat(amount), method, details, status: 'PENDING' }]);
        if (error) throw error;
        res.json({ success: true, message: "တောင်းဆိုမှုအား Admin ထံ ပေးပို့လိုက်ပါပြီ" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ----------------- ADMIN SYSTEM -----------------
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'admin1234') return res.json({ success: true, token: 'authenticated' });
    return res.status(400).json({ error: "အကောင့်ဝင်ရောက်ခွင့် မရှိပါ" });
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
        const { data: tx, error: fErr } = await supabase.from('transactions').select('*').eq('id', txId).single();
        if (fErr || !tx || tx.status !== 'PENDING') return res.status(400).json({ error: "မှတ်တမ်းမရှိပါ" });

        if (action === 'APPROVED') {
            const { data: user } = await supabase.from('users').select('balance').eq('username', tx.username).single();
            if (user) {
                let newBal = tx.type === 'deposit' ? user.balance + tx.amount : user.balance - tx.amount;
                await supabase.from('users').update({ balance: newBal }).eq('username', tx.username);
            }
        }
        await supabase.from('transactions').update({ status: action }).eq('id', txId);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ----------------- BETTING SYSTEM -----------------
app.post('/api/place-bet', async (req, res) => {
    const { username, match_id, selected_team, bet_amount, odds, team_a, team_b } = req.body;
    try {
        const { data: user } = await supabase.from('users').select('balance').eq('username', username).single();
        if (!user || user.balance < bet_amount) return res.status(400).json({ error: "လက်ကျန်ငွေ မလုံလောက်ပါ" });

        await supabase.from('users').update({ balance: user.balance - bet_amount }).eq('username', username);
        const { error } = await supabase.from('bets').insert({ username, match_id, selected_team, bet_amount, odds, team_a, team_b });
        if (error) throw error;
        res.json({ success: true, newBalance: user.balance - bet_amount });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/bet-history', async (req, res) => {
    try {
        const { data, error } = await supabase.from('bets').select('*').eq('username', req.query.username).order('created_at', { ascending: false });
        if (error) throw error; res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ----------------- MATCHES & SYNC ROUTE -----------------
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.get('/api/matches', async (req, res) => {
    try {
        // ၁။ Football ပွဲစဉ်များ ဆွဲယူခြင်း
        const { data: footballMatches, error: fbErr } = await supabase.from('match').select('*').order('match_date', { ascending: true });
        if (fbErr) throw fbErr;

        // ၂။ Esports ပွဲစဉ်များ ဆွဲယူခြင်း
        const { data: esportsMatches, error: esErr } = await supabase.from('esport_matches').select('*').order('match_date', { ascending: true });
        if (esErr) throw esErr;

        // ၃။ game_type တစ်ပြေးညီ ညှိပြီး ပေါင်းထုတ်ခြင်း
        const formattedEsports = esportsMatches.map(m => ({
            id: m.id,
            team_a: m.team_a,
            team_b: m.team_b,
            match_date: m.match_date,
            league: m.league,
            odds_a: m.odds_a,
            odds_b: m.odds_b,
            game_type: m.game_name 
        }));

        const allMatches = [...footballMatches, ...formattedEsports];
        res.json(allMatches);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/sync', async (req, res) => {
    await syncFootballMatches();
    await syncEsportsMatches();
    res.send("Football and Esports Tables Sync completed successfully!");
});

// ----------------- SERVER LISTEN & INITIAL SYNC -----------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, async () => {
    console.log(`🚀 Server live on port ${PORT}`);
    
    // Server စတက်တာနဲ့ နောက်ကွယ်ကနေ ဒေတာတွေကို တစ်ခါတည်း Auto-Sync လုပ်ပေးမှာဖြစ်ပါတယ်
    console.log("⚡ Starting initial match sync engine...");
    await syncFootballMatches();
    await syncEsportsMatches();
});
