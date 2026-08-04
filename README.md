# Pesa List

Protect Kenyan matatu conductors (and shopkeepers) from fake M-Pesa screenshots.

## How it works

- The app listens for **genuine M-Pesa SMS** on the **seller's phone only**
- Payments appear as big tappable cards — conductor taps to verify
- No screenshot from the customer is ever viewed or trusted
- Works **offline** — no internet, no backend, no monthly fees

## Quick start

### 1. Test the logic (no Android needed)
```bash
npm install
npm test
```

### 2. Run on Android (requires real device)
```bash
npx expo prebuild
npx expo run:android
```

Or build a development APK:
```bash
npx expo prebuild
npx expo run:android --variant release
```

### 3. Permissions
The app needs **SMS permission** to read M-Pesa messages. Android will ask on first launch.

If denied accidentally:
- Settings → Apps → Pesa List → Permissions → SMS → Allow
- Also disable battery optimization so the app keeps listening

## Project structure

```
pesa-list/
├── src/
│   ├── logic/          # Pure JS — testable in Node, zero RN deps
│   │   ├── smsMatcher.js
│   │   ├── tripManager.js
│   │   └── index.js
│   ├── components/     # React Native UI
│   │   ├── PaymentCard.js
│   │   ├── ExpectingModal.js
│   │   └── TotalsBar.js
│   └── hooks/
│       └── useSmsListener.js
├── tests/              # Node-runnable tests
│   ├── test-matcher.js
│   └── test-trip.js
├── App.js
├── app.json
└── package.json
```

## Key features

- **Auto-start**: New trip begins automatically when first SMS arrives
- **Auto-end**: Trip closes after 30 minutes of inactivity
- **Card UI**: Last 5 unmatched payments shown as big tappable cards
- **Quick expecting**: Preset amount buttons (Ksh 30/50/100) for passengers who paid but SMS is delayed
- **Auto-match**: If you mark "Expecting John" and a payment from "JOHN DOE" arrives, it links automatically
- **Search fallback**: Type a name if the payment is not in the recent cards
- **Persistent storage**: Trips survive app crashes via AsyncStorage

## Important notes

- **Expo Go will NOT work** for SMS listening because it requires native Android code. You must use a **development build** (`expo run:android`) or a **preview build**.
- The exact M-Pesa SMS format varies. Test with real Safaricom messages and update `smsMatcher.js` regex if needed.
- Phone number masking (2026): The regex handles both full numbers (`254700123456`) and masked numbers (`076734XXXX`, `0722000***`).

## License

MIT — free to use, modify, and distribute.
