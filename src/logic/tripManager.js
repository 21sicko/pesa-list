// tripManager.js — Pro logic with Multi-Loan Tracking (Fuliza, KCB, M-Shwari)
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
    fulizaLimit: 50000,
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
  const lastExpected = (trip.expected || [])[trip.expected.length - 1];
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

function addPayment(trip, smsText, senderId, overrideTimestamp = null) {
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
    type: parsed.type || 'RECEIVED',
    amount: parsed.amount,
    postBalance: parsed.postBalance,
    senderName: parsed.senderName,
    senderPhone: parsed.senderPhone,
    fulizaDebt: parsed.fulizaDebt || 0,
    kcbDebt: parsed.kcbDebt || 0,
    mshwariDebt: parsed.mshwariDebt || 0,
    isGambling: parsed.isGambling || false,
    checked: false,
    matchedFromExpected: false,
    receivedAt: overrideTimestamp ? (new Date(overrideTimestamp).toISOString()) : new Date().toISOString(),
    accountRef: parsed.accountRef || null
  };

  let updatedTrip = {
    ...trip,
    transactions: new Set([...(trip.transactions || []), parsed.transactionCode]),
    payments: [...(trip.payments || []), newPayment]
  };

  if (newPayment.type === 'RECEIVED') {
    const matchResult = tryMatchExpected(updatedTrip, parsed.senderName, parsed.amount);
    if (matchResult.matched) {
      updatedTrip.payments[updatedTrip.payments.length - 1].matchedFromExpected = true;
      updatedTrip.expected = matchResult.updatedExpected;
    }
  }

  return { trip: updatedTrip, added: true, payment: updatedTrip.payments[updatedTrip.payments.length - 1] };
}

function tryMatchExpected(trip, senderName, amount = null) {
  const normalizedSender = senderName.trim().toUpperCase();
  const unmatched = (trip.expected || []).filter(e => !e.matched);
  let best = null, bestScore = -1;
  for (const e of unmatched) {
    const isExact = e.passengerName === normalizedSender;
    const isSubstring = normalizedSender.includes(e.passengerName) || e.passengerName.includes(normalizedSender);
    if (!isExact && !isSubstring) continue;
    let score = isExact ? 10000 : e.passengerName.length;
    if (e.expectedAmount != null && amount != null) {
      if (e.expectedAmount === amount) score += 5000;
      else score -= 2000;
    }
    if (score > bestScore) { bestScore = score; best = e; }
  }
  if (best) {
    const paymentId = trip.payments[trip.payments.length - 1]?.id;
    const updatedExpected = trip.expected.map(e => e.id === best.id ? { ...e, matched: true, matchedPaymentId: paymentId } : e);
    return { matched: true, updatedExpected, matchedExpectedId: best.id };
  }
  return { matched: false, updatedExpected: trip.expected };
}

function addExpectedPayment(trip, passengerName, expectedAmount) {
  if (!trip || trip.status !== 'active') return { trip: trip || createTrip(), added: false };
  const newExpected = {
    id: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    passengerName: passengerName.trim().toUpperCase(),
    expectedAmount: expectedAmount || null,
    addedAt: new Date().toISOString(),
    matched: false,
    matchedPaymentId: null,
  };
  return { trip: { ...trip, expected: [...(trip.expected || []), newExpected] }, added: true, expected: newExpected };
}

function addExpense(trip, category, amount) {
  if (!trip || trip.status !== 'active') return trip;
  const newExpense = { id: `expn_${Date.now()}`, category: category.trim().toUpperCase(), amount: parseFloat(amount) || 0, addedAt: new Date().toISOString() };
  return { ...trip, expenses: [...(trip.expenses || []), newExpense] };
}

function toggleChecked(trip, paymentId) {
  if (!trip) return trip;
  return { ...trip, payments: trip.payments.map(p => p.id === paymentId ? { ...p, checked: !p.checked } : p) };
}

function searchPayments(trip, query) {
  if (!query || query.trim() === '') return { payments: trip.payments, expected: (trip.expected || []).filter(e => !e.matched) };
  const q = query.trim().toUpperCase();
  const isNumeric = /^\d+$/.test(q);
  return {
    payments: trip.payments.filter(p => p.senderName.includes(q) || (p.senderPhone && p.senderPhone.includes(q)) || (isNumeric && p.amount && p.amount.toString().includes(q))),
    expected: (trip.expected || []).filter(e => !e.matched && (e.passengerName.includes(q) || (isNumeric && e.expectedAmount && e.expectedAmount.toString().includes(q))))
  };
}

