require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

// 1. Home Page Route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 2. ပွဲစဉ်အားလုံး ဆွဲထုတ်ရန် API (Football & Esports အကုန်ပါမယ်)
app.get('/api/matches', async (req, res) => {
    try {
        // Supabase table နာမည်က 'matches' လို့ ယူဆထားပါတယ်
        const { data, error } = await supabase
            .from('match')
            .select('*');

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Category အလိုက် ပွဲစဉ်ခွဲထုတ်ရန် (Optional - အရေးကြီးပါတယ်)
app.get('/api/matches/:category', async (req, res) => {
    const { category } = req.params;
    try {
        const { data, error } = await supabase
            .from('matches')
            .select('*')
            .eq('game_type', category); // Supabase မှာ game_type column ရှိဖို့လိုမယ်

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
