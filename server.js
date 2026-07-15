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
// API မှ Data ဆွဲပြီး ၅ ရက်စာပဲ Filter လုပ်ပြီး Database ထဲ သွင်းခြင်း
async function syncMatches() {
    try {
        const response = await axios.get('https://api.football-data.org/v4/competitions/PL/matches', {
            headers: { 'X-Auth-Token': FOOTBALL_API_TOKEN }
        });

        const matches = response.data.matches;
        const leagueName = response.data.competition.name; 

        // ဒီနေ့ ရက်စွဲကို ယူမယ် (ဇူလိုင်လ)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // ဩဂုတ်လကုန်အထိ ပွဲစဉ်တွေ မြင်ရအောင် ရက်ပေါင်း ၄၀ စာအထိ ယူထားလိုက်မယ်
        const maxDate = new Date();
        maxDate.setDate(today.getDate() + 40);
        maxDate.setHours(23, 59, 59, 999);

        let syncedCount = 0;

        for (let m of matches) {
            const matchDate = new Date(m.utcDate);

            // ရက်စွဲသည် ယနေ့မှစ၍ ရက်ပေါင်း ၄၀ (သြဂုတ်လကုန်) အတွင်း ဖြစ်မှသာ သွင်းမည်
            if (matchDate >= today && matchDate <= maxDate) {
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
                syncedCount++;
            }
        }
        console.log(`Successfully synced ${syncedCount} matches for the next 40 days!`);
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
        console.error("Login Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// -----------------------------------------------------------------


app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
// server.js ထဲက /api/matches API ကို ဒီအတိုင်း အစားထိုးပါ
app.get('/api/matches', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('match')
            .select('*')
            .order('match_date', { ascending: true }); // Database ထဲက ပွဲတွေကို အကုန် ဆွဲထုတ်မယ်

        if (error) {
            console.error("Supabase Fetch Error:", error.message);
            return res.status(500).json({ error: error.message });
        }

        // Frontend သို့ Data အကုန် ပို့ပေးလိုက်မယ်
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
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
