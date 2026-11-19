import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { Logo, Mee } from '@/components/mee';
import { Card, Check, Empty, Pill, Ring, Row, Screen, SectionTitle, Stat, T, tap } from '@/components/ui';
import { bumpHabit, completeReview, subjectOfReview, toggleTask, toggleWorkTask } from '@/lib/actions';
import { diffDays, durationLabel, gregorianLabel, hijriLabel, parseYmd, today, weekStart } from '@/lib/dates';
import { update, useNow, useOwn, useQuery, useRows, useSync } from '@/lib/db';
import { categoryLabel, habitDueOn } from '@/lib/logic';
import { nextPrayer, prayerName, useCoords } from '@/lib/prayer';
import { useTheme } from '@/lib/theme';

export default function Today() {
  const { c } = useTheme();
  const now = useNow();
  const d = today();
  const coords = useCoords();
  const profile = useOwn('profiles');
  const np = nextPrayer(coords, now, profile?.prayer_method);
  const sync = useSync();

  // H-01: overdue → today → undated
  const tasks = useQuery(
    'tasks',
    (t) => !t.parent_id && (!t.done_at ? !t.due_date || t.due_date <= d : String(t.done_at).slice(0, 10) === d && (t.due_date ?? d) <= d),
    (a, b) => rank(a, d) - rank(b, d) || (a.due_time ?? '99').localeCompare(b.due_time ?? '99') || (a.sort_order ?? 0) - (b.sort_order ?? 0),
    [d],
  );
  const workTasks = useQuery('work_tasks', (t) => (!t.done && t.due_date && t.due_date <= d) || (t.done && String(t.done_at).slice(0, 10) === d && t.due_date), undefined, [d]);
  const reviews = useQuery('reviews', (r) => !r.done_at && r.due_date <= d, undefined, [d]);
  useRows('subject_units');
  useRows('subjects');
  const cardsDue = useQuery('flashcards', (f) => f.due_date <= d, undefined, [d]).length;
  const scheduleItems = useQuery('study_schedule_items', (i) => i.day === d, (a, b) => a.sort_order - b.sort_order, [d]);

  const habits = useQuery('habits', (h) => !h.archived, (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const logs = useRows('habit_logs');
  const dueHabits = habits.filter((h) => habitDueOn(h, d, logs));

  const steps = useRows('skincare_steps');
  const routineLogs = useRows('routine_logs');
  const dow = parseYmd(d).getDay();
  const routine = (['AM', 'PM'] as const).map((r) => {
    const list = steps.filter((s) => s.routine === r && (!s.days_of_week?.length || s.days_of_week.includes(dow)));
    const log = routineLogs.find((l) => l.routine === r && l.date === d);
    const done = list.filter((s) => log?.completed_steps?.includes(s.id)).length;
    return { r, total: list.length, done };
  });

  const meals = useQuery('meals', (m) => m.date === d, undefined, [d]);
  const spend = useQuery('transactions', (t) => t.date === d && t.type === 'expense', undefined, [d]);
  const goals = useQuery('goals', (g) => g.is_countdown && g.target_date && g.target_date >= d, (a, b) => a.target_date.localeCompare(b.target_date), [d]);
  const review = useQuery('weekly_reviews', (r) => r.week_start === weekStart(d), undefined, [d])[0];

  const openTasks = tasks.filter((t) => !t.done_at).length + workTasks.filter((t) => !t.done).length + reviews.length + scheduleItems.filter((i) => i.status !== 'completed').length;
  const doneTasks = tasks.filter((t) => t.done_at).length + workTasks.filter((t) => t.done).length + scheduleItems.filter((i) => i.status === 'completed').length;
  const allDone = openTasks === 0 && doneTasks > 0;

  const uniDays = profile?.university_date ? diffDays(profile.university_date, d) : goals[0] ? diffDays(goals[0].target_date, d) : null;
  const uniLabel = profile?.university_date ? 'للجامعة' : goals[0]?.title ?? '';

  const calories = meals.reduce((s, m) => s + (m.calories ?? 0), 0);
  const spent = spend.reduce((s, t) => s + Number(t.amount_sar ?? 0), 0);
  const isFriday = dow === 5;

  return (
    <Screen>
      {/* H-02: top strip */}
      <Row>
        <Logo size={36} />
        <View style={{ flex: 1 }}>
          <T size={18} w="bold">
            {gregorianLabel(d)}
          </T>
          <T size={12} sub>
            {hijriLabel(d)}
            {sync.pending > 0 ? `  ·  ${sync.online ? 'بيتزامن…' : 'محفوظ على الجهاز'}` : ''}
          </T>
        </View>
        <Pressable onPress={() => router.push('/search')} hitSlop={10}>
          <Ionicons name="search" size={22} color={c.text} />
        </Pressable>
      </Row>

      <Card onPress={() => router.push('/worship')} tint={c.sec.worship} style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="moon-outline" size={22} color={c.text} />
        <View style={{ flex: 1 }}>
          <T size={13} sub>
            الصلاة القادمة
          </T>
          <T w="semibold">
            {prayerName[np.prayer]} · {np.at.getHours() % 12 || 12}:{String(np.at.getMinutes()).padStart(2, '0')}
          </T>
        </View>
        <T w="bold" color={c.primary}>
          بعد {durationLabel(np.at.getTime() - now.getTime())}
        </T>
      </Card>

      {/* R-05: MEE weekly review card */}
      {(isFriday || review) && (
        <Card onPress={() => router.push('/weekly-review')} tint="#0E100F" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Mee mood={review && review.score >= 6 ? 'happy' : 'coffee'} size={54} />
          <View style={{ flex: 1 }}>
            <T w="bold" color="#F2F2EF">
              مراجعة الأسبوع جاهزة
            </T>
            <T size={12} color="#9BA19C">
              {review ? `سكور الأسبوع ${review.score}/10` : 'MEE جهّز لك ملخص أسبوعك'}
            </T>
          </View>
          <Ionicons name="chevron-back" size={18} color="#9BA19C" />
        </Card>
      )}

      <SectionTitle action="كل المهام" onAction={() => router.push('/tasks')}>
        مهام اليوم {openTasks ? `(${openTasks})` : ''}
      </SectionTitle>
      <Card style={{ gap: 2 }}>
        {allDone ? (
          <Empty text="خلّصت كل مهام اليوم! 🎉" mood="stars" />
        ) : openTasks + doneTasks === 0 ? (
          <Empty text="مفيش مهام لليوم. اضغط + وضيف أول مهمة." mood="calm" />
        ) : null}
        {tasks.map((t) => (
          <TaskLine
            key={t.id}
            done={!!t.done_at}
            title={t.title}
            meta={[t.due_date && t.due_date < d && !t.done_at ? 'متأخرة' : null, categoryLabel[t.category], t.due_time?.slice(0, 5)].filter(Boolean).join(' · ')}
            late={!!t.due_date && t.due_date < d && !t.done_at}
            onToggle={() => toggleTask(t)}
            onPress={() => router.push({ pathname: '/task/[id]', params: { id: t.id } })}
          />
        ))}
        {workTasks.map((t) => (
          <TaskLine key={t.id} done={t.done} title={t.title} meta="شغل" tag onToggle={() => toggleWorkTask(t)} onPress={() => router.push('/work')} late={!t.done && t.due_date < d} />
        ))}
        {scheduleItems.map((i) => (
          <TaskLine
            key={i.id}
            done={i.status === 'completed'}
            title={i.title}
            meta={`مذاكرة · ${i.minutes} د`}
            onToggle={() => update('study_schedule_items', i.id, { status: i.status === 'completed' ? 'pending' : 'completed' })}
            onPress={() => router.push('/study-schedule')}
          />
        ))}
        {reviews.map((r) => {
          const { unit, subject } = subjectOfReview(r);
          return <TaskLine key={r.id} done={false} title={`مراجعة: ${unit?.title ?? 'جزء'}`} meta={`${subject?.name ?? ''} · بعد ${r.step} يوم`} onToggle={() => completeReview(r)} onPress={() => subject && router.push({ pathname: '/subject/[id]', params: { id: subject.id } })} />;
        })}
        {cardsDue > 0 && <TaskLine done={false} title={`${cardsDue} بطاقة للمراجعة`} meta="بطاقات" onToggle={() => router.push('/flashcards')} onPress={() => router.push('/flashcards')} />}
      </Card>

      {/* H-03 habits as circles */}
      <SectionTitle action="العادات" onAction={() => router.push('/tasks')}>
        عادات اليوم
      </SectionTitle>
      {dueHabits.length === 0 ? (
        <Card>
          <Empty text="ضيف عاداتك من تبويب المهام." mood="calm" />
        </Card>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {dueHabits.map((h) => {
            const cnt = logs.find((l) => l.habit_id === h.id && l.date === d)?.count ?? 0;
            const target = h.period === 'weekly' ? 1 : h.target_per_day ?? 1;
            const full = cnt >= target;
            return (
              <Pressable key={h.id} onPress={() => (tap(), bumpHabit(h))} onLongPress={() => router.push({ pathname: '/habit/[id]', params: { id: h.id } })} style={{ alignItems: 'center', width: 68, gap: 4 }}>
                <Ring value={cnt / target} size={52} stroke={4} color={c.ink}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: full ? c.ink : c.card, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={(h.icon as any) || 'ellipse-outline'} size={18} color={full ? c.onInk : c.text} />
                  </View>
                </Ring>
                <T size={11} center lines={1}>
                  {h.name}
                </T>
                {target > 1 && (
                  <T size={10} faint>
                    {cnt}/{target}
                  </T>
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      {/* M-05 routine due today */}
      {routine.some((r) => r.total > 0) && (
        <Row>
          {routine
            .filter((r) => r.total)
            .map((r) => (
              <Card key={r.r} onPress={() => router.push('/skincare')} tint={c.sec.me} style={{ flex: 1, gap: 6 }}>
                <T size={13} sub>
                  {r.r === 'AM' ? 'روتين الصباح ☀️' : 'روتين المساء 🌙'}
                </T>
                <T w="bold">
                  {r.done}/{r.total} {r.done === r.total ? '✓' : ''}
                </T>
              </Card>
            ))}
        </Row>
      )}

      {/* H-05 summary cards */}
      <Row>
        <Pressable style={{ flex: 1 }} onPress={() => router.push('/gym')}>
          <Stat label="سعرات اليوم" value={calories} sub={profile?.calorie_goal ? `من ${profile.calorie_goal}` : undefined} />
        </Pressable>
        <Pressable style={{ flex: 1 }} onPress={() => router.push('/money')}>
          <Stat label="مصروف اليوم" value={`${spent} ر.س`} />
        </Pressable>
        {uniDays !== null && (
          <Pressable style={{ flex: 1 }} onPress={() => router.push('/goals')}>
            <Stat label="الأيام المتبقية" value={uniDays} sub={uniLabel} />
          </Pressable>
        )}
      </Row>
    </Screen>
  );
}

function rank(t: any, d: string) {
  if (t.done_at) return 3;
  if (t.due_date && t.due_date < d) return 0;
  if (t.due_date === d) return 1;
  return 2;
}

function TaskLine({ done, title, meta, onToggle, onPress, late, tag }: { done: boolean; title: string; meta?: string; onToggle: () => void; onPress?: () => void; late?: boolean; tag?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, opacity: pressed ? 0.6 : 1 })}>
      <Check on={done} onPress={onToggle} />
      <View style={{ flex: 1 }}>
        <T strike={done} faint={done} w="medium">
          {title}
        </T>
        {meta ? (
          <T size={12} color={late ? c.danger : c.sub}>
            {meta}
          </T>
        ) : null}
      </View>
      {tag && <Pill text="شغل" color={c.text} bg={c.sec.work} />}
    </Pressable>
  );
}
