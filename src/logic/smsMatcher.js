// smsMatcher.js — Pro Version: Fuliza, Utilities, Betting, Loans & Transfers
const SAFARICOM_SENDER_IDS = ['MPESA', 'M-PESA', 'M_PESA'];

const BETTING_SITES = [
  'SPORTPESA', 'BETIKA', 'ODIBETS', 'MOZZARTBET', 'BETWAY', '22BET',
  'MELBET', 'BETPAWA', 'KIBET', 'SHABIKI', 'DAFABET', 'LUCKYBIRD'
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

function isBettingSite(name) {
  if (!name) return false;
  const n = name.toUpperCase();
  return BETTING_SITES.some(site => n.includes(site));
}

function parseMpesasms(smsText, senderId) {
  if (!smsText || !isSafaricomSender(senderId)) return { isValid: false };
  const text = smsText.trim();

  // High-level filter for financial confirmations
  if (!/Confirmed/i.test(text) && !/received/i.test(text) && !/sent/i.test(text) && !/paid/i.test(text) && !/bought/i.test(text) && !/transferred/i.test(text) && !/balance/i.test(text)) return { isValid: false };
  if (/reversed|reversal|cancelled/i.test(text)) return { isValid: false };

  // 1. Extract M-PESA Balance
  const balanceMatch = text.match(/(?:New|M-PESA)\s+balance\s+is\s+Ksh\s*([\d,]+\.?\d{0,2})/i);
  const postBalance = balanceMatch ? parseAmount(balanceMatch[1]) : null;

  // 2. Detect Fuliza Debt
  const fulizaMatch = text.match(/Fuliza M-PESA amount\s+(?:is|was)\s+Ksh\s*([\d,]+\.?\d{0,2})/i);
  const fulizaDebt = fulizaMatch ? parseAmount(fulizaMatch[1]) : 0;

  // 3. Detect KCB M-PESA Loan Balance
  const kcbMatch = text.match(/KCB M-PESA loan balance\s+is\s+Ksh\s*([\d,]+\.?\d{0,2})/i);
  const kcbDebt = kcbMatch ? parseAmount(kcbMatch[1]) : 0;

  // 4. Detect M-Shwari Loan Balance
  const mshwariMatch = text.match(/M-Shwari loan balance\s+is\s+Ksh\s*([\d,]+\.?\d{0,2})/i);
  const mshwariDebt = mshwariMatch ? parseAmount(mshwariMatch[1]) : 0;

  // 5. Try "Received" patterns
  const received = tryReceivedPatterns(text);
  if (received) {
    return {
      isValid: true,
      type: 'RECEIVED',
      postBalance,
      fulizaDebt,
      kcbDebt,
      mshwariDebt,
      isGambling: isBettingSite(received.senderName),
      ...received,
      rawText: text.substring(0, 120)
    };
  }

  // 6. Try "Sent / Paid / Transferred" patterns
  const sent = trySentPatterns(text);
  if (sent) {
    return {
      isValid: true,
      type: 'SENT',
      postBalance,
      fulizaDebt,
      kcbDebt,
      mshwariDebt,
      isGambling: isBettingSite(sent.senderName),
      ...sent,
      rawText: text.substring(0, 120)
    };
  }

  // 7. Info-only updates (e.g. balance check)
  if (kcbDebt > 0 || mshwariDebt > 0 || fulizaDebt > 0 || postBalance !== null) {
     return {
       isValid: true,
       type: 'INFO',
       postBalance,
       fulizaDebt,
       kcbDebt,
       mshwariDebt,
       senderName: 'SYSTEM UPDATE',
       amount: 0,
       transactionCode: `SYS_${Date.now()}`,
       rawText: text.substring(0, 120)
     };
  }

  return { isValid: false };
}

function tryReceivedPatterns(text) {
  const rx = /(?:You have received|received)\s+Ksh\s*([\d,]+\.?\d{0,2})\s+from\s+([A-Z\s\.\-']+?)(?:\s+([\dX\*]{6,14}))?(?:\s+(?:for account|for your)\s+([A-Z0-9\s]+?))?(?:\s+(?:on|at|New|Your|Fuliza|KCB|M-Shwari)|\.|$)/i;
  const match = text.match(rx);

  if (match) {
    const codeMatch = text.match(/\b([A-Z0-9]{8,12})\b/);
    const code = codeMatch ? codeMatch[1] : `FB_R_${Date.now()}`;

    let accountRef = null;
    if (match[4]) {
       accountRef = match[4].trim().replace(/\s+(on|at).*/i, '');
       if (text.includes('Pochi')) accountRef = `Pochi: ${accountRef}`;
    }

    return {
      transactionCode: code,
      amount: parseAmount(match[1]),
      senderName: cleanName(match[2]),
      senderPhone: match[3] || null,
      accountRef,
      parsedAt: new Date().toISOString(),
    };
  }
  return null;
}

function trySentPatterns(text) {
  const patterns = [
    {
      // Standard Sent: sent to ...
      rx: /Ksh\s*([\d,]+\.?\d{0,2})\s+sent\s+to\s+([A-Z\s\.\-']+?)\s+([\dX\*]{6,14})?(?:\s+(?:on|at|has|\.|$))/i,
      map: { amount: 1, name: 2, phone: 3 }
    },
    {
      // Paid to Business/Till: paid to ...
      rx: /Ksh\s*([\d,]+\.?\d{0,2})\s+paid\s+to\s+([A-Z\s\.\-']+?)(?:\s+(?:for account|for your)\s+([A-Z0-9\s]+?))?(?:\s+(?:on|at|has|\.|$))/i,
      map: { amount: 1, name: 2, account: 3 }
    },
    {
      // Transferred to M-Shwari/KCB: transferred to ...
      rx: /Ksh\s*([\d,]+\.?\d{0,2})\s+transferred\s+to\s+([A-Z\s\.\-']+?)(?:\s+(?:on|at|has|\.|$))/i,
      map: { amount: 1, name: 2 }
    },
    {
      // Bought Airtime/Data
      rx: /bought\s+Ksh\s*([\d,]+\.?\d{0,2})\s+of\s+([A-Za-z\/\s]+?)\s+for\s+([A-Z0-9\s\.\-']+?)(?:\s+|\.|$)/i,
      map: { amount: 1, category: 2, recipient: 3 }
    }
  ];
  for (const p of patterns) {
    const match = text.match(p.rx);
    if (match) {
      const codeMatch = text.match(/\b([A-Z0-9]{8,12})\b/);
      const code = codeMatch ? codeMatch[1] : `FB_S_${Date.now()}`;
      let senderName = p.map.category ? `${match[p.map.category].toUpperCase().trim()}: ${match[p.map.recipient].trim()}` : cleanName(match[p.map.name]);
      return {
        transactionCode: code,
        amount: parseAmount(match[p.map.amount]),
        senderName,
        senderPhone: p.map.phone ? match[p.map.phone] : null,
        parsedAt: new Date().toISOString(),
      };
    }
  }
  return null;
}

module.exports = { parseMpesasms, isSafaricomSender, parseAmount, cleanName };
