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

// ဒိုင်အတွက် ၄% မှ ၅% ကြား အမြဲတမ်း အသားတင်ကျန်စေမည့် Backend Dynamic Margin
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
                let dynamicMargin = BASE_MARGIN - (Math.random() * 0.01); 
                let initialRawOdds = 2.00; 
                
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

// ----------------- DEPOSIT / WITHDRAW TRANSACTION SYSTEM (NEW) -----------------

// ၃။ User ငွေသွင်း/ငွေထုတ် Request တင်သည့် API (HTML မှ လှမ်းခေါ်သောနေရာ)
app.post('/api/transaction', async (req, res) => {
    const { username, type, amount, method, details } = req.body;

    if (!username || !type || !amount || !method || !details) {
        return res.status(400).json({ error: "သတင်းအချက်အလက် မပြည့်စုံပါ။" });
    }

    try {
        // သတ်မှတ်ထားသော 'transactions' သို့မဟုတ် 'financial_requests' ထဲသို့ မှတ်တမ်းလှမ်းထည့်ခြင်း
        // Supabase ထဲတွင် 'transactions' table မရှိပါက ပျက်ကျမသွားစေရန် တိုက်ရိုက် insert လုပ်ပါသည်
        const { error } = await supabase
            .from('transactions')
            .insert([{
                username,
                type,
                amount: parseFloat(amount),
                method,
                details,
                status: 'PENDING'
            }]);

        if (error) {
            console.error("Supabase Tx Insert Error:", error.message);
            throw error;
        }

        res.json({ success: true, message: "တောင်းဆိုမှုအား Admin ထံ ပေးပို့လိုက်ပါပြီ။" });
    } catch (err) {
        console.error("Transaction Error:", err.message);
        res.status(500).json({ error: "ဆာဗာအတွင်း ဒေတာသိမ်းဆည်းရန် အမှားတက်နေပါသည် - " + err.message });
    }
});

// ----------------- ADMIN DASHBOARD MANAGEMENT (NEW) -----------------

// ၄။ Admin Login API
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    // ရိုးရှင်းပြီး လုံခြုံစေရန် ယာယီ Admin System အဖြစ် သတ်မှတ်ခြင်း (သင့်တော်သလိုပြောင်းလဲနိုင်သည်)
    if (username === 'admin' && password === 'admin1234') {
        return res.json({ success: true, token: 'admin_live_authenticated' });
    }
    return res.status(400).json({ error: "အက်ဒမင် အကောင့်ဝင်ရောက်ခွင့် ငြင်းပယ်ခံရပါသည်၊၊" });
});

// ၅။ Admin မှ Pending ဖြစ်နေသော ငွေသွင်း/ငွေထုတ် စာရင်းအားလုံးကို ဆွဲယူသည့် API
app.get('/api/admin/transactions', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('status', 'PENDING')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ၆။ Admin က Approve သို့မဟုတ် Reject လုပ်သည့်အခါ ရှင်းပေးသည့် API
app.post('/api/admin/process-transaction', async (req, res) => {
    const { txId, action } = req.body; // action = 'APPROVED' သို့မဟုတ် 'REJECTED'

    try {
        // ၁။ ထို transaction ကို အရင်ရှာသည်
        const { data: tx, error: findError } = await supabase
            .from('transactions')
            .select('*')
            .eq('id', txId)
            .single();

        if (findError || !tx) return res.status(404).json({ error: "အရောင်းအဝယ်မှတ်တမ်း ရှာမတွေ့ပါ။" });
        if (tx.status !== 'PENDING') return res.status(400).json({ error: "ဤမှတ်တမ်းအား စစ်ဆေးပြီးဖြစ်ပါသည်။" });

        // ၂။ အကယ်၍ APPROVE ဖြစ်ပြီး ငွေသွင်း (deposit) ဆိုလျှင် User Balance ထဲ ပိုက်ဆံပေါင်းပေးရန်
        if (action === 'APPROVED') {
            const { data: user, error: userError } = await supabase
                .from('users')
                .select('balance')
                .eq('username', tx.username)
                .single();

            if (!userError && user) {
                let updatedBalance = user.balance;
                if (tx.type === 'deposit') {
                    updatedBalance += tx.amount;
                } else if (tx.type === 'withdraw') {
                    // ငွေထုတ်ဆိုလျှင် request စတင်ချိန်ကတည်းကမနှုတ်ထားပါက ဤနေရာတွင် နှုတ်ပါမည်
                    if(user.balance >= tx.amount) {
                        updatedBalance -= tx.amount;
                    } else {
                        return res.status(400).json({ error: "အသုံးပြုသူတွင် ထုတ်ယူရန် လက်ကျန်ငွေမလုံလောက်ပါ။" });
                    }
                }

                // User balance သွားပြင်ရန်
                await supabase.from('users').update({ balance: updatedBalance }).eq('username', tx.username);
            }
        }

        // ၃။ Transaction status ကို ပြောင်းလဲသိမ်းဆည်းခြင်း
        await supabase.from('transactions').update({ status: action }).eq('id', txId);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ----------------- BETTING SYSTEM -----------------

// ၇။ Betting Place API
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

        const newBalance = user.balance - amount;
        const { error: updateError } = await supabase
            .from('users')
            .update({ balance: newBalance })
            .eq('username', username);

        if (updateError) {
            return res.status(500).json({ error: "Balance နှုတ်ယူရာတွင် အမှားတက်သွားသည်။" });
        }

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
            await supabase.from('users').update({ balance: user.balance }).eq('username', username);
            return res.status(500).json({ error: "လောင်းကြေးမှတ်တမ်း တင်ရာတွင် အမှားတက်သွားသည်။" });
        }

        res.json({ success: true, newBalance });

    } catch (err) {
        console.error("Betting Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ၈။ Frontend မှ ခေါ်ဆိုသော Bet History နေရာနှင့် ဆာဗာအား ချိတ်ဆက်မှုပုံစံ တူညီအောင်ပြင်ဆင်ခြင်း
app.get('/api/bet-history', async (req, res) => {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: "Username လိုအပ်ပါသည်။" });

    try {
        // html က လောင်းကြေးမှတ်တမ်းဇယားထဲ ပွဲအမည်တွေပြဖို့အတွက် bet ရော match table ကိုပါ join ပြီးဆွဲရန် 
        // သို့မဟုတ် ရိုးရိုးရှင်းရှင်း bets ထဲက data ပြရန်
        const { data, error } = await supabase
            .from('bets')
            .select('*')
            .eq('username', username)
            .order('created_at', { ascending: false }); 

        if (error) throw error;
        
        // Frontend က မျှော်လင့်ထားတဲ့ team_a နဲ့ team_b မပါခဲ့ရင် crash မဖြစ်အောင် ယာယီဖြည့်ပေးခြင်း
        const formattedData = data.map(item => ({
            ...item,
            team_a: item.team_a || 'Match ID',
            team_b: item.team_b || item.match_id
        }));

        res.json(formattedData);
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
app.listen(PORT, () => console.log(`Server running on port ${PORT} with Full Financial & Betting Sync Engine Live.`));
