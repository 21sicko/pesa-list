// useSmsListener.js — React Native hook
// Requires react-native-android-sms-listener (native module)

import { useEffect, useRef } from 'react';
import SmsListener from 'react-native-android-sms-listener';

export function useSmsListener(onSms) {
  const callbackRef = useRef(onSms);
  callbackRef.current = onSms;

  useEffect(() => {
    const subscription = SmsListener.addListener(message => {
      callbackRef.current(message);
    });
    return () => subscription.remove();
  }, []);
}
