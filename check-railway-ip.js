const axios = require('axios');

async function checkIP() {
    try {
        const response = await axios.get('https://api.ipify.org?format=json');
        console.log('Railway Outbound IP:', response.data.ip);
    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkIP();
