// test-matcher.js — Run with: node tests/test-matcher.js
const { parseMpesasms } = require('../src/logic');

const tests = [
  {
    sender: 'MPESA',
    text: 'S98GE969 Confirmed. You have received Ksh3,000 from JOHN DOE 254700123456 On 8/5/10 at 10:22 AM New M-PESA balance is Ksh7,500.',
    expect: { valid: true, name: 'JOHN DOE', amount: 3000 }
  },
  {
    sender: 'MPESA',
    text: 'Confirmed, you have received Ksh 1,500 from Daniel Mutua 076734XXXX on 8/1/2026 at 11:30 AM. New M-PESA balance is Ksh 2,500.',
    expect: { valid: true, name: 'DANIEL MUTUA', amount: 1500 }
  },
  {
    sender: 'MPESA',
    text: 'AB12CD34 Confirmed. You have received Ksh250 from JANE WANJIRU 0722000*** On 1/8/26 at 2:15 PM New M-PESA balance is Ksh1,250.',
    expect: { valid: true, name: 'JANE WANJIRU', amount: 250 }
  },
  {
    sender: 'MPESA',
    text: 'Ksh500 received from PETER KAMAU 0722123456',
    expect: { valid: true, name: 'PETER KAMAU', amount: 500 }
  },
  {
    sender: 'SAFARICOM',
    text: 'S98GE969 Confirmed. You have received Ksh3,000 from JOHN DOE 254700123456',
    expect: { valid: false }
  },
  {
    sender: 'MPESA',
    text: 'Your M-PESA balance is Ksh5,000.',
    expect: { valid: false }
  },
  {
    // Must be rejected: reversed transactions should never count as a real payment
    sender: 'MPESA',
    text: 'TFG4H8J2 Confirmed. Ksh500.00 sent to JOHN DOE 0722123456 has been reversed. Your M-PESA balance is Ksh2,500.00.',
    expect: { valid: false }
  },
  {
    // Must be rejected: outgoing payment, not incoming
    sender: 'MPESA',
    text: 'TFG4H8J3 Confirmed. Ksh200.00 sent to MARY WANJIKU 0733123456 on 1/8/26 at 3:00 PM. New M-PESA balance is Ksh1,800.00.',
    expect: { valid: false }
  },
  {
    // Hyphenated name (bug found during review — was silently dropping valid payments)
    sender: 'MPESA',
    text: 'TFG4H8J8 Confirmed. You have received Ksh450.00 from MARY-JANE ACHIENG 0755667788 on 1/8/26 at 8:00 PM New M-PESA balance is Ksh1,450.00.',
    expect: { valid: true, name: 'MARY-JANE ACHIENG', amount: 450 }
  },
  {
    // Single-word sender name
    sender: 'MPESA',
    text: 'TFG4H8J4 Confirmed. You have received Ksh150.00 from KAMAU 0711223344 on 1/8/26 at 4:12 PM New M-PESA balance is Ksh900.00.',
    expect: { valid: true, name: 'KAMAU', amount: 150 }
  },
  {
    // Decimal cents, no thousands comma
    sender: 'MPESA',
    text: 'TFG4H8J5 Confirmed. You have received Ksh80.50 from LUCY ATIENO 0700111222 on 1/8/26 at 5:00 PM New M-PESA balance is Ksh980.50.',
    expect: { valid: true, name: 'LUCY ATIENO', amount: 80.5 }
  },
  {
    // Till/business payment format ("for account ...")
    sender: 'MPESA',
    text: 'TFG4H8J7 Confirmed. Ksh1,000.00 received from JANE MUTHONI 0722334455 for account KIOSK1 on 1/8/26 at 7:00 PM. New Business balance is Ksh10,000.00.',
    expect: { valid: true, name: 'JANE MUTHONI', amount: 1000, account: 'KIOSK1' }
  },
  {
    // New Paybill sample from user
    sender: 'MPESA',
    text: 'XYZ123ABC Confirmed. You have received Ksh50 from JOHN KAMAU 254700000000 for account 12345 on 1/8/26 at 11:33 AM New M-PESA balance is Ksh500.',
    expect: { valid: true, name: 'JOHN KAMAU', amount: 50, account: '12345' }
  },
  {
    // Paybill without code at start
    sender: 'MPESA',
    text: 'Confirmed. You have received Ksh200 from JANE DOE 254711223344 for account REF99 on 1/8/26 at 12:00 PM.',
    expect: { valid: true, name: 'JANE DOE', amount: 200, account: 'REF99' }
  },
  {
    // standard Till (Buy Goods) format — should still match and have null account
    sender: 'MPESA',
    text: 'Confirmed. You have received Ksh150 from SAM OMONDI 254722334455 on 1/8/26 at 1:00 PM.',
    expect: { valid: true, name: 'SAM OMONDI', amount: 150, account: null }
  },
  {
    // Pochi La Biashara format
    sender: 'MPESA',
    text: 'ABC123DEF4 Confirmed. You have received Ksh 100.00 from JANE DOE 254712345678 for your Pochi la Biashara on 20/08/2026 at 1:45 PM. Your Pochi la Biashara balance is Ksh 1200.00.',
    expect: { valid: true, name: 'JANE DOE', amount: 100, account: 'Pochi: Pochi la Biashara' }
  },
  {
    // SCAM TEST 1: Wrong Sender ID (Not MPESA)
    sender: '0722000111',
    text: 'XYZ123ABC Confirmed. You have received Ksh50 from JOHN DOE 254700000000 On 1/8/26 at 11:33 AM.',
    expect: { valid: false }
  },
  {
    // SCAM TEST 2: Look-alike message but missing "Confirmed"
    sender: 'MPESA',
    text: 'You have received Ksh1,000 from M-PESA agent. Go to any agent to withdraw.',
    expect: { valid: false }
  },
  {
    // SCAM TEST 3: Fake P2P format (Social engineering)
    sender: 'MPESA',
    text: 'Dear Customer, your account has been credited with Ksh 5,000. To reverse this, click http://fake-mpesa.com',
    expect: { valid: false }
  },
  {
    // SCAM TEST 4: "Request" message (User often mistake for payment)
    sender: 'MPESA',
    text: 'You have received a request for Ksh 300 from 0711223344. Dial *334# to pay.',
    expect: { valid: false }
  }
];

let passed = 0, failed = 0;

tests.forEach((t, i) => {
  const r = parseMpesasms(t.text, t.sender);
  let ok = true, errs = [];

  if (r.isValid !== t.expect.valid) { ok = false; errs.push(`valid=${r.isValid}, expected ${t.expect.valid}`); }
  if (t.expect.valid && r.isValid) {
    if (t.expect.name && r.senderName !== t.expect.name) { ok = false; errs.push(`name="${r.senderName}", expected "${t.expect.name}"`); }
    if (t.expect.amount && r.amount !== t.expect.amount) { ok = false; errs.push(`amount=${r.amount}, expected ${t.expect.amount}`); }
    if (t.expect.account !== undefined && r.accountRef !== t.expect.account) { ok = false; errs.push(`account="${r.accountRef}", expected "${t.expect.account}"`); }
  }

  console.log(ok ? `✅ Test ${i+1}` : `❌ Test ${i+1}: ${errs.join('; ')}`);
  ok ? passed++ : failed++;
});

console.log(`\n${passed}/${tests.length} passed, ${failed} failed`);
if (failed > 0) console.log('Add real SMS samples to tests/test-matcher.js (hide amounts) and adjust regex.');
