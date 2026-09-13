// test-matcher.js — Run with: node tests/test-matcher.js
const { parseMpesasms } = require('../src/logic/smsMatcher');

const tests = [
  {
    sender: 'MPESA',
    text: 'S98GE969 Confirmed. You have received Ksh3,000 from JOHN DOE 254700123456 On 8/5/10 at 10:22 AM New M-PESA balance is Ksh7,500.',
    expect: { valid: true, type: 'RECEIVED', name: 'JOHN DOE', amount: 3000, balance: 7500 }
  },
  {
    sender: 'MPESA',
    text: 'Confirmed, you have received Ksh 1,500 from Daniel Mutua 076734XXXX on 8/1/2026 at 11:30 AM. New M-PESA balance is Ksh 2,500.',
    expect: { valid: true, type: 'RECEIVED', name: 'DANIEL MUTUA', amount: 1500, balance: 2500 }
  },
  {
    sender: 'MPESA',
    text: 'TFG4H8J3 Confirmed. Ksh200.00 sent to MARY WANJIKU 0733123456 on 1/8/26 at 3:00 PM. New M-PESA balance is Ksh1,800.00.',
    expect: { valid: true, type: 'SENT', name: 'MARY WANJIKU', amount: 200, balance: 1800 }
  },
  {
    // Betting Sent Test
    sender: 'MPESA',
    text: 'TFG4H8J4 Confirmed. Ksh 500.00 paid to SPORTPESA on 20/8/26 at 1:45 PM. New M-PESA balance is Ksh 1,300.00.',
    expect: { valid: true, type: 'SENT', name: 'SPORTPESA', amount: 500, gambling: true }
  },
  {
    // Betting Received Test (Withdrawal)
    sender: 'MPESA',
    text: 'TFG4H8J5 Confirmed. You have received Ksh 1,000.00 from BETIKA. New M-PESA balance is Ksh 2,300.00.',
    expect: { valid: true, type: 'RECEIVED', name: 'BETIKA', amount: 1000, gambling: true }
  },
  {
    // Fuliza Test
    sender: 'MPESA',
    text: 'OIG7H8J9 Confirmed. You have received Ksh1,000 from JANE DOE. Fuliza M-PESA amount was Ksh 250.00. New M-PESA balance is Ksh 750.00.',
    expect: { valid: true, type: 'RECEIVED', amount: 1000, fuliza: 250, balance: 750 }
  },
  {
    // Paybill Test
    sender: 'MPESA',
    text: 'PIG7H8J0 Confirmed. Ksh 2,500.00 paid to SAFARICOM HOME for account 12345678 on 21/8/26 at 9:00 AM. New M-PESA balance is Ksh 5,000.00.',
    expect: { valid: true, type: 'SENT', amount: 2500, balance: 5000 }
  }
];

let passed = 0, failed = 0;

tests.forEach((t, i) => {
  const r = parseMpesasms(t.text, t.sender);
  let ok = true, errs = [];

  if (r.isValid !== t.expect.valid) { ok = false; errs.push(`valid=${r.isValid}, expected ${t.expect.valid}`); }
  if (t.expect.valid && r.isValid) {
    if (t.expect.type && r.type !== t.expect.type) { ok = false; errs.push(`type="${r.type}", expected "${t.expect.type}"`); }
    if (t.expect.name && r.senderName !== t.expect.name) { ok = false; errs.push(`name="${r.senderName}", expected "${t.expect.name}"`); }
    if (t.expect.amount && r.amount !== t.expect.amount) { ok = false; errs.push(`amount=${r.amount}, expected ${t.expect.amount}`); }
    if (t.expect.balance !== undefined && r.postBalance !== t.expect.balance) { ok = false; errs.push(`balance=${r.postBalance}, expected ${t.expect.balance}`); }
    if (t.expect.fuliza !== undefined && r.fulizaDebt !== t.expect.fuliza) { ok = false; errs.push(`fuliza=${r.fulizaDebt}, expected ${t.expect.fuliza}`); }
    if (t.expect.gambling !== undefined && !!r.isGambling !== !!t.expect.gambling) { ok = false; errs.push(`gambling=${!!r.isGambling}, expected ${!!t.expect.gambling}`); }
  }

  console.log(ok ? `✅ Test ${i+1}` : `❌ Test ${i+1}: ${errs.join('; ')}`);
  ok ? passed++ : failed++;
});

console.log(`\n${passed}/${tests.length} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
