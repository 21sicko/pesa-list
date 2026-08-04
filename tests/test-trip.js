// test-trip.js — Run with: node tests/test-trip.js
const {
  createTrip, addPayment, addExpectedPayment, toggleChecked,
  getTripTotals, getRecentUnmatchedPayments, shouldAutoEnd,
  exportTripAsText, formatTripForHistory, serializeTrip, deserializeTrip
} = require('../src/logic');

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function run() {
  // 1. Create trip
  let trip = createTrip();
  assert(trip.status === 'active', 'Trip should be active');
  assert(trip.payments.length === 0, 'No payments yet');

  // 2. Add payment
  let result = addPayment(trip, 'S98GE969 Confirmed. You have received Ksh50 from JOHN DOE 254700123456 On 8/5/10 at 10:22 AM.', 'MPESA');
  assert(result.added, 'Payment should be added');
  trip = result.trip;
  assert(trip.payments.length === 1, 'Should have 1 payment');
  assert(trip.payments[0].amount === 50, 'Amount should be 50');

  // 3. Duplicate guard
  result = addPayment(trip, 'S98GE969 Confirmed. You have received Ksh50 from JOHN DOE 254700123456 On 8/5/10.', 'MPESA');
  assert(!result.added, 'Duplicate should be rejected');

  // 4. Add expected
  result = addExpectedPayment(trip, 'JANE', 50);
  assert(result.added, 'Expected should be added');
  trip = result.trip;
  assert(trip.expected.length === 1, 'Should have 1 expected');

  // 5. Auto-match
  result = addPayment(trip, 'Confirmed. You have received Ksh50 from JANE WANJIRU 0722123456 On 1/8/26.', 'MPESA');
  assert(result.added, 'Payment should be added');
  trip = result.trip;
  assert(trip.expected[0].matched, 'Expected should be auto-matched');

  // 6. Toggle checked
  trip = toggleChecked(trip, trip.payments[0].id);
  assert(trip.payments[0].checked, 'Should be checked');

  // 7. Totals
  const totals = getTripTotals(trip);
  assert(totals.totalCollected === 100, 'Total collected should be 100');
  assert(totals.checkedCount === 1, '1 checked');
  assert(totals.pendingCount === 1, '1 pending');

  // 8. Recent unmatched
  const recent = getRecentUnmatchedPayments(trip, 5);
  assert(recent.length === 1, '1 unmatched payment');

  // 9. Auto-end (simulate old trip with no recent activity)
  const oldTrip = createTrip();
  oldTrip.startedAt = new Date(Date.now() - 31 * 60 * 1000).toISOString();
  assert(shouldAutoEnd(oldTrip), 'Old trip should auto-end');

  // 10. Export as text
  const exportText = exportTripAsText(trip);
  assert(exportText.includes('Pesa List'), 'Export should include app name');
  assert(exportText.includes('Ksh 100'), 'Export should include total');
  assert(exportText.includes('JOHN DOE'), 'Export should include passenger name');

  // 11. Format for history
  const histMeta = formatTripForHistory(trip);
  assert(histMeta.total === 100, 'History total should be 100');
  assert(histMeta.count === 2, 'History count should be 2');

  // 12. Serialize / deserialize
  const serialized = serializeTrip(trip);
  const deserialized = deserializeTrip(serialized);
  assert(deserialized.payments.length === 2, 'Deserialized should have 2 payments');
  assert(deserialized.transactions instanceof Set, 'Transactions should be a Set');

  console.log('✅ All trip logic tests passed');
}

function runMatchingSpecificity() {
  // Regression test: overlapping names must not steal each other's payments.
  // "JOHN" was added first but the payment is clearly JOHNSON's (exact name + amount match).
  let trip = createTrip();
  ({ trip } = addExpectedPayment(trip, 'JOHN', 50));
  ({ trip } = addExpectedPayment(trip, 'JOHNSON', 200));

  const result = addPayment(
    trip,
    'AB12CD99 Confirmed. You have received Ksh200 from JOHNSON MWANGI 0722000111 On 1/8/26 at 9:00 AM.',
    'MPESA'
  );
  assert(result.added, 'Payment should be added');
  trip = result.trip;

  const john = trip.expected.find(e => e.passengerName === 'JOHN');
  const johnson = trip.expected.find(e => e.passengerName === 'JOHNSON');
  assert(!john.matched, 'JOHN (Ksh50) should NOT be matched to a Ksh200 payment from Johnson');
  assert(johnson.matched, 'JOHNSON (Ksh200) should be matched — exact name and amount agree');

  console.log('✅ Overlapping-name matching specificity test passed');
}

try {
  run();
  runMatchingSpecificity();
} catch (e) {
  console.error('❌', e.message);
  process.exit(1);
}
