// WORKING TEST ENDPOINT FOR LATCOM
app.post('/api/test-topup', async (req, res) => {
    try {
        const { phone, amount, type = 'topup' } = req.body;
        
        console.log('Test request:', { phone, amount, type });
        
        // Step 1: Login to LATCOM
        const loginPayload = {
            username: process.env.LATCOM_USERNAME || 'enviadespensa',
            password: process.env.LATCOM_PASSWORD || 'ENV!d32025#',
            user_uid: process.env.LATCOM_USER_UID || '20060916',
            dist_api: process.env.LATCOM_DIST_API || '38aa13413d1431fba1824f2633c2b7d67f5fffcb91b043629a0d1fe09df2fb8d'
        };
        
        console.log('Login with:', { username: loginPayload.username, user_uid: loginPayload.user_uid });
        
        const loginResponse = await axios.post('https://lattest.mitopup.com/api/dislogin', loginPayload);
        const token = loginResponse.data.access;
        console.log('Got token:', token ? 'Yes' : 'No');
        
        // Step 2: Prepare topup based on type
        let latcomPayload;
        
        if (type === 'bundle') {
            // Bundle example
            latcomPayload = {
                targetMSISDN: phone.replace(/^\+52/, '').replace(/^52/, ''),
                dist_transid: `BUNDLE${Date.now()}`,
                operator: "TELEFONICA",
                country: "MEXICO",
                currency: "USD",
                amount: 0,
                productId: "TEMXN_BFRIQUIN_28_DAYS",
                skuID: "BFRIQUIN",
                service: 1
            };
        } else {
            // Topup example (default)
            latcomPayload = {
                targetMSISDN: phone.replace(/^\+52/, '').replace(/^52/, ''),
                dist_transid: `TOPUP${Date.now()}`,
                operator: "TELEFONICA",
                country: "MEXICO",
                currency: "USD",
                amount: amount || 10,
                productId: "TFE_MEXICO_TOPUP_103_2579_MXN",
                skuID: "0",
                service: 2
            };
        }
        
        console.log('Sending to LATCOM:', latcomPayload);
        
        // Step 3: Send to LATCOM
        const latcomResponse = await axios.post(
            'https://lattest.mitopup.com/api/tn/fast',
            latcomPayload,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            }
        );
        
        res.json({
            success: true,
            response: latcomResponse.data,
            transactionId: latcomPayload.dist_transid
        });
        
    } catch (error) {
        console.error('Error details:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            error: error.response?.data || error.message,
            details: error.response?.data
        });
    }
});

// CUSTOMER-FACING ENDPOINT (What CSQ will call)
app.post('/api/customer/topup', async (req, res) => {
    try {
        const apiKey = req.headers['x-api-key'];
        const { phone, amount } = req.body;
        
        // Validate API key
        if (apiKey !== 'csq_customer_001' && apiKey !== 'relier_client_2025') {
            return res.status(401).json({ success: false, error: 'Invalid API key' });
        }
        
        // Apply customer discount (18% for CSQ)
        const customerDiscount = apiKey === 'csq_customer_001' ? 0.18 : 0.10;
        const finalAmount = amount * (1 - customerDiscount);
        
        // Here you would call the LATCOM API
        // For now, just return the calculation
        
        res.json({
            success: true,
            customer: apiKey,
            requestedAmount: amount,
            discount: `${customerDiscount * 100}%`,
            chargedAmount: finalAmount,
            message: 'Ready for processing'
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
