const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', version: 'simple' });
});

// CSQ Test Endpoint
app.post('/api/csq/topup', async (req, res) => {
    const { phone } = req.body;
    
    try {
        // Login to LATCOM
        const loginResponse = await axios.post('https://lattest.mitopup.com/api/dislogin', {
            username: 'enviadespensa',
            password: 'ENV!d32025#',
            user_uid: '20060916',
            dist_api: '38aa13413d1431fba1824f2633c2b7d67f5fffcb91b043629a0d1fe09df2fb8d'
        });
        
        // Send topup
        const topupResponse = await axios.post('https://lattest.mitopup.com/api/tn/fast', {
            targetMSISDN: phone,
            dist_transid: `CSQ${Date.now()}`,
            operator: "TELEFONICA",
            country: "MEXICO",
            currency: "USD",
            amount: 10,
            productId: "TFE_MEXICO_TOPUP_103_2579_MXN",
            skuID: "0",
            service: 2
        }, {
            headers: { 'Authorization': `Bearer ${loginResponse.data.access}` }
        });
        
        res.json({ success: true, result: topupResponse.data });
    } catch (err) {
        res.json({ success: false, error: err.response?.data || err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Simple server running on port ${PORT} - NO DATABASE`);
});
