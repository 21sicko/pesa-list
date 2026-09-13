// useSmsListener.js — React Native hook
// Live messages: react-native-android-sms-listener (works while app is foregrounded)
// Background messages: native SmsBridge queue (works even if app was killed)
//
// Both paths feed the SAME onSms callback, so smsMatcher.js / tripManager.js
// only ever need to handle one shape of input — the parsing logic is untouched.

import { useEffect, useRef, useCallback } from 'react';
import { AppState, NativeModules } from 'react-native';
import SmsListener from 'react-native-android-sms-listener';

const { SmsBridge } = NativeModules;

export function useSmsListener(onSms) {
  const callbackRef = useRef(onSms);
  callbackRef.current = onSms;

  const drainBackgroundQueue = useCallback(async () => {
    if (!SmsBridge) return;
    try {
      const json = await SmsBridge.drainStoredMessages();
      const queued = JSON.parse(json);
      if (queued && queued.length > 0) {
        console.log(`Draining ${queued.length} background messages`);
        for (const item of queued) {
          callbackRef.current({
            originatingAddress: item.originatingAddress,
            body: item.body,
            timestamp: parseInt(item.timestamp),
          });
        }
      }
      return queued.length;
    } catch (e) {
      console.warn('Failed to drain background SMS queue', e);
      return 0;
    }
  }, []);

  useEffect(() => {
    const subscription = SmsListener.addListener(message => {
      callbackRef.current(message);
    });

    // Initial drain
    drainBackgroundQueue();

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') drainBackgroundQueue();
    });

    return () => {
      subscription.remove();
      appStateSub.remove();
    };
  }, [drainBackgroundQueue]);

  return { syncManual: drainBackgroundQueue };
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
