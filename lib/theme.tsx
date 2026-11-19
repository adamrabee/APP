import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

// Values taken from the design file (تصميم تطبيق me.html).
const light = {
  bg: '#F6F5F1',
  card: '#FFFFFF',
  text: '#1F2421',
  sub: '#6B6F6A',
  sub2: '#4F5450',
  faint: '#A3A8A4',
  line: '#EFEDE8',
  border: '#E7E5DF',
  track: '#D9DDD7',
  seg: '#EAE8E2',
  input: '#FBFAF8',
  primary: '#4F6F5C',
  primaryDark: '#3B5646',
  primarySoft: '#E4ECE6',
  doneBg: '#EEF4EF',
  doneBorder: '#D4E3D8',
  ink: '#1F2421', // dark buttons / active chips
  onInk: '#FFFFFF',
  danger: '#A03B2A',
  warn: '#B08A3E',
  // section accents: fg (text/badges), bg (soft tint), bar (strong fill)
  acc: {
    study: { fg: '#2F5A86', dark: '#1F3F63', bg: '#E7EEF7', bar: '#2F5A86' },
    work: { fg: '#54478A', dark: '#3E3470', bg: '#ECE9F6', bar: '#54478A' },
    health: { fg: '#8E4228', dark: '#5E2A18', bg: '#F6E9E4', bar: '#B5573A' },
    me: { fg: '#7D3C5C', dark: '#5C2A43', bg: '#F3E8EE', bar: '#7D3C5C' },
    worship: { fg: '#6E521A', dark: '#6E521A', bg: '#F4EEDD', bar: '#B08A3E' },
    green: { fg: '#3B5646', dark: '#3B5646', bg: '#E4ECE6', bar: '#4F6F5C' },
    neutral: { fg: '#4F5450', dark: '#4F5450', bg: '#EFEDE8', bar: '#6B6F6A' },
  },
};

const dark: typeof light = {
  bg: '#0E100F',
  card: '#1B1E1C',
  text: '#F2F2EF',
  sub: '#9BA19C',
  sub2: '#B9BEB9',
  faint: '#6A706B',
  line: '#2A2E2B',
  border: '#2F3431',
  track: '#3A3F3B',
  seg: '#232724',
  input: '#151816',
  primary: '#7FA98E',
  primaryDark: '#A9C0B1',
  primarySoft: '#243029',
  doneBg: '#1E2A22',
  doneBorder: '#2E4034',
  ink: '#F2F2EF',
  onInk: '#0E100F',
  danger: '#E08A76',
  warn: '#D9B46A',
  acc: {
    study: { fg: '#8FB4DC', dark: '#B5CDE8', bg: '#1C2633', bar: '#5E8CC0' },
    work: { fg: '#A99BE0', dark: '#C4BAEC', bg: '#24213A', bar: '#8576C4' },
    health: { fg: '#E0A48C', dark: '#EBC0AE', bg: '#2E201B', bar: '#C9704F' },
    me: { fg: '#D69AB7', dark: '#E6BCD0', bg: '#2E1F27', bar: '#B5658C' },
    worship: { fg: '#D9B46A', dark: '#E6CB93', bg: '#2C2619', bar: '#C9A050' },
    green: { fg: '#A9C0B1', dark: '#C5D6CB', bg: '#243029', bar: '#7FA98E' },
    neutral: { fg: '#B9BEB9', dark: '#B9BEB9', bg: '#2A2E2B', bar: '#9BA19C' },
  },
};

export type Palette = typeof light;
export type Accent = keyof Palette['acc'];
export type Mode = 'light' | 'dark';

export const font = {
  light: 'IBMPlexSansArabic_300Light',
  regular: 'IBMPlexSansArabic_400Regular',
  medium: 'IBMPlexSansArabic_500Medium',
  semibold: 'IBMPlexSansArabic_600SemiBold',
  bold: 'IBMPlexSansArabic_700Bold',
};

export const radius = { sm: 11, md: 14, lg: 20, xl: 24, pill: 999 };

/** Task / tag category → accent (design tags: مذاكرة blue, شغل purple, صحة terracotta, me plum). */
export const categoryAccent: Record<string, Accent> = { study: 'study', work: 'work', health: 'health', personal: 'green', me: 'me' };

type Ctx = { mode: Mode; c: Palette; setMode: (m: Mode) => void };
const ThemeCtx = createContext<Ctx>({ mode: 'light', c: light, setMode: () => {} });
const KEY = 'me.theme';

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>('light');
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => v === 'dark' && setModeState('dark')).catch(() => {});
  }, []);
  const value = useMemo<Ctx>(
    () => ({
      mode,
      c: mode === 'dark' ? dark : light,
      setMode: (m) => {
        setModeState(m);
        AsyncStorage.setItem(KEY, m).catch(() => {});
      },
    }),
    [mode],
  );
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
export const palettes = { light, dark };
