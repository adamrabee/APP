/**
 * Daily score (BRD §4.10): average completion of tasks, habits, on-time prayers,
 * daily study goal and skincare routine, × 10. Section weights come from settings.
 */
import { addDays, parseYmd } from './dates';
import { rows } from './db';
import { habitDueOn } from './logic';

export type SectionKey = 'tasks' | 'habits' | 'prayers' | 'study' | 'routine';
export const SECTIONS: SectionKey[] = ['tasks', 'habits', 'prayers', 'study', 'routine'];

export function dayParts(date: string): Partial<Record<SectionKey, number>> {
  const out: Partial<Record<SectionKey, number>> = {};
  const day = (iso: any) => String(iso ?? '').slice(0, 10);

  const tasks = rows('tasks').filter((t) => !t.parent_id && t.due_date === date);
  const work = rows('work_tasks').filter((t) => t.due_date === date);
  const totalT = tasks.length + work.length;
  if (totalT) out.tasks = (tasks.filter((t) => t.done_at).length + work.filter((t) => t.done).length) / totalT;

  const logs = rows('habit_logs');
  const habits = rows('habits').filter((h) => !h.archived && day(h.created_at) <= date && habitDueOn(h, date, logs));
  if (habits.length) {
    const done = habits.filter((h) => (logs.find((l) => l.habit_id === h.id && l.date === date)?.count ?? 0) >= (h.period === 'weekly' ? 1 : h.target_per_day ?? 1)).length;
    out.habits = done / habits.length;
  }

  const prayers = rows('prayer_logs').filter((p) => p.date === date);
  if (prayers.length) out.prayers = prayers.filter((p) => p.status === 'on_time').length / 5 + (prayers.filter((p) => p.status === 'late').length / 5) * 0.5;

  const goalMins = rows('subjects').filter((s) => !s.archived).reduce((a, s) => a + (Number(s.weekly_hours) || 0), 0) * 60 / 7;
  if (goalMins > 0) {
    const mins = rows('study_sessions').filter((s) => day(s.started_at) === date).reduce((a, s) => a + s.minutes, 0);
    out.study = Math.min(1, mins / goalMins);
  }

  const dow = parseYmd(date).getDay();
  const steps = rows('skincare_steps').filter((s) => !s.days_of_week?.length || s.days_of_week.includes(dow));
  if (steps.length) {
    const done = rows('routine_logs').filter((l) => l.date === date).flatMap((l) => l.completed_steps ?? []);
    out.routine = steps.filter((s) => done.includes(s.id)).length / steps.length;
  }
  return out;
}

export function dayScore(date: string, weights: Record<string, number>): number | null {
  const parts = dayParts(date);
  let sum = 0;
  let w = 0;
  for (const k of SECTIONS) {
    const v = parts[k];
    if (v === undefined) continue;
    const wk = Number(weights?.[k] ?? 1);
    sum += Math.min(1, v) * wk;
    w += wk;
  }
  return w ? Math.round((sum / w) * 100) / 10 : null;
}

export function weekReport(weekStartDate: string, weights: Record<string, number>) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i));
  const scores = days.map((d) => dayScore(d, weights));
  const valid = scores.filter((s): s is number => s !== null);
  const score = valid.length ? Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10 : 0;
  let bestIdx = -1;
  scores.forEach((s, i) => s !== null && (bestIdx < 0 || s > (scores[bestIdx] ?? -1)) && (bestIdx = i));

  // per-section averages for the "up or down?" table
  const section: Record<string, number> = {};
  for (const k of SECTIONS) {
    const vals = days.map((d) => dayParts(d)[k]).filter((v): v is number => v !== undefined);
    if (vals.length) section[k] = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100);
  }
  const end = addDays(weekStartDate, 7);
  const inWeek = (d: string) => d >= weekStartDate && d < end;
  section.gym = rows('workouts').filter((w) => inWeek(w.date)).length;
  section.money = Math.round(rows('transactions').filter((t) => t.type === 'expense' && inWeek(t.date)).reduce((a, t) => a + Number(t.amount_sar), 0));
  return { days, scores, score, bestDay: bestIdx >= 0 ? days[bestIdx] : null, section };
}
