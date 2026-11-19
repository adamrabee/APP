/** Prayer times computed on device (BRD §6, W-01). Umm al-Qura by default. */
import { CalculationMethod, Coordinates, PrayerTimes } from 'adhan';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { parseYmd } from './dates';

export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type Prayer = (typeof PRAYERS)[number];
export const prayerName: Record<Prayer, string> = { fajr: 'الفجر', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' };

export type Coords = { latitude: number; longitude: number; city?: string };
const KEY = 'me.coords';
// Riyadh as a sensible default until location is granted.
export const DEFAULT_COORDS: Coords = { latitude: 24.7136, longitude: 46.6753, city: 'الرياض' };

const methods: Record<string, () => ReturnType<typeof CalculationMethod.UmmAlQura>> = {
  umm_al_qura: CalculationMethod.UmmAlQura,
  egyptian: CalculationMethod.Egyptian,
  mwl: CalculationMethod.MuslimWorldLeague,
  karachi: CalculationMethod.Karachi,
  dubai: CalculationMethod.Dubai,
};

export function prayerTimes(coords: Coords, date: string, method = 'umm_al_qura'): Record<Prayer, Date> {
  const params = (methods[method] ?? CalculationMethod.UmmAlQura)();
  const pt = new PrayerTimes(new Coordinates(coords.latitude, coords.longitude), parseYmd(date), params);
  return { fajr: pt.fajr, dhuhr: pt.dhuhr, asr: pt.asr, maghrib: pt.maghrib, isha: pt.isha };
}

export function nextPrayer(coords: Coords, now = new Date(), method?: string): { prayer: Prayer; at: Date } {
  const d = new Date(now);
  for (let i = 0; i < 2; i++) {
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const t = prayerTimes(coords, ymd, method);
    for (const p of PRAYERS) if (t[p] > now) return { prayer: p, at: t[p] };
    d.setDate(d.getDate() + 1);
  }
  return { prayer: 'fajr', at: now };
}

export async function getCoords(): Promise<Coords> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_COORDS;
}

/** Ask for location and store it. Returns the coordinates used. */
export async function refreshLocation(): Promise<Coords> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return getCoords();
    const pos = await Location.getLastKnownPositionAsync() ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    if (!pos) return getCoords();
    let city: string | undefined;
    try {
      const [place] = await Location.reverseGeocodeAsync(pos.coords);
      city = place?.city ?? place?.region ?? undefined;
    } catch {}
    const c: Coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, city };
    await AsyncStorage.setItem(KEY, JSON.stringify(c));
    return c;
  } catch {
    return getCoords();
  }
}

export function useCoords() {
  const [coords, setCoords] = useState<Coords>(DEFAULT_COORDS);
  useEffect(() => {
    getCoords().then(setCoords);
    refreshLocation().then(setCoords);
  }, []);
  return coords;
}
