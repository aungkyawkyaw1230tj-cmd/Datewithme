require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// CSS/JS ဖိုင်တွေကို အလုပ်လုပ်စေဖို့ (index.html ရှိတဲ့နေရာကို သတ်မှတ်ခြင်း)
app.use(express.static(__dirname));

// Supabase ချိတ်ဆက်ခြင်း
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ၁။ Home Page (Website) ကို ပြသရန်
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ၂။ ပွဲစဉ်အားလုံး ဆွဲထုတ်ရန် API
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

// ၃။ ပွဲစဉ်တစ်ခုချင်းစီရဲ့ အချက်အလက် (ID နဲ့ရှာရန်)
app.get('/api/matches/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { data, error } = await supabase
            .from('matches')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
