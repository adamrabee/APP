import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

// BRD §5 + X-06: calm, minimal, one olive accent. Light is the default.
const light = {
  bg: '#F5F6F1',
  card: '#FFFFFF',
  text: '#1B1E1C',
  sub: '#6B716C',
  faint: '#A3A8A4',
  line: '#E6E8E1',
  primary: '#5E7F6A',
  primarySoft: '#E4ECE6',
  ink: '#111111',      // black UI elements (logo, primary buttons, high priority)
  onInk: '#FFFFFF',
  danger: '#B4533F',
  warn: '#C08A2E',
  // faint per-section tints (for distinction only)
  sec: {
    today: '#EEF2EC',
    tasks: '#EDF0F4',
    worship: '#F1EEE6',
    study: '#EEEDF4',
    me: '#F4EDEE',
    gym: '#ECF2F1',
    money: '#F2F1E8',
    work: '#EDEFF0',
  },
};

const dark: typeof light = {
  bg: '#0E100F',
  card: '#1B1E1C',
  text: '#F2F2EF',
  sub: '#9BA19C',
  faint: '#6A706B',
  line: '#2A2E2B',
  primary: '#8DB39A',
  primarySoft: '#243029',
  ink: '#F2F2EF',
  onInk: '#0E100F',
  danger: '#E08A76',
  warn: '#E0B460',
  sec: {
    today: '#1E2420',
    tasks: '#1E2126',
    worship: '#25221B',
    study: '#211F28',
    me: '#271F21',
    gym: '#1C2524',
    money: '#24231B',
    work: '#1F2223',
  },
};

export type Palette = typeof light;
export type Mode = 'light' | 'dark';

export const font = {
  regular: 'IBMPlexSansArabic_400Regular',
  medium: 'IBMPlexSansArabic_500Medium',
  semibold: 'IBMPlexSansArabic_600SemiBold',
  bold: 'IBMPlexSansArabic_700Bold',
};

export const radius = { sm: 10, md: 16, lg: 22, pill: 999 };
export const space = (n: number) => n * 4;

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
