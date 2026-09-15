// smsMatcher.js — Ultimate Accounting Engine: Fees, Airtime, Betting, Multi-Loans & Reversals
const SAFARICOM_SENDER_IDS = ['MPESA', 'M-PESA', 'M_PESA'];

// Expanded betting keywords to catch companies like Metawebsolutions (BetFlame)
const BETTING_KEYWORDS = [
  'SPORTPESA', 'BETIKA', 'ODIBETS', 'MOZZART', 'BETWAY', '22BET',
  'MELBET', 'BETPAWA', 'KIBET', 'SHABIKI', 'DAFABET', 'LUCKYBIRD',
  'METAWEBSOLUTIONS', 'BETFLAME', 'CHOPBET', 'EAZIBET', 'GALSPORT',
  'ONFON', 'GAMING'
];

function isSafaricomSender(senderId) {
  if (!senderId) return false;
  const normalized = senderId.toString().toUpperCase().replace(/[-_\s]/g, '');
  return SAFARICOM_SENDER_IDS.includes(normalized) || normalized.includes('MPESA');
}

function parseAmount(amountStr) {
  if (!amountStr) return 0;
  const cleaned = amountStr.replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function cleanName(nameStr) {
  if (!nameStr) return 'UNKNOWN';
  return nameStr
    .replace(/for your Pochi.*/i, '')
    .replace(/for account.*/i, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function isGambling(name, accountRef) {
  const combined = `${name || ''} ${accountRef || ''}`.toUpperCase();
  return BETTING_KEYWORDS.some(site => combined.includes(site));
}

function parseMpesasms(smsText, senderId) {
  if (!smsText || !isSafaricomSender(senderId)) return { isValid: false };
  const text = smsText.trim();

  // High-level filter for financial confirmations
  if (!/Confirmed/i.test(text) && !/received/i.test(text) && !/sent/i.test(text) && !/paid/i.test(text) && !/bought/i.test(text) && !/transferred/i.test(text) && !/balance/i.test(text) && !/withdrawn/i.test(text) && !/reversal|reversed/i.test(text) && !/used to (?:repay|pay)/i.test(text)) return { isValid: false };
  if (/cancelled/i.test(text)) return { isValid: false };

  // 1. Extract M-PESA Balance
  const balanceMatch = text.match(/(?:New|M-PESA)\s+balance\s+is\s+Ksh\s*([\d,]+\.?\d{0,2})/i);
  const postBalance = balanceMatch ? parseAmount(balanceMatch[1]) : null;

  // 2. Detect Transaction Cost (Math Reconciliation)
  const costMatch = text.match(/Transaction\s+cost,\s+Ksh\s*([\d,]+\.?\d{0,2})/i);
  const txCost = costMatch ? parseAmount(costMatch[1]) : 0;

  // 3. Reversal — money credited back to the wallet
  const reversal = tryReversalPattern(text);
  if (reversal) {
    return {
      isValid: true, type: 'REVERSAL', postBalance, txCost: 0, fulizaDebt: 0, kcbDebt: 0, mshwariDebt: 0,
      isGambling: false, isUtility: false, ...reversal, rawText: text.substring(0, 120)
    };
  }

  // 4. Detect Loans
  const fulizaMatch = text.match(/Fuliza M-PESA amount\s+(?:is|was)\s+Ksh\s*([\d,]+\.?\d{0,2})/i);
  const fulizaDebt = fulizaMatch ? parseAmount(fulizaMatch[1]) : 0;
  const kcbMatch = text.match(/KCB M-PESA loan balance\s+is\s+Ksh\s*([\d,]+\.?\d{0,2})/i);
  const kcbDebt = kcbMatch ? parseAmount(kcbMatch[1]) : 0;
  const mshwariMatch = text.match(/M-Shwari loan balance\s+is\s+Ksh\s*([\d,]+\.?\d{0,2})/i);
  const mshwariDebt = mshwariMatch ? parseAmount(mshwariMatch[1]) : 0;

  // 5. Try "Received" patterns
  const received = tryReceivedPatterns(text);
  if (received) {
    return {
      isValid: true, type: 'RECEIVED', postBalance, txCost, fulizaDebt, kcbDebt, mshwariDebt,
      isGambling: isGambling(received.senderName, received.accountRef),
      isUtility: false, ...received, rawText: text.substring(0, 120)
    };
  }

  // 6. Try "Sent / Paid / Transferred / Bought / Withdrawn" patterns
  const sent = trySentPatterns(text);
  if (sent) {
    return {
      isValid: true, type: 'SENT', postBalance, txCost, fulizaDebt, kcbDebt, mshwariDebt,
      isGambling: isGambling(sent.senderName, null),
      isUtility: sent.isUtility || false, ...sent, rawText: text.substring(0, 120)
    };
  }

  // 7. Info updates
  if (kcbDebt > 0 || mshwariDebt > 0 || fulizaDebt > 0 || postBalance !== null) {
     return { isValid: true, type: 'INFO', postBalance, txCost, fulizaDebt, kcbDebt, mshwariDebt, senderName: 'SYSTEM UPDATE', amount: 0, transactionCode: `SYS_${Date.now()}` };
  }

  return { isValid: false };
}

function tryReversalPattern(text) {
  const rx1 = /reversal\s+of\s+Ksh\s*([\d,]+\.?\d{0,2})/i;
  const rx2 = /Ksh\s*([\d,]+\.?\d{0,2})\s+(?:has\s+been\s+)?reversed/i;
  const match = text.match(rx1) || text.match(rx2);
  if (!match) return null;

  const codeMatch = text.match(/\b([A-Z0-9]{8,12})\b/);
  const code = codeMatch ? `REV_${codeMatch[1]}` : `FB_REV_${Date.now()}`;

  return {
    transactionCode: code,
    amount: parseAmount(match[1]),
    senderName: 'M-PESA REVERSAL',
    senderPhone: null,
    parsedAt: new Date().toISOString(),
  };
}

function tryReceivedPatterns(text) {
  const patterns = [
    {
      // Standard: received Ksh AMT from NAME PHONE
      rx: /(?:You have received|received)\s+Ksh\s*([\d,]+\.?\d{0,2})\s+from\s+([A-Z\s\.\-']+?)(?:\s+([\dX\*]{6,14}))?(?:\s+(?:for account|for your)\s+([A-Z0-9\s]+?))?(?:\s+(?:on|at|New|Your|Fuliza|KCB|M-Shwari)|\.|$)/i,
      map: { amount: 1, name: 2, phone: 3, account: 4 }
    },
    {
      // Loan disbursement: received a loan of Ksh AMT from NAME
      rx: /received\s+a\s+loan\s+of\s+Ksh\s*([\d,]+\.?\d{0,2})\s+from\s+([A-Za-z\-\s]+?)(?:\.|,|\s+(?:on|at|Interest)|$)/i,
      map: { amount: 1, name: 2 }
    },
    {
      // Bank to M-Pesa: Ksh AMT has been transferred from your BANK account
      rx: /Ksh\s*([\d,]+\.?\d{0,2})\s+(?:has\s+been\s+)?transferred\s+from\s+(?:your\s+)?([A-Za-z0-9\s\.\-']+?)\s+(?:account\s+)?to\s+(?:your\s+)?M-?PESA/i,
      map: { amount: 1, name: 2 }
    }
  ];
  for (const p of patterns) {
    const match = text.match(p.rx);
    if (!match) continue;
    const codeMatch = text.match(/\b([A-Z0-9]{8,12})\b/);
    const code = codeMatch ? codeMatch[1] : `FB_R_${Date.now()}`;
    let accountRef = null;
    if (p.map.account && match[p.map.account]) {
       accountRef = match[p.map.account].trim().replace(/\s+(on|at).*/i, '');
       if (text.includes('Pochi')) accountRef = `Pochi: ${accountRef}`;
    }
    return {
      transactionCode: code,
      amount: parseAmount(match[p.map.amount]),
      senderName: cleanName(match[p.map.name]),
      senderPhone: p.map.phone ? (match[p.map.phone] || null) : null,
      accountRef
    };
  }
  return null;
}

function trySentPatterns(text) {
  const patterns = [
    {
      // Standard Sent
      rx: /Ksh\s*([\d,]+\.?\d{0,2})\s+sent\s+to\s+([A-Z\s\.\-']+?)\s+([\dX\*]{6,14})?(?:\s+(?:on|at|has|\.|$))/i,
      map: { amount: 1, name: 2, phone: 3 }, isUtility: false
    },
    {
      // Paid to Business
      rx: /Ksh\s*([\d,]+\.?\d{0,2})\s+paid\s+to\s+([A-Z\s\.\-']+?)(?:\s+(?:for account|for your)\s+([A-Z0-9\s]+?))?(?:\s+(?:on|at|has|\.|$))/i,
      map: { amount: 1, name: 2, account: 3 }, isUtility: false
    },
    {
      // Agent Withdrawal
      rx: /withdrawn\s+Ksh\s*([\d,]+\.?\d{0,2})\s+from\s+(?:agent\s+)?([A-Za-z0-9\s\.\-']+?)(?:\s+(?:on|at|has|New)\b|\.|$)/i,
      map: { amount: 1, name: 2 }, isUtility: false
    },
    {
      // Loan repayment
      rx: /Ksh\s*([\d,]+\.?\d{0,2})\s+(?:has\s+been\s+)?used\s+to\s+(?:repay|pay)\s+(?:your\s+)?([A-Za-z\-\s]+?)\s+loan/i,
      map: { amount: 1, name: 2 }, isUtility: false
    },
    {
      // Transferred to Bank
      rx: /Ksh\s*([\d,]+\.?\d{0,2})\s+transferred\s+to\s+([A-Z\s\.\-']+?)(?:\s+(?:on|at|has|\.|$))/i,
      map: { amount: 1, name: 2 }, isUtility: false
    },
    {
      // Airtime/Data
      rx: /(?:You\s+)?bought\s+Ksh\s*([\d,]+\.?\d{0,2})\s+of\s+([A-Za-z\/\s]+?)\s+for\s+([A-Z0-9\s\.\-']+?)(?:\s+on|at|New|Your|\.|$)/i,
      map: { amount: 1, category: 2, recipient: 3 }, isUtility: true
    }
  ];
  for (const p of patterns) {
    const match = text.match(p.rx);
    if (match) {
      const codeMatch = text.match(/\b([A-Z0-9]{8,12})\b/);
      let senderName = p.map.category ? `${match[p.map.category].toUpperCase().trim()}: ${match[p.map.recipient].trim()}` : cleanName(match[p.map.name]);
      return { transactionCode: codeMatch ? codeMatch[1] : `FB_S_${Date.now()}`, amount: parseAmount(match[p.map.amount]), senderName, senderPhone: p.map.phone ? match[p.map.phone] : null, isUtility: p.isUtility };
    }
  }
  return null;
}

module.exports = { parseMpesasms, isSafaricomSender, parseAmount, cleanName };
