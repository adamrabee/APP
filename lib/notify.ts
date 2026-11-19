/**
 * Local scheduled notifications (BRD §4.8). Everything is recomputed from the data
 * for the next 3 days whenever relevant rows change.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { addDays, minutesOf, parseYmd, today } from './dates';
import { rows, type Row } from './db';
import { habitDueOn } from './logic';
import { getCoords, prayerName, prayerTimes, PRAYERS } from './prayer';
import { journalPrompts } from './content';

export type NotifType =
  | 'prayer' | 'wird' | 'adhkar_am' | 'adhkar_pm'
  | 'habits' | 'tasks'
  | 'study' | 'reviews' | 'exam' | 'focus' | 'behind'
  | 'skin_am' | 'skin_pm' | 'products'
  | 'streak' | 'journal' | 'weekly';

export const NOTIF_META: { type: NotifType; label: string; group: string; time?: string; hint?: string }[] = [
  { type: 'prayer', label: 'قبل كل صلاة', group: 'العبادات', hint: 'قبلها بـ 10 دقايق، بدون صوت أذان' },
  { type: 'wird', label: 'تذكير الورد', group: 'العبادات', time: '21:00' },
  { type: 'adhkar_am', label: 'أذكار الصباح', group: 'العبادات', time: '06:30' },
  { type: 'adhkar_pm', label: 'أذكار المساء', group: 'العبادات', time: '17:00' },
  { type: 'habits', label: 'تذكيرات العادات', group: 'المهام', hint: 'حسب وقت كل عادة' },
  { type: 'tasks', label: 'تذكيرات المهام', group: 'المهام', hint: 'حسب وقت كل مهمة' },
  { type: 'streak', label: 'حماية الـStreak', group: 'المهام', time: '21:30' },
  { type: 'study', label: 'قبل موعد المذاكرة', group: 'المذاكرة', hint: 'قبل أوقاتك المتاحة بـ 10 دقايق' },
  { type: 'reviews', label: 'مراجعات اليوم', group: 'المذاكرة', time: '09:00' },
  { type: 'exam', label: 'عدّ تنازلي للاختبارات', group: 'المذاكرة', time: '09:00', hint: 'قبلها بشهر وأسبوع ويوم' },
  { type: 'focus', label: 'نهاية جلسة التركيز والراحة', group: 'المذاكرة' },
  { type: 'behind', label: 'مادة متأخرة عن هدفها', group: 'المذاكرة', time: '19:00' },
  { type: 'skin_am', label: 'روتين الصباح', group: 'me', time: '08:00' },
  { type: 'skin_pm', label: 'روتين المساء', group: 'me', time: '22:00' },
  { type: 'products', label: 'منتج قرب يخلص أو تنتهي صلاحيته', group: 'me', time: '10:00' },
  { type: 'journal', label: 'كتابة اليوميات', group: 'me', time: '22:30' },
  { type: 'weekly', label: 'مراجعة الأسبوع (الجمعة)', group: 'عام', time: '09:00' },
];

export function settingFor(type: string): { enabled: boolean; time?: string } {
  const r = rows('notification_settings').find((x) => x.type === type);
  const meta = NOTIF_META.find((m) => m.type === type);
  return { enabled: r ? r.enabled : true, time: (r?.time ?? meta?.time ?? '09:00').slice(0, 5) };
}

export function globalSettings() {
  const r = rows('notification_settings').find((x) => x.type === 'global');
  return {
    quiet_from: (r?.quiet_from ?? '23:30').slice(0, 5),
    quiet_to: (r?.quiet_to ?? '06:00').slice(0, 5),
    daily_cap: r?.daily_cap ?? 12,
  };
}

let ready = false;
async function ensurePermission() {
  if (Platform.OS === 'web') return false;
  if (!ready) {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'me',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: null,
      });
    }
    ready = true;
  }
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

type Plan = { at: Date; title: string; body: string; type: NotifType | 'prayer_exact' };

function at(date: string, time: string) {
  const d = parseYmd(date);
  const m = minutesOf(time);
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
}

export async function rescheduleAll() {
  if (!(await ensurePermission())) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  const now = new Date();
  const plan: Plan[] = [];
  const on = (t: NotifType) => settingFor(t).enabled;
  const timeOf = (t: NotifType) => settingFor(t).time!;
  const coords = await getCoords();
  const profile = rows('profiles')[0];
  const method = profile?.prayer_method ?? 'umm_al_qura';
  const prayerWindows: [number, number][] = [];

  for (let i = 0; i < 3; i++) {
    const day = addDays(today(), i);
    const dow = parseYmd(day).getDay();
    const pt = prayerTimes(coords, day, method);
    for (const p of PRAYERS) {
      prayerWindows.push([pt[p].getTime(), pt[p].getTime() + 25 * 60000]);
      if (on('prayer')) plan.push({ at: new Date(pt[p].getTime() - 10 * 60000), title: `${prayerName[p]} بعد 10 دقايق`, body: 'استعد للصلاة 🤍', type: 'prayer' });
    }
    if (on('wird')) plan.push({ at: at(day, timeOf('wird')), title: 'ورد القرآن', body: 'خلّص وردك اليوم؟', type: 'wird' });
    if (on('adhkar_am')) plan.push({ at: at(day, timeOf('adhkar_am')), title: 'أذكار الصباح', body: 'دقيقتين لأذكار الصباح', type: 'adhkar_am' });
    if (on('adhkar_pm')) plan.push({ at: at(day, timeOf('adhkar_pm')), title: 'أذكار المساء', body: 'دقيقتين لأذكار المساء', type: 'adhkar_pm' });

    if (on('habits')) {
      const logs = rows('habit_logs');
      for (const h of rows('habits')) {
        if (h.archived || !h.remind_at || !habitDueOn(h, day, logs)) continue;
        plan.push({ at: at(day, h.remind_at.slice(0, 5)), title: h.name, body: 'وقت العادة دي', type: 'habits' });
      }
    }
    if (on('tasks')) {
      for (const t of rows('tasks')) {
        if (t.done_at || t.due_date !== day || !t.remind_at) continue;
        plan.push({ at: at(day, t.remind_at.slice(0, 5)), title: t.title, body: 'تذكير بمهمة اليوم', type: 'tasks' });
      }
    }
    if (on('study')) {
      for (const s of rows('study_slots')) {
        if (s.weekday !== dow) continue;
        plan.push({ at: new Date(at(day, s.start_time.slice(0, 5)).getTime() - 10 * 60000), title: 'المذاكرة بعد 10 دقايق', body: 'جهّز مكانك وابدأ جلسة تركيز', type: 'study' });
      }
    }
    if (on('reviews')) {
      const due = rows('reviews').filter((r) => !r.done_at && r.due_date <= day).length + rows('flashcards').filter((f) => f.due_date <= day).length;
      if (due) plan.push({ at: at(day, timeOf('reviews')), title: 'مراجعات اليوم', body: `عندك ${due} مراجعة/بطاقة النهارده`, type: 'reviews' });
    }
    if (on('exam')) {
      for (const s of rows('subjects')) {
        if (!s.exam_date) continue;
        for (const [before, label] of [[30, 'بعد شهر'], [7, 'بعد أسبوع'], [1, 'بكرة']] as const) {
          if (addDays(s.exam_date, -before) === day) plan.push({ at: at(day, timeOf('exam')), title: `اختبار ${s.name} ${label}`, body: 'شوف خطتك وراجع بنك الأخطاء', type: 'exam' });
        }
      }
    }
    if (on('behind') && dow === 3) {
      // Wednesday check: subjects below half their weekly goal
      const ws = addDays(day, -((dow + 1) % 7));
      for (const s of rows('subjects')) {
        if (!s.weekly_hours) continue;
        const mins = rows('study_sessions').filter((x) => x.subject_id === s.id && String(x.started_at).slice(0, 10) >= ws).reduce((a, x) => a + x.minutes, 0);
        if (mins < s.weekly_hours * 30) plan.push({ at: at(day, timeOf('behind')), title: `${s.name} متأخرة`, body: `ذاكرت ${Math.round(mins / 60)} من ${s.weekly_hours} ساعة الأسبوع ده`, type: 'behind' });
      }
    }
    if (on('skin_am')) plan.push({ at: at(day, timeOf('skin_am')), title: 'روتين الصباح', body: 'سكن كير الصباح ☀️', type: 'skin_am' });
    if (on('skin_pm')) plan.push({ at: at(day, timeOf('skin_pm')), title: 'روتين المساء', body: 'سكن كير المساء 🌙', type: 'skin_pm' });
    if (on('products') && i === 0) {
      for (const p of rows('products')) {
        const expiry = p.opened_at && p.pao_months ? addMonths(p.opened_at, p.pao_months) : null;
        const soon = expiry && expiry <= addDays(day, 14);
        if (p.running_low || soon) plan.push({ at: at(day, timeOf('products')), title: p.name, body: p.running_low ? 'قرب يخلص' : 'صلاحيته قربت تخلص', type: 'products' });
      }
    }
    if (on('streak')) plan.push({ at: at(day, timeOf('streak')), title: 'حافظ على الـStreak', body: 'لو فيه عادة أو مذاكرة لسه ما اتعملتش، لسه فيه وقت', type: 'streak' });
    if (on('journal')) plan.push({ at: at(day, timeOf('journal')), title: 'يومياتك', body: journalPrompts[(parseYmd(day).getDate() + i) % journalPrompts.length], type: 'journal' });
    if (on('weekly') && dow === 5) plan.push({ at: at(day, timeOf('weekly')), title: 'مراجعة الأسبوع جاهزة', body: 'MEE جهّز لك ملخص أسبوعك', type: 'weekly' });
  }

  // Quiet hours, mute during prayer, daily cap.
  const g = globalSettings();
  const qf = minutesOf(g.quiet_from);
  const qt = minutesOf(g.quiet_to);
  const quiet = (d: Date) => {
    const m = d.getHours() * 60 + d.getMinutes();
    return qf <= qt ? m >= qf && m < qt : m >= qf || m < qt;
  };
  const inPrayer = (d: Date) => prayerWindows.some(([a, b]) => d.getTime() >= a && d.getTime() < b);
  const perDay = new Map<string, number>();
  const final = plan
    .filter((p) => p.at > now)
    .filter((p) => p.type === 'prayer' || (!quiet(p.at) && !inPrayer(p.at)))
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .filter((p) => {
      if (p.type === 'prayer') return true;
      const k = p.at.toDateString();
      const n = perDay.get(k) ?? 0;
      if (n >= g.daily_cap) return false;
      perDay.set(k, n + 1);
      return true;
    })
    .slice(0, 60); // iOS keeps at most 64 pending

  for (const p of final) {
    await Notifications.scheduleNotificationAsync({
      content: { title: p.title, body: p.body, sound: false },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.at, channelId: 'default' },
    });
  }
}

/** One-off notification (focus timer end). Returns id so it can be cancelled. */
export async function notifyIn(seconds: number, title: string, body: string) {
  if (!settingFor('focus').enabled || !(await ensurePermission())) return null;
  return Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(1, Math.round(seconds)), channelId: 'default' },
  });
}

export async function cancelNotif(id: string | null) {
  if (id && Platform.OS !== 'web') await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

export function addMonths(date: string, months: number): string {
  const d = parseYmd(date);
  d.setMonth(d.getMonth() + Number(months));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export type { Row };
