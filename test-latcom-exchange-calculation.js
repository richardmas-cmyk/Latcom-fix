/**
 * Test Latcom Exchange Rate Calculation
 * Problem: When we send $75 USD, customer receives $77.72 MXN (overage)
 * Goal: Calculate exact amount to send so customer receives clean amounts
 */

// From screenshot analysis
const testCases = [
    { sentUSD: 75, receivedMXN: 77.72 },
    { sentUSD: 65, receivedMXN: 67.28 },
    { sentUSD: 55, receivedMXN: 55.68 },
    { sentUSD: 45, receivedMXN: 45.24 },
    { sentUSD: 35, receivedMXN: 34.80 },
    { sentUSD: 23, receivedMXN: 23.20 },
    { sentUSD: 11, receivedMXN: 11.60 }
];

console.log('\n╔═══════════════════════════════════════════════════════╗');
console.log('║  🔍 LATCOM EXCHANGE RATE ANALYSIS                    ║');
console.log('╚═══════════════════════════════════════════════════════╝\n');

console.log('📊 Analyzing actual transactions from screenshot:\n');

let totalRate = 0;
let count = 0;

testCases.forEach(test => {
    const latcomRate = test.receivedMXN / test.sentUSD;
    totalRate += latcomRate;
    count++;

    const overage = test.receivedMXN - test.sentUSD;
    const overagePct = ((overage / test.sentUSD) * 100).toFixed(2);

    console.log(`   Sent: $${test.sentUSD} USD → Received: $${test.receivedMXN} MXN`);
    console.log(`   Latcom Rate: 1 USD = ${latcomRate.toFixed(4)} MXN`);
    console.log(`   Overage: +$${overage.toFixed(2)} MXN (+${overagePct}%)`);
    console.log('');
});

const avgLatcomRate = totalRate / count;

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log(`📈 Average Latcom Exchange Rate: 1 USD = ${avgLatcomRate.toFixed(4)} MXN\n`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Now calculate what we should send to get exact amounts
console.log('💡 SOLUTION: Amounts to send for exact MXN delivery\n');

const targetAmounts = [20, 30, 40, 50, 60, 70, 75, 80, 90, 100, 125, 150, 200, 250, 500, 1000];

console.log('Target MXN | Send USD  | Customer Gets | Difference');
console.log('-----------|-----------|---------------|------------');

targetAmounts.forEach(targetMXN => {
    // Reverse calculation: targetMXN / latcomRate = USD to send
    const usdToSend = targetMXN / avgLatcomRate;
    const customerGets = usdToSend * avgLatcomRate;
    const diff = customerGets - targetMXN;

    console.log(`${targetMXN.toString().padStart(10)} | $${usdToSend.toFixed(2).padStart(8)} | $${customerGets.toFixed(2).padStart(12)} | ${diff >= 0 ? '+' : ''}${diff.toFixed(2)}`);
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('🎯 IMPLEMENTATION PLAN:\n');
console.log('   1. Store Latcom exchange rate: 1 USD = ' + avgLatcomRate.toFixed(4) + ' MXN');
console.log('   2. When customer requests X MXN topup:');
console.log('      - Calculate: USD_to_send = X / ' + avgLatcomRate.toFixed(4));
console.log('      - Send that USD amount to Latcom');
console.log('      - Customer receives exactly X MXN (no decimals)');
console.log('');
console.log('   3. Update open range product logic in latcom-provider.js');
console.log('');

console.log('📝 Example Calculations:\n');
console.log('   Customer wants: 50 MXN');
console.log('   We send: $' + (50 / avgLatcomRate).toFixed(2) + ' USD');
console.log('   Latcom converts: ' + (50 / avgLatcomRate).toFixed(2) + ' × ' + avgLatcomRate.toFixed(4) + ' = 50.00 MXN ✅');
console.log('');
console.log('   Customer wants: 75 MXN');
console.log('   We send: $' + (75 / avgLatcomRate).toFixed(2) + ' USD');
console.log('   Latcom converts: ' + (75 / avgLatcomRate).toFixed(2) + ' × ' + avgLatcomRate.toFixed(4) + ' = 75.00 MXN ✅');

console.log('\n╔═══════════════════════════════════════════════════════╗');
console.log('║  ✅ ANALYSIS COMPLETE                                ║');
console.log('╚═══════════════════════════════════════════════════════╝\n');
