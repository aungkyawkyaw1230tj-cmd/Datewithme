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

// 🤫 ဒိုင်အတွက် ၄% မှ ၅% ကြား အမြဲတမ်း အသားတင်ကျန်စေမည့် Backend Dynamic Margin
const BASE_MARGIN = 0.05;

// API မှ Data ဆွဲပြီး ရက်ပေါင်း ၄၀ စာ Filter လုပ်၍ Database ထဲ သွင်းခြင်း
async function syncMatches() {
    try {
        const response = await axios.get('https://api.football-data.org/v4/competitions/PL/matches', {
            headers: { 'X-Auth-Token': FOOTBALL_API_TOKEN }
        });

        const matches = response.data.matches;
        const leagueName = response.data.competition.name; 

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const maxDate = new Date();
        maxDate.setDate(today.getDate() + 40);
        maxDate.setHours(23, 59, 59, 999);

        let syncedCount = 0;

        for (let m of matches) {
            const matchDate = new Date(m.utcDate);

            if (matchDate >= today && matchDate <= maxDate) {
                // ကနဦး API ကလာတဲ့ Fair Odds က ၁.၉၅ ကျော်ဝန်းကျင်ရှိတယ်လို့ ယူဆပြီး 
                // ဒိုင်စားခ ၄% မှ ၅% ကြားကို Dynamic နှိမ်ပြီးမှ Database ထဲ သွင်းပါမယ်။
                let dynamicMargin = BASE_MARGIN - (Math.random() * 0.01); // 0.04 to 0.05
                let initialRawOdds = 2.00; // Fair Point
                
                let calculatedOddsA = (initialRawOdds * (1 - dynamicMargin)).toFixed(2);
                let calculatedOddsB = (initialRawOdds * (1 - dynamicMargin)).toFixed(2);

                await supabase.from('match').upsert({
                    id: m.id,
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
        console.log(`Successfully synced ${syncedCount} matches with 4%-5% Margin applied!`);
    } catch (err) {
        console.error("Sync Error:", err.message);
    }
}

// ----------------- USER SYSTEM (REGISTER & LOGIN) -----------------

// ၁။ Register API
app.post('/api/register', async (req, res) => {
    const { username, password, device_id } = req.body;

    if (!username || !password || !device_id) {
        return res.status(400).json({ error: "အချက်အလက်များ ပြည့်စုံစွာ ဖြည့်စွက်ပါ၊" });
    }

    try {
        const { data: existingDevice } = await supabase
            .from('users')
            .select('id')
            .eq('device_id', device_id)
            .single();

        if (existingDevice) {
            return res.status(400).json({ error: "ဤဖုန်းဖြင့် အကောင့်တစ်ခု ဖွင့်ထားပြီးဖြစ်၍ ထပ်မံဖွင့်ခွင့်မရှိပါ။" });
        }

        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('username', username)
            .single();

        if (existingUser) {
            return res.status(400).json({ error: "ဤ Username သည် ရှိပြီးသားဖြစ်ပါသည်။" });
        }

        const { error } = await supabase
            .from('users')
            .insert([{ username, password, device_id, balance: 0 }]);

        if (error) throw error;

        res.json({ success: true, message: "အကောင့်ဆောက်ခြင်း အောင်မြင်ပါသည်။" });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ၂။ Login API
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .eq('password', password)
            .single();

        if (error || !user) {
            return res.status(400).json({ error: "Username သို့မဟုတ် Password မှားယွင်းနေပါသည်။" });
        }

        res.json({ success: true, user: { username: user.username, balance: user.balance } });

    } catch (err) {
        console.error("Login Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ----------------- BETTING SYSTEM -----------------

// ၃။ Betting Place API
app.post('/api/place-bet', async (req, res) => {
    const { username, match_id, selected_team, bet_amount, odds } = req.body;

    if (!username || !match_id || !selected_team || !bet_amount || !odds) {
        return res.status(400).json({ error: "သတင်းအချက်အလက် မပြည့်စုံပါ။" });
    }

    const amount = parseFloat(bet_amount);
    if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ error: "လောင်းကြေးပမာဏ မှားယွင်းနေပါသည်။" });
    }

    try {
        // User Balance စစ်ဆေးခြင်း
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('balance')
            .eq('username', username)
            .single();

        if (userError || !user) {
            return res.status(400).json({ error: "အသုံးပြုသူအား မတွေ့ရှိပါ။" });
        }

        if (user.balance < amount) {
            return res.status(400).json({ error: "လောင်းကြေးထည့်ရန် balance မလုံလောက်ပါ။" });
        }

        // Balance နှုတ်ယူခြင်း
        const newBalance = user.balance - amount;
        const { error: updateError } = await supabase
            .from('users')
            .update({ balance: newBalance })
            .eq('username', username);

        if (updateError) {
            return res.status(500).json({ error: "Balance နှုတ်ယူရာတွင် အမှားတက်သွားသည်။" });
        }

        // Bets Table ထဲသို့ ဒေတာသွင်းခြင်း
        const { error: betError } = await supabase
            .from('bets')
            .insert({
                username,
                match_id,
                selected_team,
                bet_amount: amount,
                odds: parseFloat(odds)
            });

        if (betError) {
            // Error တက်ပါက ပိုက်ဆံပြန်အမ်းပေးခြင်း (Rollback)
            await supabase.from('users').update({ balance: user.balance }).eq('username', username);
            return res.status(500).json({ error: "လောင်းကြေးမှတ်တမ်း တင်ရာတွင် အမှားတက်သွားသည်။" });
        }

        res.json({ success: true, newBalance });

    } catch (err) {
        console.error("Betting Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ၄။ Get Bet History API
app.get('/api/bets', async (req, res) => {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: "Username လိုအပ်ပါသည်။" });

    try {
        const { data, error } = await supabase
            .from('bets')
            .select('*')
            .eq('username', username)
            .order('created_at', { ascending: false }); 

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ----------------- MATCHES & BLANK ROUTE -----------------

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.get('/api/matches', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('match')
            .select('*')
            .order('match_date', { ascending: true });

        if (error) {
            console.error("Supabase Fetch Error:", error.message);
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (err) {
        console.error("API Fetch Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/sync', async (req, res) => {
    await syncMatches();
    res.send("Syncing completed!");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT} with 4%-5% House Margin Enabled.`));
