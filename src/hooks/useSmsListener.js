// useSmsListener.js — Updated to use custom Native Foreground Service
import { useEffect } from 'react';
import { NativeModules, NativeEventEmitter, DeviceEventEmitter, Platform } from 'react-native';

const { SmsForegroundModule } = NativeModules;

export function useSmsListener(onSms) {
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    // Start the foreground service automatically
    SmsForegroundModule.startService().catch(e => console.error("Service start failed", e));

    // Listen for live SMS events from the background service
    // (Broadcasts sent while the app is alive)
    const subscription = DeviceEventEmitter.addListener('com.pesalist.app.SMS_RECEIVED', (data) => {
      onSms(data);
    });

    return () => {
      subscription.remove();
    };
  }, [onSms]);
}

export async function getMissedSms() {
  if (Platform.OS !== 'android') return [];
  try {
    return await SmsForegroundModule.getPendingMessages();
  } catch (e) {
    console.error("Failed to fetch missed messages", e);
    return [];
  }
}
