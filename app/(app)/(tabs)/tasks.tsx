import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { HabitEditor } from '@/components/habit-editor';
import { Btn, Card, Check, Chips, Empty, Field, ListRow, Row, Screen, Section, Segmented, Sheet, T, Tag } from '@/components/ui';
import { bumpHabit, toggleTask } from '@/lib/actions';
import { shortLabel, today, addDays } from '@/lib/dates';
import { insert, useQuery, useRows } from '@/lib/db';
import { categoryLabel, habitDueOn, habitStreak } from '@/lib/logic';
import { useTheme } from '@/lib/theme';

export default function Tasks() {
  const [tab, setTab] = useState<'tasks' | 'habits'>('tasks');
  return (
    <Screen title="المهام والعادات">
      <Segmented value={tab} onChange={setTab} options={[{ label: 'المهام', value: 'tasks' }, { label: 'العادات', value: 'habits' }]} />
      {tab === 'tasks' ? <TaskLists /> : <Habits />}
    </Screen>
  );
}

function dueLabel(due: string | null, d: string) {
  if (!due) return '';
  if (due === addDays(d, -1)) return 'أمس';
  if (due === d) return 'اليوم';
  if (due === addDays(d, 1)) return 'بكرة';
  return shortLabel(due);
}

function TaskLists() {
  const { c } = useTheme();
  const [filter, setFilter] = useState<string>('all');
  const [showDone, setShowDone] = useState(false);
  const [title, setTitle] = useState('');
  const d = today();
  const tasks = useQuery(
    'tasks',
    (t) => !t.parent_id && (showDone ? !!t.done_at : !t.done_at) && (filter === 'all' || t.category === filter),
    (a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || (a.sort_order ?? 0) - (b.sort_order ?? 0),
    [filter, showDone],
  );
  const subs = useRows('tasks');
  const groups = showDone
    ? [{ key: 'done', label: 'خلصت', color: c.sub, list: tasks }]
    : [
        { key: 'late', label: 'متأخرة', color: c.danger, list: tasks.filter((t) => t.due_date && t.due_date < d) },
        { key: 'today', label: 'اليوم', color: c.text, list: tasks.filter((t) => t.due_date === d) },
        { key: 'later', label: 'الجاي', color: c.text, list: tasks.filter((t) => t.due_date && t.due_date > d) },
        { key: 'none', label: 'بدون موعد', color: c.sub, list: tasks.filter((t) => !t.due_date) },
      ];
  const add = () => {
    if (!title.trim()) return;
    insert('tasks', { title: title.trim(), category: filter === 'all' ? 'personal' : filter, due_date: d });
    setTitle('');
  };
  return (
    <View style={{ gap: 18 }}>
      <Chips value={filter} onChange={setFilter} options={[{ label: 'الكل', value: 'all' }, ...Object.entries(categoryLabel).map(([value, label]) => ({ label, value }))]} />
      <Row>
        <View style={{ flex: 1 }}>
          <Field placeholder="مهمة جديدة لليوم…" value={title} onChangeText={setTitle} onSubmitEditing={add} returnKeyType="done" />
        </View>
        <Btn title="أضف" small onPress={add} />
      </Row>
      {tasks.length === 0 && (
        <Card>
          <Empty text={showDone ? 'لسه ما خلصتش مهام.' : 'مفيش مهام هنا.'} mood="calm" />
        </Card>
      )}
      {groups.map(
        (g) =>
          g.list.length > 0 && (
            <View key={g.key} style={{ gap: 8 }}>
              <T size={14} w="semibold" color={g.color}>
                {g.label}
              </T>
              <Card list>
                {g.list.map((t, i) => {
                  const kids = subs.filter((s) => s.parent_id === t.id);
                  const meta = [dueLabel(t.due_date, d), t.due_time?.slice(0, 5), t.repeat_rule ? '🔁' : null, kids.length ? `${kids.filter((k) => k.done_at).length}/${kids.length}` : null].filter(Boolean).join(' · ');
                  return (
                    <ListRow key={t.id} minHeight={54} last={i === g.list.length - 1} onPress={() => router.push({ pathname: '/task/[id]', params: { id: t.id } })}>
                      <Check on={!!t.done_at} onPress={() => toggleTask(t)} />
                      <T w="medium" style={{ flex: 1 }} strike={!!t.done_at}>
                        {t.title}
                      </T>
                      {filter === 'all' && t.category !== 'personal' ? <Tag text={categoryLabel[t.category]} category={t.category} /> : null}
                      {meta ? (
                        <T size={12} sub>
                          {meta}
                        </T>
                      ) : null}
                    </ListRow>
                  );
                })}
              </Card>
            </View>
          ),
      )}
      <Btn kind="link" small title={showDone ? 'عرض المفتوحة' : 'عرض اللي خلصت'} onPress={() => setShowDone(!showDone)} />
    </View>
  );
}

function Habits() {
  const { c } = useTheme();
  const [editing, setEditing] = useState(false);
  const habits = useQuery('habits', (h) => !h.archived, (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const logs = useRows('habit_logs');
  const d = today();
  return (
    <View style={{ gap: 18 }}>
      <Btn title="عادة جديدة" icon="add" onPress={() => setEditing(true)} />
      {habits.length === 0 && (
        <Card>
          <Empty text="مفيش عادات لسه. ابدأ بعادة واحدة صغيرة." mood="calm" />
        </Card>
      )}
      {(['general', 'me'] as const).map((g) => {
        const list = habits.filter((h) => (h.group ?? 'general') === g);
        if (!list.length) return null;
        return (
          <Section key={g} title={g === 'me' ? 'عادات for me' : 'العادات'} titleSize={14}>
            <Card list>
              {list.map((h, i) => {
                const s = habitStreak(h, logs);
                const due = habitDueOn(h, d, logs);
                const cnt = logs.find((l) => l.habit_id === h.id && l.date === d)?.count ?? 0;
                const target = h.period === 'weekly' ? 1 : h.target_per_day ?? 1;
                return (
                  <ListRow key={h.id} last={i === list.length - 1} onPress={() => router.push({ pathname: '/habit/[id]', params: { id: h.id } })}>
                    <Pressable onPress={() => bumpHabit(h)} hitSlop={8} style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 3, borderColor: cnt >= target ? c.primary : c.track, backgroundColor: cnt >= target ? c.primary : c.card, alignItems: 'center', justifyContent: 'center' }}>
                      <T size={11} w="bold" color={cnt >= target ? '#FFFFFF' : c.primary}>
                        {cnt >= target ? '✓' : cnt || ''}
                      </T>
                    </Pressable>
                    <View style={{ flex: 1 }}>
                      <T w="medium">{h.name}</T>
                      <T size={12} sub>
                        {due ? (target > 1 ? `${cnt} / ${target} النهارده` : 'النهارده') : 'مش مطلوبة النهارده'}
                      </T>
                    </View>
                    <T size={12} w="medium" sub>
                      🔥 {s.current} · الأطول {s.longest}
                    </T>
                  </ListRow>
                );
              })}
            </Card>
          </Section>
        );
      })}
      <Sheet visible={editing} onClose={() => setEditing(false)} title="عادة جديدة">
        <HabitEditor onDone={() => setEditing(false)} />
      </Sheet>
    </View>
  );
}
