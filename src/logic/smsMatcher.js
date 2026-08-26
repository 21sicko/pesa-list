// smsMatcher.js — Final Hardened Version with Debug Trace
const SAFARICOM_SENDER_IDS = ['MPESA', 'M-PESA', 'M_PESA'];

function isSafaricomSender(senderId) {
  if (!senderId) return false;
  const normalized = senderId.toString().toUpperCase().replace(/[-_\s]/g, '');
  return SAFARICOM_SENDER_IDS.includes(normalized) || senderId.toUpperCase().includes('MPESA');
}

function parseAmount(amountStr) {
  if (!amountStr) return 0;
  const cleaned = amountStr.replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function cleanName(nameStr) {
  if (!nameStr) return 'UNKNOWN';
  // Remove trailing phone numbers or Pochi labels from name
  return nameStr.replace(/\s+[\dX\*]{6,14}$/i, '').replace(/for your Pochi.*/i, '').trim().replace(/\s+/g, ' ').toUpperCase();
}

function parseMpesasms(smsText, senderId) {
  if (!smsText) return { isValid: false, reason: 'Empty SMS text' };

  if (!isSafaricomSender(senderId)) {
    return { isValid: false, reason: `Invalid sender: ${senderId}` };
  }

  const text = smsText.trim();
  if (!/Confirmed/i.test(text)) {
    return { isValid: false, reason: 'Message does not contain "Confirmed"' };
  }

  const strict = tryStrictPatterns(text);
  if (strict) return { isValid: true, ...strict, rawText: text.substring(0, 120) };

  const fallback = tryFallbackExtraction(text);
  if (fallback) return { isValid: true, ...fallback, rawText: text.substring(0, 120), fallback: true };

  return { isValid: false, reason: 'Regex mismatch — format not recognized' };
}

function tryStrictPatterns(text) {
  const patterns = [
    {
      // Handles Code at start: [CODE] Confirmed... received Ksh [AMT] from [NAME] [PHONE] ...
      regex: /^\s*([A-Z0-9]{6,12})\s+[Cc]onfirmed[.,]\s+(?:You have received|received)\s+Ksh\s*([\d,]+\.?\d{0,2})\s+from\s+([A-Za-z\s\.\-']+?)\s+([\dX\*]{6,14})?(?:\s+(for account|for your)\s+([A-Z0-9\s]+?))?\s+[Oo]n\s+[\d\/]+/,
      map: { code: 1, amount: 2, name: 3, phone: 4, label: 5, ref: 6 }
    },
    {
      // Handles No code at start: Confirmed... received Ksh [AMT] from [NAME] [PHONE] ... [CODE]
      regex: /[Cc]onfirmed[.,]\s+(?:You have received|received)\s+Ksh\s*([\d,]+\.?\d{0,2})\s+from\s+([A-Za-z\s\.\-']+?)\s+([\dX\*]{6,14})(?:\s+(for account|for your)\s+([A-Z0-9\s]+?))?.*?([A-Z0-9]{8,12})/,
      map: { amount: 1, name: 2, phone: 3, label: 4, ref: 5, code: 6 }
    }
  ];

  for (const p of patterns) {
    const match = text.match(p.regex);
    if (match) {
      const code = p.map.code ? match[p.map.code] : (text.match(/\b([A-Z0-9]{8,12})\b/)?.[1] || `FB_${Date.now()}`);
      let accountRef = null;
      if (p.map.ref && match[p.map.ref]) {
        const labelText = match[p.map.label] || '';
        const refValue = match[p.map.ref].trim();
        accountRef = labelText.includes('account') ? refValue : `Pochi: ${refValue}`;
      }
      return {
        transactionCode: code,
        amount: parseAmount(match[p.map.amount]),
        senderName: cleanName(match[p.map.name]),
        senderPhone: match[p.map.phone] || null,
        accountRef,
        parsedAt: new Date().toISOString(),
      };
    }
  }
  return null;
}

function tryFallbackExtraction(text) {
  const amountMatch = text.match(/Ksh\s*([\d,]+\.?\d{0,2})/i);
  const fromMatch = text.match(/from\s+([A-Za-z\s\.\-']{3,40}?)(?:\s+[\dX\*]|\s+on|\s+at|\s+New|\.|$)/i);
  const codeMatch = text.match(/\b([A-Z0-9]{8,12})\b/);
  const phoneMatch = text.match(/([\dX\*]{6,14})/);

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