function getTripTotals(trip) {
  if (!trip || !trip.payments) return { totalCollected: 0, totalSent: 0, totalChecked: 0, checkedCount: 0, pendingCount: 0, totalPayments: 0, unmatchedExpected: 0, totalExpenses: 0, netProfit: 0, currentFulizaDebt: 0, latestMpesaBalance: 0, gamblingWasted: 0, reconciledBalance: 0, kcbLoan: 0, mshwariLoan: 0, totalLoanDebt: 0 };

  const received = trip.payments.filter(p => p.type === 'RECEIVED');
  const sent = trip.payments.filter(p => p.type === 'SENT');

  const totalCollected = received.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalSent = sent.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalChecked = received.filter(p => p.checked).reduce((sum, p) => sum + (p.amount || 0), 0);
  const checkedCount = received.filter(p => p.checked).length;
  const totalExpenses = (trip.expenses || []).reduce((sum, e) => sum + (e.amount || 0), 0);

  // Latest Debt status per provider
  const lastFuliza = [...trip.payments].reverse().find(p => p.fulizaDebt > 0);
  const lastKcb = [...trip.payments].reverse().find(p => p.kcbDebt > 0);
  const lastMshwari = [...trip.payments].reverse().find(p => p.mshwariDebt > 0);

  const currentFulizaDebt = lastFuliza ? lastFuliza.fulizaDebt : 0;
  const kcbLoan = lastKcb ? lastKcb.kcbDebt : 0;
  const mshwariLoan = lastMshwari ? lastMshwari.mshwariDebt : 0;
  const totalLoanDebt = currentFulizaDebt + kcbLoan + mshwariLoan;

  const lastWithBalance = [...trip.payments].reverse().find(p => p.postBalance !== null && p.postBalance !== undefined);
  const latestMpesaBalance = lastWithBalance ? lastWithBalance.postBalance : 0;

  // Gambling
  const gamblingSent = sent.filter(p => p.isGambling).reduce((sum, p) => sum + (p.amount || 0), 0);
  const gamblingReceived = received.filter(p => p.isGambling).reduce((sum, p) => sum + (p.amount || 0), 0);
  const gamblingWasted = Math.max(0, gamblingSent - gamblingReceived);

  // Financial Position: Cash - (All Loans)
  let reconciledBalance = latestMpesaBalance - totalLoanDebt;

  return {
    totalCollected: Math.round(totalCollected * 100) / 100,
    totalSent: Math.round(totalSent * 100) / 100,
    totalChecked: Math.round(totalChecked * 100) / 100,
    checkedCount,
    pendingCount: received.length - checkedCount,
    totalPayments: received.length,
    unmatchedExpected: (trip.expected || []).filter(e => !e.matched).length,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    netProfit: Math.round((totalCollected - totalSent - totalExpenses) * 100) / 100,
    currentFulizaDebt: Math.round(currentFulizaDebt * 100) / 100,
    kcbLoan: Math.round(kcbLoan * 100) / 100,
    mshwariLoan: Math.round(mshwariLoan * 100) / 100,
    totalLoanDebt: Math.round(totalLoanDebt * 100) / 100,
    latestMpesaBalance: Math.round(latestMpesaBalance * 100) / 100,
    reconciledBalance: Math.round(reconciledBalance * 100) / 100,
    gamblingWasted: Math.round(gamblingWasted * 100) / 100
  };
}

function serializeTrip(trip) { return JSON.stringify({ ...trip, transactions: Array.from(trip.transactions || []) }); }
function deserializeTrip(jsonString) {
  try {
    if (!jsonString) return createTrip();
    const parsed = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    return { ...parsed, payments: parsed.payments || [], expected: parsed.expected || [], expenses: parsed.expenses || [], transactions: new Set(parsed.transactions || []) };
  } catch (e) { return createTrip(); }
}

function getAllPaymentsSorted(trip) {
  if (!trip || !trip.payments) return [];
  return [...trip.payments].sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
}

function getLifetimeStats(history) {
  if (!history || history.length === 0) return { totalCollected: 0, totalSent: 0, totalTrips: 0, totalPassengers: 0, totalGamblingWasted: 0 };
  return history.reduce((acc, trip) => {
    const totals = getTripTotals(trip);
    return {
      totalCollected: acc.totalCollected + totals.totalCollected,
      totalSent: acc.totalSent + totals.totalSent,
      totalTrips: acc.totalTrips + 1,
      totalPassengers: acc.totalPassengers + totals.totalPayments,
      totalGamblingWasted: (acc.totalGamblingWasted || 0) + totals.gamblingWasted
    };
  }, { totalCollected: 0, totalSent: 0, totalTrips: 0, totalPassengers: 0, totalGamblingWasted: 0 });
}

function formatTripForHistory(trip) {
  const totals = getTripTotals(trip);
  const date = new Date(trip.startedAt);
  return { id: trip.id, date: date.toLocaleDateString('en-KE'), time: date.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }), total: totals.totalCollected, count: totals.totalPayments, checked: totals.checkedCount, status: trip.status };
}

function exportTripAsText(trip) {
  if (!trip) return 'No trip data.';
  const totals = getTripTotals(trip);
  const date = new Date(trip.startedAt).toLocaleDateString('en-KE');
  const time = new Date(trip.startedAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
  let text = `*Pesa List - Record*\nDate: ${date} at ${time}\nStatus: ${trip.status.toUpperCase()}\nTotal Received: Ksh ${totals.totalCollected.toLocaleString()}\nTotal Sent: Ksh ${totals.totalSent.toLocaleString()}\nExpenses: Ksh ${totals.totalExpenses.toLocaleString()}\nNet Profit: Ksh ${totals.netProfit.toLocaleString()}\nM-Pesa Balance: Ksh ${totals.latestMpesaBalance.toLocaleString()}\nTotal Loan Debt: Ksh ${totals.totalLoanDebt.toLocaleString()}\n(Fuliza: ${totals.currentFulizaDebt}, KCB: ${totals.kcbLoan}, M-Shwari: ${totals.mshwariLoan})\nGambling Wasted: Ksh ${totals.gamblingWasted.toLocaleString()}\n---\n`;
  if (trip.payments.length === 0) text += 'No entries.\n';
  else trip.payments.forEach((p, i) => {
    const status = p.checked ? '✅' : '⏳';
    const typeSign = p.type === 'SENT' ? '-' : '+';
    const payDate = new Date(p.receivedAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
    text += `${i + 1}. ${status} [${p.type}] ${payDate}: ${p.senderName} - ${typeSign}Ksh ${p.amount?.toLocaleString() || 0}\n`;
  });
  return text;
}

module.exports = { createTrip, endTrip, addPayment, addExpectedPayment, addExpense, toggleChecked, searchPayments, getTripTotals, serializeTrip, deserializeTrip, getAllPaymentsSorted, getLifetimeStats, formatTripForHistory, exportTripAsText };
