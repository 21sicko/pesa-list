// smsMatcher.js — Pure JS, zero React Native dependencies
// Test with: node tests/test-matcher.js

const SAFARICOM_SENDER_IDS = ['MPESA', 'M-PESA', 'M_PESA'];

function isSafaricomSender(senderId) {
  if (!senderId) return false;
  const normalized = senderId.toString().toUpperCase().replace(/[-_\s]/g, '');
  return SAFARICOM_SENDER_IDS.includes(normalized);
}

function parseAmount(amountStr) {
  if (!amountStr) return null;
  const cleaned = amountStr.replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function cleanName(nameStr) {
  if (!nameStr) return 'UNKNOWN';
  return nameStr.trim().replace(/\s+/g, ' ').toUpperCase();
}

function parseMpesasms(smsText, senderId) {
  if (!smsText || !isSafaricomSender(senderId)) {
    return { isValid: false, reason: 'Not from Safaricom M-Pesa sender' };
  }

  const text = smsText.trim();

  if (/reversed|reversal|cancelled|has been cancelled/i.test(text)) {
    return { isValid: false, reason: 'Reversed or cancelled transaction — not counted as a payment.' };
  }

  const strict = tryStrictPatterns(text);
  if (strict) {
    return { isValid: true, ...strict, rawText: text.substring(0, 120) };
  }

  const fallback = tryFallbackExtraction(text);
  if (fallback) {
    return { isValid: true, ...fallback, rawText: text.substring(0, 120), fallback: true };
  }

  return { 
    isValid: false, 
    reason: 'MPESA sender recognized, but message format is new/unusual.',
    rawText: text.substring(0, 120)
  };
}

function tryStrictPatterns(text) {
  const patterns = [
    {
      regex: /([A-Z0-9]{8,10})\s+[Cc]onfirmed[.,]\s+(?:You have received|received)\s+Ksh\s*([\d,]+\.?\d{0,2})\s+from\s+([A-Za-z\s\.\-']+?)\s+(\d{10,12}|\d{3,4}[X\*]{3,7}|\d{3,4}\d{3}\*{3})\s+[Oo]n\s+[\d\/]+/,
      groups: { code: 1, amount: 2, name: 3, phone: 4 }
    },
    {
      regex: /[Cc]onfirmed[.,]\s+(?:You have received|received)\s+Ksh\s*([\d,]+\.?\d{0,2})\s+from\s+([A-Za-z\s\.\-']+?)\s+(\d{10,12}|\d{3,4}[X\*]{3,7})\s+[Oo]n\s+[\d\/]+/,
      groups: { code: null, amount: 1, name: 2, phone: 3 }
    },
    {
      regex: /Ksh\s*([\d,]+\.?\d{0,2})\s+received\s+from\s+([A-Za-z\s\.\-']+?)\s+(\d{10,12}|\d{3,4}[X\*]{3,7})/i,
      groups: { code: null, amount: 1, name: 2, phone: 3 }
    }
  ];

  for (const p of patterns) {
    const match = text.match(p.regex);
    if (match) {
      let transactionCode = p.groups.code ? match[p.groups.code] : null;
      if (!transactionCode) {
        const codeMatch = text.match(/\b([A-Z0-9]{8,10})\b/);
        transactionCode = codeMatch ? codeMatch[1] : `FB_${Date.now()}`;
      }
      return {
        transactionCode: transactionCode,
        amount: parseAmount(match[p.groups.amount]),
        senderName: cleanName(match[p.groups.name]),
        senderPhone: match[p.groups.phone],
        parsedAt: new Date().toISOString(),
      };
    }
  }
  return null;
}

function tryFallbackExtraction(text) {
  const amountMatch = text.match(/Ksh\s*([\d,]+\.?\d{0,2})/i);
  const fromMatch = text.match(/from\s+([A-Za-z\s\.\-']{3,40}?)(?:\s+\d|\s+on|\s+at|\s+New|\.|$)/i);
  const codeMatch = text.match(/\b([A-Z0-9]{8,10})\b/);
  const phoneMatch = text.match(/(\d{10,12}|\d{3,4}[X\*]{3,7})/);

  if (amountMatch && fromMatch) {
    return {
      transactionCode: codeMatch ? codeMatch[1] : `FB_${Date.now()}`,
      amount: parseAmount(amountMatch[1]),
      senderName: cleanName(fromMatch[1]),
      senderPhone: phoneMatch ? phoneMatch[1] : null,
      parsedAt: new Date().toISOString(),
    };
  }
  return null;
}

module.exports = { parseMpesasms, isSafaricomSender, parseAmount, cleanName };
