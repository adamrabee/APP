import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Logo, MeeArt } from '@/components/mee';
import { Card, Check, Empty, ListRow, Row, Screen, Section, T, Tag, tap } from '@/components/ui';
import { bumpHabit, completeReview, subjectOfReview, toggleTask, toggleWorkTask } from '@/lib/actions';
import { diffDays, durationLabel, gregorianLabel, hijriLabel, parseYmd, today, weekStart, addDays } from '@/lib/dates';
import { update, useNow, useOwn, useQuery, useRows, useSync } from '@/lib/db';
import { categoryLabel, habitDueOn, habitStreak } from '@/lib/logic';
import { nextPrayer, prayerName, useCoords } from '@/lib/prayer';
import { useTheme } from '@/lib/theme';

type Line = { key: string; title: string; meta: string; done: boolean; tag: string; tagKind: string; late?: boolean; toggle: () => void; open?: () => void };

export default function Today() {
  const { c } = useTheme();
  const now = useNow();
  const d = today();
  const coords = useCoords();
  const profile = useOwn('profiles');
  const np = nextPrayer(coords, now, profile?.prayer_method);
  const sync = useSync();
  const dow = parseYmd(d).getDay();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'صباح الخير' : hour < 18 ? 'نهارك سعيد' : 'مساء الخير';

  // H-01: overdue → today → undated, then done
  const tasks = useQuery('tasks', (t) => !t.parent_id && (!t.done_at ? !t.due_date || t.due_date <= d : String(t.done_at).slice(0, 10) === d), undefined, [d]);
  const workTasks = useQuery('work_tasks', (t) => (!t.done && !!t.due_date && t.due_date <= d) || (t.done && String(t.done_at).slice(0, 10) === d && !!t.due_date), undefined, [d]);
  const reviews = useQuery('reviews', (r) => !r.done_at && r.due_date <= d, undefined, [d]);
  useRows('subject_units');
  useRows('subjects');
  const cardsDue = useQuery('flashcards', (f) => f.due_date <= d, undefined, [d]).length;
  const scheduleItems = useQuery('study_schedule_items', (i) => i.day === d, (a, b) => a.sort_order - b.sort_order, [d]);
  const steps = useRows('skincare_steps');
  const routineLogs = useRows('routine_logs');
  const habits = useQuery('habits', (h) => !h.archived, (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const logs = useRows('habit_logs');
  const spend = useQuery('transactions', (t) => t.date === d && t.type === 'expense', undefined, [d]);
  const goals = useQuery('goals', (g) => g.is_countdown && g.target_date && g.target_date >= d, (a, b) => a.target_date.localeCompare(b.target_date), [d]);
  const thisWeek = useQuery('weekly_reviews', (r) => r.week_start === weekStart(d), undefined, [d])[0];
  const lastWeek = useQuery('weekly_reviews', (r) => r.week_start === addDays(weekStart(d), -7), undefined, [d])[0];

  const lines: Line[] = [];
  const rank = (t: any) => (t.due_date && t.due_date < d ? 0 : t.due_date === d ? 1 : 2);
  for (const t of tasks.filter((x) => !x.done_at).sort((a, b) => rank(a) - rank(b) || (a.due_time ?? '99').localeCompare(b.due_time ?? '99'))) {
    const late = !!t.due_date && t.due_date < d;
    lines.push({ key: t.id, title: t.title, meta: [late ? 'متأخرة' : null, t.due_time?.slice(0, 5)].filter(Boolean).join(' · ') || (t.due_date ? 'اليوم' : 'بدون موعد'), done: false, tag: categoryLabel[t.category], tagKind: t.category, late, toggle: () => toggleTask(t), open: () => router.push({ pathname: '/task/[id]', params: { id: t.id } }) });
  }
  for (const t of workTasks.filter((x) => !x.done)) lines.push({ key: t.id, title: t.title, meta: t.due_date < d ? 'متأخرة' : 'شغل النهارده', late: t.due_date < d, done: false, tag: 'شغل', tagKind: 'work', toggle: () => toggleWorkTask(t), open: () => router.push('/work') });
  for (const i of scheduleItems.filter((x) => x.status !== 'completed')) lines.push({ key: i.id, title: i.title, meta: `${i.minutes} دقيقة`, done: false, tag: 'مذاكرة', tagKind: 'study', toggle: () => update('study_schedule_items', i.id, { status: 'completed' }), open: () => router.push('/study-schedule') });
  for (const r of reviews) {
    const { unit, subject } = subjectOfReview(r);
    lines.push({ key: r.id, title: `مراجعة: ${unit?.title ?? 'جزء'}`, meta: `${subject?.name ?? ''} · مراجعة اليوم ${r.step}`, done: false, tag: 'مذاكرة', tagKind: 'study', toggle: () => completeReview(r), open: () => subject && router.push({ pathname: '/subject/[id]', params: { id: subject.id } }) });
  }
  if (cardsDue) lines.push({ key: 'cards', title: `${cardsDue} بطاقة للمراجعة`, meta: 'بطاقات', done: false, tag: 'مذاكرة', tagKind: 'study', toggle: () => router.push('/flashcards'), open: () => router.push('/flashcards') });
  // M-05: today's skincare routines
  for (const r of ['AM', 'PM'] as const) {
    const list = steps.filter((s) => s.routine === r && (!s.days_of_week?.length || s.days_of_week.includes(dow)));
    if (!list.length) continue;
    const log = routineLogs.find((l) => l.routine === r && l.date === d);
    const done = list.every((s) => log?.completed_steps?.includes(s.id));
    lines.push({ key: 'routine' + r, title: r === 'AM' ? 'روتين السكن كير الصباحي' : 'روتين السكن كير المسائي', meta: `${list.length} خطوات`, done, tag: 'me', tagKind: 'me', toggle: () => router.push('/skincare'), open: () => router.push('/skincare') });
  }
  for (const t of tasks.filter((x) => x.done_at)) lines.push({ key: t.id, title: t.title, meta: 'خلص', done: true, tag: categoryLabel[t.category], tagKind: t.category, toggle: () => toggleTask(t) });
  for (const t of workTasks.filter((x) => x.done)) lines.push({ key: t.id, title: t.title, meta: 'خلص', done: true, tag: 'شغل', tagKind: 'work', toggle: () => toggleWorkTask(t) });
  for (const i of scheduleItems.filter((x) => x.status === 'completed')) lines.push({ key: i.id, title: i.title, meta: 'خلص', done: true, tag: 'مذاكرة', tagKind: 'study', toggle: () => update('study_schedule_items', i.id, { status: 'pending' }) });
  const doneCount = lines.filter((l) => l.done).length;

  const dueHabits = habits.filter((h) => habitDueOn(h, d, logs));
  const uniDays = profile?.university_date ? diffDays(profile.university_date, d) : goals[0] ? diffDays(goals[0].target_date, d) : null;
  const uniLabel = profile?.university_date ? 'دخول الجامعة' : goals[0]?.title ?? 'دخول الجامعة';
  const spent = spend.reduce((s, t) => s + Number(t.amount_sar ?? 0), 0);
  const showMee = dow === 5 || !!thisWeek || !!lastWeek;
  const review = thisWeek ?? lastWeek;
  const diff = thisWeek && lastWeek ? Math.round((thisWeek.score - lastWeek.score) * 10) / 10 : null;

  return (
    <Screen>
      {/* H-02 header */}
      <Row style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ gap: 2, flex: 1 }}>
          <T size={14} sub>
            {greeting}
          </T>
          <T size={26} w="bold" lh={1.3}>
            {gregorianLabel(d).replace(' ', '، ')}
          </T>
          <T size={13} sub>
            {hijriLabel(d)}
            {sync.pending > 0 ? `  ·  ${sync.online ? 'بيتزامن…' : 'محفوظ على الجهاز'}` : ''}
          </T>
        </View>
        <Pressable onPress={() => router.push('/search')} onLongPress={() => router.push('/settings')}>
          <Logo size={44} />
        </Pressable>
      </Row>

      {/* next prayer */}
      <Pressable onPress={() => router.push('/worship')} style={{ backgroundColor: c.primarySoft, borderRadius: 20, paddingVertical: 16, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ gap: 2 }}>
          <T size={13} color={c.primaryDark}>
            الصلاة القادمة
          </T>
          <T size={20} w="bold">
            {prayerName[np.prayer]} · {np.at.getHours() % 12 || 12}:{String(np.at.getMinutes()).padStart(2, '0')}
          </T>
        </View>
        <View style={{ backgroundColor: c.card, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 }}>
          <T size={13} w="medium" color={c.primaryDark}>
            بعد {durationLabel(np.at.getTime() - now.getTime()).replace(' س ', ' ساعة و').replace(' د', ' د')}
          </T>
        </View>
      </Pressable>

      {/* R-05 MEE card */}
      {showMee && (
        <Pressable onPress={() => router.push('/weekly-review')} style={{ backgroundColor: '#1B1E1C', borderRadius: 20, paddingVertical: 10, paddingRight: 10, paddingLeft: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <MeeArt size={56} />
          <View style={{ flex: 1, gap: 2 }}>
            <T size={14} w="semibold" color="#F2F2EF">
              {diff === null ? 'MEE: مراجعة الأسبوع جاهزة' : diff >= 0 ? 'MEE: أسبوعك طالع لفوق' : 'MEE: أسبوع تقيل، عادي'}
            </T>
            <T size={12} color="#C9CFC9">
              {review ? `سكور ${review.score} · شوف مراجعة الأسبوع` : 'شوف مراجعة الأسبوع'}
            </T>
          </View>
          {diff !== null && (
            <T size={13} w="bold" color={diff >= 0 ? '#7FD3A0' : '#E89A86'}>
              {diff >= 0 ? `↑ ${diff}` : `↓ ${-diff}`}
            </T>
          )}
        </Pressable>
      )}

      <Section title="مهام اليوم" note={lines.length ? `${doneCount} من ${lines.length}` : undefined}>
        <Card list>
          {lines.length === 0 && <Empty text="مفيش مهام لليوم. اضغط + وضيف أول مهمة." mood="calm" />}
          {lines.length > 0 && doneCount === lines.length && <Empty text="خلّصت كل مهام اليوم! 🎉" mood="stars" />}
          {lines.map((l, i) => (
            <ListRow key={l.key} onPress={l.open} last={i === lines.length - 1}>
              <Check on={l.done} onPress={l.toggle} />
              <View style={{ flex: 1 }}>
                <T w="medium" strike={l.done} color={l.done ? c.sub : c.text}>
                  {l.title}
                </T>
                <T size={12} color={l.late ? c.danger : c.sub}>
                  {l.meta}
                </T>
              </View>
              {l.tag ? <Tag text={l.tag} category={l.tagKind} /> : null}
            </ListRow>
          ))}
        </Card>
      </Section>

      <Section title="عادات اليوم" action="الكل" onAction={() => router.push('/tasks')}>
        {dueHabits.length === 0 ? (
          <Card>
            <Empty text="ضيف عاداتك من تبويب المهام." mood="calm" />
          </Card>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {dueHabits.map((h) => {
              const cnt = logs.find((l) => l.habit_id === h.id && l.date === d)?.count ?? 0;
              const target = h.period === 'weekly' ? 1 : h.target_per_day ?? 1;
              const full = cnt >= target;
              const st = habitStreak(h, logs);
              return (
                <Pressable
                  key={h.id}
                  onPress={() => (tap(), bumpHabit(h))}
                  onLongPress={() => router.push({ pathname: '/habit/[id]', params: { id: h.id } })}
                  style={{ width: '22.8%', backgroundColor: c.card, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 4, alignItems: 'center', gap: 6 }}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: full ? c.primary : c.track, backgroundColor: full ? c.primary : c.card, alignItems: 'center', justifyContent: 'center' }}>
                    <T size={12} w="bold" color={full ? '#FFFFFF' : c.primary}>
                      {full ? '✓' : cnt > 0 ? cnt : ''}
                    </T>
                  </View>
                  <T size={12} w="medium" lines={1} center>
                    {h.name}
                  </T>
                  <T size={11} sub>
                    {target > 1 && !full ? `${cnt} / ${target}` : `${st.current} ${st.current === 1 ? 'يوم' : st.current <= 10 && st.current > 2 ? 'أيام' : 'يوم'}`}
                  </T>
                </Pressable>
              );
            })}
          </View>
        )}
      </Section>

      {/* H-05 summary */}
      <Row>
        {/* only when the user added a countdown themselves (goals / university date) */}
        {uniDays !== null && <SummaryCard label={uniLabel} value={uniDays} unit="يوم" onPress={() => router.push('/goals')} />}
        <SummaryCard label="مصروف اليوم" value={spent} unit="ر.س" onPress={() => router.push('/money')} />
      </Row>
    </Screen>
  );
}

function SummaryCard({ label, value, unit, onPress }: { label: string; value: string | number; unit: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ flex: 1, backgroundColor: c.card, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 16, gap: 4 }}>
      <T size={12} sub lines={1}>
        {label}
      </T>
      <T size={24} w="bold">
        {value} <T size={13} w="medium">{unit}</T>
      </T>
    </Pressable>
  );
}
