// CSQ TEST ENDPOINT
app.post('/api/csq/topup', async (req, res) => {
    const axios = require('axios');
    const { phone, amount = 10 } = req.body;
    
    try {
        const loginResponse = await axios.post('https://lattest.mitopup.com/api/dislogin', {
            username: 'enviadespensa',
            password: 'ENV!d32025#',
            user_uid: '20060916',
            dist_api: '38aa13413d1431fba1824f2633c2b7d67f5fffcb91b043629a0d1fe09df2fb8d'
        });
        
        const topupResponse = await axios.post('https://lattest.mitopup.com/api/tn/fast', {
            targetMSISDN: phone.replace(/^\+52/, '').replace(/^52/, ''),
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
