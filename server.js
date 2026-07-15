require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Supabase ချိတ်ဆက်ခြင်း
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY; // Backend မှာ Secret Key သုံးပါ
const supabase = createClient(supabaseUrl, supabaseKey);

// 1. ပွဲစဉ်အားလုံး ဆွဲထုတ်ရန် API
app.get('/api/matches', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('matches')
            .select('*');

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. လောင်းကြေးအသစ် တင်ရန် API (ဥပမာ)
app.post('/api/bets', async (req, res) => {
    const { user_id, match_id, amount, choice } = req.body;
    
    try {
        const { data, error } = await supabase
            .from('bets')
            .insert([{ user_id, match_id, amount, choice }]);

        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
