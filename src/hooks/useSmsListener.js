// useSmsListener.js — React Native hook
// Live messages: react-native-android-sms-listener (works while app is foregrounded)
// Background messages: native SmsBridge queue (works even if app was killed)
//
// Both paths feed the SAME onSms callback, so smsMatcher.js / tripManager.js
// only ever need to handle one shape of input — the parsing logic is untouched.

import { useEffect, useRef } from 'react';
import { AppState, NativeModules } from 'react-native';
import SmsListener from 'react-native-android-sms-listener';

const { SmsBridge } = NativeModules;

export function useSmsListener(onSms) {
  const callbackRef = useRef(onSms);
  callbackRef.current = onSms;

  const drainBackgroundQueue = async () => {
    if (!SmsBridge) return; // native module not linked yet — safe no-op
    try {
      const json = await SmsBridge.drainStoredMessages();
      const queued = JSON.parse(json);
      for (const item of queued) {
        // Normalize to the same shape react-native-android-sms-listener gives us
        callbackRef.current({
          originatingAddress: item.originatingAddress,
          body: item.body,
          timestamp: item.timestamp,
        });
      }
    } catch (e) {
      console.warn('Failed to drain background SMS queue', e);
    }
  };

  useEffect(() => {
    // 1. Live listener — same as before, for messages that arrive while app is open
    const subscription = SmsListener.addListener(message => {
      callbackRef.current(message);
    });

    // 2. Drain anything the native receiver captured while we were away
    drainBackgroundQueue();

    // 3. Re-drain every time the app comes back to the foreground
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        drainBackgroundQueue();
      }
    });

    return () => {
      subscription.remove();
      appStateSub.remove();
    };
  }, []);
}

// Call this once, e.g. from a settings/onboarding screen, after explaining
// to the user why it matters. Android requires explicit user consent for this.
export async function requestBackgroundReliability() {
  if (!SmsBridge) return false;
  const alreadyIgnoring = await SmsBridge.isIgnoringBatteryOptimizations();
  if (!alreadyIgnoring) {
    SmsBridge.requestIgnoreBatteryOptimizations();
  }
  return alreadyIgnoring;
}
