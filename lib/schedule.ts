/**
 * Study schedule generator (BRD §4.6.1, SP-04 rules).
 *
 * 1. Open assignments sorted by due date (soonest first, undated last).
 * 2. Each assignment is split into sessions of max 90 minutes, placed on days
 *    before its due date. Overdue assignments go on the first day.
 * 3. A session goes to the first day with room, preferring a day without the same
 *    subject. If it can't fit before the due date, it goes on the lightest day + warning.
 * 4. Leftover time is filled with 45-minute review sessions, rotating; subjects with
 *    the least time get priority, and no subject repeats within a day.
 * 5. Within a day: assignments (soonest due) → manual (custom) tasks → reviews.
 *    Suggested times start at start_time with 10-minute breaks.
 */
import { addDays, diffDays } from './dates';
import type { Row } from './db';

export type Settings = { start_date: string; days: number; hours_per_day: number; start_time: string };
export type Item = {
  day: string;
  subject_id: string | null;
  assignment_id: string | null;
  title: string;
  kind: 'assignment' | 'review' | 'custom';
  minutes: number;
  status: 'pending' | 'completed';
  sort_order: number;
  due?: string | null;
};

const SESSION = 90;
const REVIEW = 45;
const BREAK = 10;

export function generate(
  settings: Settings,
  subjects: Row[],
  assignments: Row[],
  keep: Item[], // completed + custom items to keep as-is
): { items: Item[]; warnings: string[] } {
  const warnings: string[] = [];
  const days = Array.from({ length: Math.max(1, settings.days) }, (_, i) => addDays(settings.start_date, i));
  const cap = Math.round(settings.hours_per_day * 60);
  const plan = new Map<string, Item[]>(days.map((d) => [d, []]));
  const used = (d: string) => (plan.get(d) ?? []).reduce((s, x) => s + x.minutes, 0);
  const hasSubject = (d: string, sid: string | null) => (plan.get(d) ?? []).some((x) => x.subject_id === sid);

  // Keep completed and manual items where they are.
  for (const k of keep) if (plan.has(k.day)) plan.get(k.day)!.push({ ...k });

  // Minutes already done per assignment (completed items count toward it).
  const doneMins = new Map<string, number>();
  for (const k of keep) if (k.assignment_id && k.status === 'completed') doneMins.set(k.assignment_id, (doneMins.get(k.assignment_id) ?? 0) + k.minutes);

  const open = assignments
    .filter((a) => !a.done)
    .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'));

  const minutesBySubject = new Map<string, number>();

  for (const a of open) {
    let remaining = Math.round(Number(a.est_hours) * 60) - (doneMins.get(a.id) ?? 0);
    const subjectName = subjects.find((s) => s.id === a.subject_id)?.name ?? '';
    const lastDay = a.due_date ? addDays(a.due_date, -1) : days[days.length - 1];
    const overdue = a.due_date && diffDays(a.due_date, settings.start_date) <= 0;
    let warned = false;
    while (remaining > 0) {
      const len = Math.min(SESSION, remaining);
      let candidates = overdue ? [days[0]] : days.filter((d) => d <= lastDay);
      let day =
        candidates.find((d) => used(d) + len <= cap && !hasSubject(d, a.subject_id)) ??
        candidates.find((d) => used(d) + len <= cap);
      if (!day) {
        // doesn't fit before the due date → lightest day overall, with a warning
        day = (overdue ? [days[0]] : days).slice().sort((x, y) => used(x) - used(y))[0];
        if (!warned) {
          warnings.push(`الوقت مش كفاية قبل تسليم "${a.title}"${subjectName ? ` (${subjectName})` : ''}`);
          warned = true;
        }
      }
      plan.get(day)!.push({
        day,
        subject_id: a.subject_id,
        assignment_id: a.id,
        title: a.title,
        kind: 'assignment',
        minutes: len,
        status: 'pending',
        sort_order: 0,
        due: a.due_date,
      });
      minutesBySubject.set(a.subject_id, (minutesBySubject.get(a.subject_id) ?? 0) + len);
      remaining -= len;
    }
  }

  // Fill leftover time with 45-min reviews, least-studied subjects first, no repeat per day.
  if (subjects.length) {
    for (const d of days) {
      while (cap - used(d) >= REVIEW) {
        const pick = subjects
          .filter((s) => !hasSubject(d, s.id))
          .sort((x, y) => (minutesBySubject.get(x.id) ?? 0) - (minutesBySubject.get(y.id) ?? 0))[0];
        if (!pick) break;
        plan.get(d)!.push({
          day: d,
          subject_id: pick.id,
          assignment_id: null,
          title: `مراجعة ${pick.name}`,
          kind: 'review',
          minutes: REVIEW,
          status: 'pending',
          sort_order: 0,
        });
        minutesBySubject.set(pick.id, (minutesBySubject.get(pick.id) ?? 0) + REVIEW);
      }
    }
  }

  // Order inside each day.
  const rank = { assignment: 0, custom: 1, review: 2 } as const;
  const items: Item[] = [];
  for (const d of days) {
    const list = plan.get(d)!;
    list.sort((x, y) => rank[x.kind] - rank[y.kind] || (x.due ?? '9999').localeCompare(y.due ?? '9999'));
    list.forEach((x, i) => items.push({ ...x, sort_order: i }));
  }
  return { items, warnings };
}

/** Suggested start times for a day's items: start_time + durations + 10-min breaks. */
export function suggestedTimes(startTime: string, minutes: number[]): string[] {
  const [h, m] = startTime.split(':').map(Number);
  let t = h * 60 + (m || 0);
  return minutes.map((len) => {
    const out = `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    t += len + BREAK;
    return out;
  });
}
