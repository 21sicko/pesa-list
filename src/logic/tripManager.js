// tripManager.js — Pure logic, zero React Native dependencies
// Test with: node tests/test-trip.js

const { parseMpesasms } = require('./smsMatcher');

const AUTO_END_MINUTES = 30;

function createTrip(id = null) {
  return {
    id: id || `trip_${Date.now()}`,
    status: 'active',
    startedAt: new Date().toISOString(),
    endedAt: null,
    payments: [],
    expected: [],
    expenses: [],
    transactions: new Set(),
  };
}

function shouldAutoEnd(trip) {
  if (!trip || trip.status !== 'active') return false;
  const lastActivity = getLastActivityTime(trip);
  const minutesSince = (Date.now() - lastActivity) / (1000 * 60);
  return minutesSince >= AUTO_END_MINUTES;
}

function getLastActivityTime(trip) {
  if (!trip.payments.length && !trip.expected.length) {
    return new Date(trip.startedAt).getTime();
  }
  const lastPayment = trip.payments[trip.payments.length - 1];
  const lastExpected = trip.expected[trip.expected.length - 1];
  const pTime = lastPayment ? new Date(lastPayment.receivedAt).getTime() : 0;
  const eTime = lastExpected ? new Date(lastExpected.addedAt).getTime() : 0;
  return Math.max(pTime, eTime, new Date(trip.startedAt).getTime());
}

function endTrip(trip) {
  if (!trip) return null;
  return {
    ...trip,
    status: 'ended',
    endedAt: new Date().toISOString(),
  };
}

function addPayment(trip, smsText, senderId) {
  if (!trip || trip.status !== 'active') {
    return { trip: trip || createTrip(), added: false, reason: 'Auto-started new trip' };
  }

  const parsed = parseMpesasms(smsText, senderId);
  if (!parsed.isValid) {
    return { trip, added: false, reason: parsed.reason };
  }

  if (parsed.transactionCode && trip.transactions.has(parsed.transactionCode)) {
    return { trip, added: false, reason: 'Duplicate transaction code' };
  }

  const newPayment = {
    id: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    transactionCode: parsed.transactionCode,
    amount: parsed.amount,
    senderName: parsed.senderName,
    senderPhone: parsed.senderPhone,
    checked: false,
    matchedFromExpected: false,
    receivedAt: new Date().toISOString(),
  };

  let updatedTrip = {
    ...trip,
    transactions: new Set([...trip.transactions, parsed.transactionCode]),
    payments: [...trip.payments, newPayment]
  };

  const matchResult = tryMatchExpected(updatedTrip, parsed.senderName, parsed.amount);
  if (matchResult.matched) {
    updatedTrip.payments[updatedTrip.payments.length - 1].matchedFromExpected = true;
    updatedTrip.expected = matchResult.updatedExpected;
  }

  return { trip: updatedTrip, added: true, payment: updatedTrip.payments[updatedTrip.payments.length - 1] };
}

function tryMatchExpected(trip, senderName, amount = null) {
  const normalizedSender = senderName.trim().toUpperCase();
  const unmatched = trip.expected.filter(e => !e.matched);

  // Score every plausible candidate instead of taking the first substring hit —
  // otherwise a shorter/earlier name (e.g. "JOHN") can steal a payment that
  // actually belongs to a more specific later one (e.g. "JOHNSON").
  let best = null;
  let bestScore = -1;

  for (const e of unmatched) {
    const isExact = e.passengerName === normalizedSender;
    const isSubstring = normalizedSender.includes(e.passengerName) || e.passengerName.includes(normalizedSender);
    if (!isExact && !isSubstring) continue;

    let score = isExact ? 10000 : e.passengerName.length;
    if (e.expectedAmount != null && amount != null) {
      if (e.expectedAmount === amount) score += 5000;
      else score -= 2000; // amount mismatch — still possible (fare changed) but de-prioritized
    }

    if (score > bestScore) {
      bestScore = score;
      best = e;
    }
  }

  if (best) {
    const paymentId = trip.payments[trip.payments.length - 1]?.id;
    const updatedExpected = trip.expected.map(e => 
      e.id === best.id 
        ? { ...e, matched: true, matchedPaymentId: paymentId }
        : e
    );
    return { matched: true, updatedExpected, matchedExpectedId: best.id };
  }
  return { matched: false, updatedExpected: trip.expected };
}

function addExpectedPayment(trip, passengerName, expectedAmount) {
  if (!trip || trip.status !== 'active') {
    return { trip: trip || createTrip(), added: false, reason: 'Auto-started new trip' };
  }

  const newExpected = {
    id: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    passengerName: passengerName.trim().toUpperCase(),
    expectedAmount: expectedAmount || null,
    addedAt: new Date().toISOString(),
    matched: false,
    matchedPaymentId: null,
  };

  return {
    trip: { ...trip, expected: [...trip.expected, newExpected] },
    added: true,
    expected: newExpected
  };
}

function addExpense(trip, category, amount) {
  if (!trip || trip.status !== 'active') return trip;
  const newExpense = {
    id: `expn_${Date.now()}`,
    category: category.trim().toUpperCase(),
    amount: parseFloat(amount) || 0,
    addedAt: new Date().toISOString(),
  };
  return {
    ...trip,
    expenses: [...(trip.expenses || []), newExpense]
  };
}

function toggleChecked(trip, paymentId) {
  if (!trip) return trip;
  return {
    ...trip,
    payments: trip.payments.map(p => 
      p.id === paymentId ? { ...p, checked: !p.checked } : p
    )
  };
}

