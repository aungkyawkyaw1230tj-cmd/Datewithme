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

// API မှ Data ဆွဲခြင်း
async function syncMatches() {
    try {
        const response = await axios.get('https://api.football-data.org/v4/competitions/PL/matches', {
            headers: { 'X-Auth-Token': FOOTBALL_API_TOKEN }
        });

        const matches = response.data.matches;
        const leagueName = response.data.competition.name; 

        for (let m of matches) {
            await supabase.from('match').upsert({
                id: m.id,
                team_a: m.homeTeam.name,
                team_b: m.awayTeam.name,
                match_date: m.utcDate,
                league: leagueName, 
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

// ----------------- USER SYSTEM (REGISTER & LOGIN) -----------------

// ၁။ Register API (One Device, One Account စစ်ဆေးခြင်း)
app.post('/api/register', async (req, res) => {
    const { username, password, device_id } = req.body;

    if (!username || !password || !device_id) {
        return res.status(400).json({ error: "အချက်အလက်များ ပြည့်စုံစွာ ဖြည့်စွက်ပါ၊" });
    }

    try {
        // Device ID ရှိပြီးသားလား အရင်စစ်မယ်
        const { data: existingDevice, error: deviceError } = await supabase
            .from('users')
            .select('id')
            .eq('device_id', device_id)
            .single();

        if (existingDevice) {
            return res.status(400).json({ error: "ဤဖုန်းဖြင့် အကောင့်တစ်ခု ဖွင့်ထားပြီးဖြစ်၍ ထပ်မံဖွင့်ခွင့်မရှိပါ။" });
        }

        // Username ရှိပြီးသားလား ထပ်စစ်မယ်
        const { data: existingUser, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('username', username)
            .single();

        if (existingUser) {
            return res.status(400).json({ error: "ဤ Username သည် ရှိပြီးသားဖြစ်ပါသည်။" });
        }

        // အကောင့်အသစ်သွင်းမယ်
        const { data, error } = await supabase
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
        res.status(500).json({ error: err.message });
    }
});

// -----------------------------------------------------------------

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.get('/api/matches', async (req, res) => {
    const now = new Date().toISOString();
    
    // လက်ရှိအချိန်ထက် ကျော်လွန်မယ့် (မကစားရသေးတဲ့) ပွဲတွေကိုပဲ ယူမယ်
    const { data, error } = await supabase
        .from('match')
        .select('*')
        .gte('match_date', now) 
        .order('match_date', { ascending: true });
        
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.get('/api/sync', async (req, res) => {
    await syncMatches();
    res.send("Syncing completed!");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
