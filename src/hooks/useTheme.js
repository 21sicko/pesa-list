// useTheme.js — Modern fintech palette: neutral chrome, green reserved for
// brand/verified moments only (not tinted into every border and label —
// that was why verified vs pending was hard to tell apart before).
import { useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = '@pesalist_theme';

export const themes = {
  light: {
    bg: '#F6F8F7',          // neutral cool gray canvas — not mint-tinted
    surface: '#FFFFFF',
    surfaceHover: '#EEF1F0',
    border: '#E3E7E5',      // true neutral gray, not green
    textPrimary: '#121815',  // near-black, not forest green
    textSecondary: '#5B6560',
    textMuted: '#8B948F',
    primary: '#0E9F6E',      // "Pesa Green" — deep, confident, brand-only
    primaryLight: '#E3F5EC',
    success: '#0E9F6E',      // verified — same brand green, used sparingly
    successBg: '#E3F5EC',
    successText: '#0B7A54',
    warning: '#D97706',      // pending — genuinely orange, not cream/amber-lite
    warningBg: '#FDECD1',
    warningText: '#92400E',
    danger: '#DC2626',
    dangerBg: '#FCE4E4',
    dangerText: '#991B1B',
    headerBg: '#FFFFFF',
    barBg: '#FFFFFF',
    shadow: 'rgba(18,24,21,0.08)',
  },
  dark: {
    bg: '#0B0F0D',           // near-black, cool undertone
    surface: '#151B18',
    surfaceHover: '#1E2622',
    border: '#293330',       // neutral dark gray, not green
    textPrimary: '#F2F5F3',
    textSecondary: '#9CA6A1',
    textMuted: '#6B756F',
    primary: '#22C55E',      // brand green, vivid enough to pop off near-black
    primaryLight: '#123322',
    success: '#22C55E',
    successBg: '#122A1D',
    successText: '#6EE7A8',
    warning: '#F59E0B',
    warningBg: '#3A2A10',
    warningText: '#FBBF66',
    danger: '#F87171',
    dangerBg: '#3B1414',
    dangerText: '#FCA5A5',
    headerBg: '#151B18',
    barBg: '#151B18',
    shadow: 'rgba(0,0,0,0.5)',
  }
};

export function useTheme() {
  const systemScheme = useColorScheme();
  const [themeName, setThemeName] = useState(systemScheme || 'light');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(name => {
      if (name === 'dark' || name === 'light') {
        setThemeName(name);
      } else if (systemScheme) {
        setThemeName(systemScheme);
      }
    });
  }, [systemScheme]);

  const toggleTheme = async () => {
    const next = themeName === 'light' ? 'dark' : 'light';
    setThemeName(next);
    await AsyncStorage.setItem(THEME_KEY, next);
  };

  return { theme: themes[themeName], themeName, toggleTheme };
}