function searchPayments(trip, query) {
  if (!query || query.trim() === '') {
    return {
      payments: trip.payments,
      expected: trip.expected.filter(e => !e.matched)
    };
  }
  const q = query.trim().toUpperCase();
  const isNumeric = /^\d+$/.test(q);

  return {
    payments: trip.payments.filter(p =>
      p.senderName.includes(q) ||
      (p.senderPhone && p.senderPhone.includes(q)) ||
      (isNumeric && p.amount && p.amount.toString().includes(q))
    ),
    expected: trip.expected.filter(e =>
      !e.matched &&
      (e.passengerName.includes(q) || (isNumeric && e.expectedAmount && e.expectedAmount.toString().includes(q)))
    )
  };
}

function getTripTotals(trip) {
  if (!trip || !trip.payments) {
    return {
      totalCollected: 0,
      totalChecked: 0,
      checkedCount: 0,
      pendingCount: 0,
      totalPayments: 0,
      unmatchedExpected: 0,
      totalExpenses: 0,
      netProfit: 0,
    };
  }
  const totalCollected = trip.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const checkedCount = trip.payments.filter(p => p.checked).length;
  const totalChecked = trip.payments.filter(p => p.checked).reduce((sum, p) => sum + (p.amount || 0), 0);
  const unmatchedExpected = (trip.expected || []).filter(e => !e.matched).length;
  const pendingCount = trip.payments.length - checkedCount;
  const totalExpenses = (trip.expenses || []).reduce((sum, e) => sum + (e.amount || 0), 0);

  return {
    totalCollected: Math.round(totalCollected * 100) / 100,
    totalChecked: Math.round(totalChecked * 100) / 100,
    checkedCount,
    pendingCount,
    totalPayments: trip.payments.length,
    unmatchedExpected,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    netProfit: Math.round((totalCollected - totalExpenses) * 100) / 100,
  };
}

function getRecentUnmatchedPayments(trip, limit = 5) {
  if (!trip) return [];
  return trip.payments
    .filter(p => !p.checked)
    .slice(-limit)
    .reverse();
}

// NEW: Export trip as plain text for WhatsApp sharing
function exportTripAsText(trip) {
  if (!trip) return 'No trip data.';
  const totals = getTripTotals(trip);
  const date = new Date(trip.startedAt).toLocaleDateString('en-KE');
  const time = new Date(trip.startedAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });

  let text = `*Pesa List - Trip Record*\n`;
  text += `Date: ${date} at ${time}\n`;
  text += `Status: ${trip.status.toUpperCase()}\n`;
  text += `Total Collected: Ksh ${totals.totalCollected.toLocaleString()}\n`;
  text += `Passengers: ${totals.totalPayments} (Checked: ${totals.checkedCount})\n`;
  text += `---\n`;

  if (trip.payments.length === 0) {
    text += 'No payments recorded.\n';
  } else {
    trip.payments.forEach((p, i) => {
      const status = p.checked ? '✅' : '⏳';
      text += `${i + 1}. ${status} ${p.senderName} - Ksh ${p.amount?.toLocaleString() || 0}`;
      if (p.senderPhone) text += ` (···${p.senderPhone.slice(-4)})`;
      text += `\n`;
    });
  }

  return text;
}

// NEW: Format trip for history list display
function formatTripForHistory(trip) {
  const totals = getTripTotals(trip);
  const date = new Date(trip.startedAt);
  return {
    id: trip.id,
    date: date.toLocaleDateString('en-KE'),
    time: date.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }),
    total: totals.totalCollected,
    count: totals.totalPayments,
    checked: totals.checkedCount,
    status: trip.status,
  };
}

function serializeTrip(trip) {
  return JSON.stringify({
    ...trip,
    transactions: Array.from(trip.transactions),
  });
}

function deserializeTrip(jsonString) {
  try {
    if (!jsonString) return createTrip();
    const parsed = JSON.parse(jsonString);
    return {
      ...parsed,
      payments: parsed.payments || [],
      expected: parsed.expected || [],
      expenses: parsed.expenses || [],
      transactions: new Set(parsed.transactions || []),
    };
  } catch (e) {
    console.error('Failed to deserialize trip', e);
    return createTrip();
  }
}

// NEW: Get all payments sorted — Alphabetical by senderName
function getAllPaymentsSorted(trip) {
  if (!trip) return [];
  return [...trip.payments].sort((a, b) => {
    return a.senderName.localeCompare(b.senderName);
  });
}

// NEW: Get lifetime stats from history
function getLifetimeStats(history) {
  if (!history || history.length === 0) {
    return { totalCollected: 0, totalTrips: 0, totalPassengers: 0 };
  }

  return history.reduce((acc, trip) => {
    const totals = getTripTotals(trip);
    return {
      totalCollected: acc.totalCollected + totals.totalCollected,
      totalTrips: acc.totalTrips + 1,
      totalPassengers: acc.totalPassengers + totals.totalPayments,
    };
  }, { totalCollected: 0, totalTrips: 0, totalPassengers: 0 });
}

module.exports = {
  createTrip,
  endTrip,
  addPayment,
  addExpectedPayment,
  addExpense,
  toggleChecked,
  searchPayments,
  getTripTotals,
  getRecentUnmatchedPayments,
  shouldAutoEnd,
  serializeTrip,
  deserializeTrip,
  exportTripAsText,
  formatTripForHistory,
  getAllPaymentsSorted,
  getLifetimeStats,
};
