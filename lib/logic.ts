import { addDays, diffDays, parseYmd, today, weekStart } from './dates';
import type { Row } from './db';

// ───────── Streaks (T-05, W-02, S-12, M-01, M-10) ─────────
/** Current + longest streak from a set of "done" dates. Today not yet done doesn't break the streak. */
export function streak(doneDates: Iterable<string>, ref: string = today()) {
  const set = new Set(doneDates);
  let current = 0;
  let d = set.has(ref) ? ref : addDays(ref, -1);
  while (set.has(d)) {
    current++;
    d = addDays(d, -1);
  }
  const sorted = Array.from(set).sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const s of sorted) {
    run = prev && diffDays(s, prev) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = s;
  }
  return { current, longest: Math.max(longest, current) };
}

// ───────── Habits ─────────
/** Is a habit due on a given date? Supports daily, weekly, specific days and "every N days". */
export function habitDueOn(h: Row, date: string, logs: Row[]): boolean {
  const s = h.schedule as { days?: number[]; every_days?: number } | null;
  if (s?.days?.length) return s.days.includes(parseYmd(date).getDay());
  if (s?.every_days) {
    const last = logs
      .filter((l) => l.habit_id === h.id && l.date < date)
      .map((l) => l.date)
      .sort()
      .pop();
    return !last || diffDays(date, last) >= s.every_days;
  }
  return true;
}

export function habitDoneDates(h: Row, logs: Row[]): string[] {
  if (h.period === 'weekly') {
    // weekly target: a week counts when count in that week reaches target; mark every logged day of a completed week
    const byWeek = new Map<string, number>();
    for (const l of logs) if (l.habit_id === h.id) byWeek.set(weekStart(l.date), (byWeek.get(weekStart(l.date)) ?? 0) + l.count);
    return logs.filter((l) => l.habit_id === h.id && (byWeek.get(weekStart(l.date)) ?? 0) >= h.target_per_day).map((l) => l.date);
  }
  return logs.filter((l) => l.habit_id === h.id && l.count >= (h.target_per_day ?? 1)).map((l) => l.date);
}

export function habitStreak(h: Row, logs: Row[]) {
  const s = h.schedule as { days?: number[]; every_days?: number } | null;
  const done = habitDoneDates(h, logs);
  if (s?.days?.length || s?.every_days) {
    // count consecutive *due* occasions that were done
    const doneSet = new Set(done);
    let current = 0;
    let d = today();
    for (let i = 0; i < 400; i++) {
      if (habitDueOn(h, d, logs)) {
        if (doneSet.has(d)) current++;
        else if (d !== today()) break;
      }
      d = addDays(d, -1);
    }
    return { current, longest: Math.max(current, streak(done).longest) };
  }
  return streak(done);
}

// ───────── Tasks (T-02 repeating) ─────────
export type RepeatRule = { freq: 'daily' | 'weekly' | 'days'; days?: number[] } | null;

/** Next due date after `from` for a repeating task. */
export function nextDue(rule: RepeatRule, from: string): string | null {
  if (!rule) return null;
  if (rule.freq === 'daily') return addDays(from, 1);
  if (rule.freq === 'weekly') return addDays(from, 7);
  if (rule.freq === 'days' && rule.days?.length) {
    for (let i = 1; i <= 7; i++) {
      const d = addDays(from, i);
      if (rule.days.includes(parseYmd(d).getDay())) return d;
    }
  }
  return null;
}

export const categoryLabel: Record<string, string> = { work: 'شغل', study: 'مذاكرة', health: 'صحة', personal: 'شخصي' };

// ───────── Spaced repetition ─────────
export const REVIEW_STEPS = [1, 3, 7, 30] as const;

/** Flashcard SM-2-lite (S-06): easy / medium / hard. */
export function gradeCard(card: Row, grade: 'easy' | 'medium' | 'hard') {
  let ease = Number(card.ease ?? 2.5);
  let interval = Number(card.interval_days ?? 0);
  if (grade === 'hard') {
    ease = Math.max(1.3, ease - 0.2);
    interval = 1;
  } else if (grade === 'medium') {
    interval = interval < 1 ? 1 : Math.round(interval * ease * 0.8) || 2;
  } else {
    ease = ease + 0.15;
    interval = interval < 1 ? 3 : Math.round(interval * ease * 1.3);
  }
  return { ease: Math.round(ease * 100) / 100, interval_days: interval, due_date: addDays(today(), interval) };
}

// ───────── Misc ─────────
export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
export const pct = (n: number, d: number) => (d ? n / d : 0);
export function groupBy<T>(arr: T[], key: (t: T) => string) {
  const m = new Map<string, T[]>();
  for (const x of arr) {
    const k = key(x);
    (m.get(k) ?? m.set(k, []).get(k)!).push(x);
  }
  return m;
}
