import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { HabitEditor } from '@/components/habit-editor';
import { Btn, Card, confirm, Empty, IconBtn, Row, Screen, SectionTitle, Sheet, Stat, T } from '@/components/ui';
import { bumpHabit } from '@/lib/actions';
import { addDays, monthStart, parseYmd, today, ymd } from '@/lib/dates';
import { get, remove, update, useRows } from '@/lib/db';
import { habitDoneDates, habitDueOn, habitStreak } from '@/lib/logic';
import { useTheme } from '@/lib/theme';

/** Habit details with streak (T-05) and a monthly squares map (T-06). */
export default function HabitDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  useRows('habits');
  const logs = useRows('habit_logs');
  const h = get('habits', id);
  const [edit, setEdit] = useState(false);
  const [month, setMonth] = useState(monthStart());
  if (!h) {
    return (
      <Screen back title="عادة">
        <Empty text="العادة دي اتحذفت." mood="sad" />
      </Screen>
    );
  }
  const s = habitStreak(h, logs);
  const done = new Set(habitDoneDates(h, logs));
  const partial = new Set(logs.filter((l) => l.habit_id === h.id).map((l) => l.date));
  const first = parseYmd(month);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 1) % 7; // weeks start Saturday
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => addDays(month, i))];
  const monthDone = cells.filter((x) => x && done.has(x)).length;
  const monthDue = cells.filter((x) => x && x <= today() && habitDueOn(h, x, logs)).length;
  const shift = (n: number) => {
    const d = parseYmd(month);
    d.setMonth(d.getMonth() + n);
    setMonth(ymd(d).slice(0, 7) + '-01');
  };

  return (
    <Screen
      back
      title={h.name}
      right={
        <Row gap={2}>
          <IconBtn name="create-outline" onPress={() => setEdit(true)} />
          <IconBtn name="archive-outline" onPress={() => confirm('تأرشف العادة دي؟ (السجل بيفضل محفوظ)', () => (update('habits', h.id, { archived: true }), router.back()))} />
          <IconBtn name="trash-outline" onPress={() => confirm('تحذف العادة وكل سجلها؟', () => (remove('habits', h.id, [['habit_logs', 'habit_id']]), router.back()))} />
        </Row>
      }
    >
      <Row>
        <Stat label="السلسلة الحالية" value={`🔥 ${s.current}`} />
        <Stat label="أطول سلسلة" value={s.longest} />
        <Stat label="الشهر ده" value={`${monthDone}/${monthDue || 0}`} />
      </Row>
      <Btn title="سجّل النهارده" icon="checkmark" onPress={() => bumpHabit(h)} />

      <SectionTitle>الخريطة الشهرية</SectionTitle>
      <Card>
        <Row>
          <IconBtn name="chevron-forward" onPress={() => shift(-1)} />
          <T w="semibold" center style={{ flex: 1 }}>
            {first.toLocaleDateString('ar', { month: 'long', year: 'numeric' })}
          </T>
          <IconBtn name="chevron-back" onPress={() => shift(1)} />
        </Row>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'].map((x) => (
            <View key={x} style={{ width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4 }}>
              <T size={11} faint>
                {x}
              </T>
            </View>
          ))}
          {cells.map((x, i) => {
            const isDone = x && done.has(x);
            const isPartial = x && !isDone && partial.has(x);
            const due = x && habitDueOn(h, x, logs);
            return (
              <View key={i} style={{ width: `${100 / 7}%`, padding: 3 }}>
                {x ? (
                  <Pressable
                    onPress={() => x <= today() && bumpHabit(h, x)}
                    style={{
                      aspectRatio: 1,
                      borderRadius: 8,
                      backgroundColor: isDone ? c.ink : isPartial ? c.primarySoft : due ? c.bg : 'transparent',
                      borderWidth: x === today() ? 1.5 : 0,
                      borderColor: c.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <T size={11} color={isDone ? c.onInk : c.sub}>
                      {parseYmd(x).getDate()}
                    </T>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      </Card>
      <Sheet visible={edit} onClose={() => setEdit(false)} title="تعديل العادة">
        <HabitEditor habit={h} onDone={() => setEdit(false)} />
      </Sheet>
    </Screen>
  );
}
