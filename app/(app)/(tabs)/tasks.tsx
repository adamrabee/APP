import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Btn, Card, Check, Chips, Empty, Field, Row, Screen, SectionTitle, Segmented, Sheet, T } from '@/components/ui';
import { HabitEditor } from '@/components/habit-editor';
import { bumpHabit, toggleTask } from '@/lib/actions';
import { shortLabel, today } from '@/lib/dates';
import { insert, useQuery, useRows } from '@/lib/db';
import { categoryLabel, habitDueOn, habitStreak } from '@/lib/logic';
import { useTheme } from '@/lib/theme';

export default function Tasks() {
  const [tab, setTab] = useState<'tasks' | 'habits'>('tasks');
  return (
    <Screen title="المهام والعادات">
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { label: 'المهام', value: 'tasks' },
          { label: 'العادات', value: 'habits' },
        ]}
      />
      {tab === 'tasks' ? <TaskLists /> : <Habits />}
    </Screen>
  );
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
  const groups = [
    { key: 'late', label: 'متأخرة', list: tasks.filter((t) => t.due_date && t.due_date < d) },
    { key: 'today', label: 'النهارده', list: tasks.filter((t) => t.due_date === d) },
    { key: 'later', label: 'الجاي', list: tasks.filter((t) => t.due_date && t.due_date > d) },
    { key: 'none', label: 'بدون موعد', list: tasks.filter((t) => !t.due_date) },
  ];
  const add = () => {
    if (!title.trim()) return;
    insert('tasks', { title: title.trim(), category: filter === 'all' ? 'personal' : filter, due_date: d });
    setTitle('');
  };
  return (
    <>
      <Chips
        value={filter}
        onChange={setFilter}
        options={[{ label: 'الكل', value: 'all' }, ...Object.entries(categoryLabel).map(([value, label]) => ({ label, value }))]}
      />
      <Row>
        <View style={{ flex: 1 }}>
          <Field placeholder="مهمة جديدة للنهارده…" value={title} onChangeText={setTitle} onSubmitEditing={add} returnKeyType="done" />
        </View>
        <Btn title="أضف" small onPress={add} />
      </Row>
      {tasks.length === 0 && (
        <Card>
          <Empty text={showDone ? 'لسه ما خلصتش مهام.' : 'مفيش مهام هنا.'} mood="calm" />
        </Card>
      )}
      {(showDone ? [{ key: 'done', label: 'خلصت', list: tasks }] : groups).map(
        (g) =>
          g.list.length > 0 && (
            <View key={g.key} style={{ gap: 8 }}>
              <T size={13} sub w="semibold" color={g.key === 'late' ? c.danger : undefined}>
                {g.label} · {g.list.length}
              </T>
              <Card style={{ gap: 0, paddingVertical: 6 }}>
                {g.list.map((t) => {
                  const kids = subs.filter((s) => s.parent_id === t.id);
                  return (
                    <Pressable key={t.id} onPress={() => router.push({ pathname: '/task/[id]', params: { id: t.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
                      <Check on={!!t.done_at} onPress={() => toggleTask(t)} />
                      <View style={{ flex: 1 }}>
                        <T w="medium" strike={!!t.done_at}>
                          {t.title}
                        </T>
                        <T size={12} sub>
                          {[categoryLabel[t.category], t.due_date ? shortLabel(t.due_date) : null, t.repeat_rule ? '🔁' : null, kids.length ? `${kids.filter((k) => k.done_at).length}/${kids.length} فرعية` : null, t.notes ? '📝' : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </T>
                      </View>
                      <Ionicons name="chevron-back" size={16} color={c.faint} />
                    </Pressable>
                  );
                })}
              </Card>
            </View>
          ),
      )}
      <Btn kind="ghost" small title={showDone ? 'عرض المفتوحة' : 'عرض اللي خلصت'} onPress={() => setShowDone(!showDone)} />
    </>
  );
}

function Habits() {
  const { c } = useTheme();
  const [editing, setEditing] = useState(false);
  const habits = useQuery('habits', (h) => !h.archived, (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const logs = useRows('habit_logs');
  const d = today();
  return (
    <>
      <Btn title="عادة جديدة" icon="add" kind="soft" onPress={() => setEditing(true)} />
      {habits.length === 0 && (
        <Card>
          <Empty text="مفيش عادات لسه. ابدأ بعادة واحدة صغيرة." mood="calm" />
        </Card>
      )}
      {(['general', 'me'] as const).map((g) => {
        const list = habits.filter((h) => (h.group ?? 'general') === g);
        if (!list.length) return null;
        return (
          <View key={g} style={{ gap: 8 }}>
            <SectionTitle>{g === 'me' ? 'for me' : 'العادات'}</SectionTitle>
            {list.map((h) => {
              const s = habitStreak(h, logs);
              const due = habitDueOn(h, d, logs);
              const cnt = logs.find((l) => l.habit_id === h.id && l.date === d)?.count ?? 0;
              const target = h.period === 'weekly' ? 1 : h.target_per_day ?? 1;
              return (
                <Card key={h.id} onPress={() => router.push({ pathname: '/habit/[id]', params: { id: h.id } })} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name={(h.icon as any) || 'ellipse-outline'} size={22} color={c.text} />
                  <View style={{ flex: 1 }}>
                    <T w="semibold">{h.name}</T>
                    <T size={12} sub>
                      🔥 {s.current} يوم · الأطول {s.longest}
                      {!due ? ' · مش مطلوبة النهارده' : target > 1 ? ` · ${cnt}/${target}` : ''}
                    </T>
                  </View>
                  <Check on={cnt >= target} onPress={() => bumpHabit(h)} size={28} />
                </Card>
              );
            })}
          </View>
        );
      })}
      <Sheet visible={editing} onClose={() => setEditing(false)} title="عادة جديدة">
        <HabitEditor onDone={() => setEditing(false)} />
      </Sheet>
    </>
  );
}
