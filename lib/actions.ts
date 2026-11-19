// Shared write actions used across screens.
import { addDays, today, ymd } from './dates';
import { get, insert, remove, rows, update, type Row } from './db';
import { nextDue, REVIEW_STEPS, type RepeatRule } from './logic';

// ───────── tasks ─────────
export function toggleTask(t: Row) {
  if (t.done_at) {
    update('tasks', t.id, { done_at: null });
    return;
  }
  update('tasks', t.id, { done_at: new Date().toISOString() });
  const rule = t.repeat_rule as RepeatRule;
  if (rule) {
    const next = nextDue(rule, t.due_date ?? today());
    if (next) {
      insert('tasks', {
        title: t.title,
        category: t.category,
        due_date: next,
        due_time: t.due_time,
        repeat_rule: rule,
        notes: t.notes,
        remind_at: t.remind_at,
      });
    }
  }
}

export function deleteTask(id: string) {
  remove('tasks', id, [['tasks', 'parent_id']]);
}

// ───────── habits ─────────
export function bumpHabit(h: Row, date = today()) {
  const log = rows('habit_logs').find((l) => l.habit_id === h.id && l.date === date);
  const target = h.period === 'weekly' ? 1 : h.target_per_day ?? 1;
  if (!log) insert('habit_logs', { habit_id: h.id, date, count: 1 });
  else if (log.count >= target) remove('habit_logs', log.id);
  else update('habit_logs', log.id, { count: log.count + 1 });
}

export function habitCount(h: Row, date = today()) {
  return rows('habit_logs').find((l) => l.habit_id === h.id && l.date === date)?.count ?? 0;
}

// ───────── work tasks ─────────
export function logActivity(text: string, kind: string) {
  insert('work_activity', { text, kind });
  // keep last 30
  const all = rows('work_activity').slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  for (const r of all.slice(30)) remove('work_activity', r.id);
}

export function toggleWorkTask(t: Row) {
  const done = !t.done;
  const patch: Record<string, any> = { done, done_at: done ? new Date().toISOString() : null };
  // WK-11: stop the timer when the task is finished
  const state = rows('work_state')[0];
  if (done && state?.timer_task_id === t.id && state.timer_started_at) {
    patch.tracked_seconds = (t.tracked_seconds ?? 0) + Math.round((Date.now() - new Date(state.timer_started_at).getTime()) / 1000);
    update('work_state', state.user_id, { timer_task_id: null, timer_started_at: null });
  }
  update('work_tasks', t.id, patch);
  logActivity(`${done ? 'خلصت' : 'رجّعت'}: ${t.title}`, done ? 'done' : 'undo');
  // WK-10: repeating → create next copy
  if (done && t.repeat && t.repeat !== 'none') {
    const base = t.due_date ?? today();
    const next =
      t.repeat === 'daily' ? addDays(base, 1) : t.repeat === 'weekly' ? addDays(base, 7) : (() => {
        const d = new Date(base);
        d.setMonth(d.getMonth() + 1);
        return ymd(d);
      })();
    insert('work_tasks', {
      title: t.title,
      description: t.description,
      priority: t.priority,
      due_date: next,
      project_id: t.project_id,
      repeat: t.repeat,
    });
  }
}

// ───────── study ─────────
/** S-02 + S-05: setting a unit to done schedules reviews after 1, 3, 7, 30 days. */
export function setUnitStatus(u: Row, status: string) {
  const wasDone = u.status === 'done';
  update('subject_units', u.id, { status, completed_at: status === 'done' ? new Date().toISOString() : null });
  if (status === 'done' && !wasDone) {
    const existing = rows('reviews').filter((r) => r.unit_id === u.id && !r.done_at);
    for (const r of existing) remove('reviews', r.id);
    for (const step of REVIEW_STEPS) insert('reviews', { unit_id: u.id, step, due_date: addDays(today(), step) });
  }
}

export function completeReview(r: Row) {
  update('reviews', r.id, { done_at: new Date().toISOString() });
}

export function subjectOfReview(r: Row) {
  const unit = get('subject_units', r.unit_id);
  return { unit, subject: unit ? get('subjects', unit.subject_id) : undefined };
}

// ───────── skill tree ─────────
export function descendants(id: string): string[] {
  const all = rows('skill_nodes');
  const out: string[] = [];
  const walk = (pid: string) => {
    for (const n of all) if (n.parent_id === pid) (out.push(n.id), walk(n.id));
  };
  walk(id);
  return out;
}
