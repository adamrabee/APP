import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Btn, Card, Check, Field, ListRow, Row, Screen, Section, T, tap } from '@/components/ui';
import { bumpHabit } from '@/lib/actions';
import { timeLabel, today } from '@/lib/dates';
import { insert, remove, rows, update, upsertOwn, useNow, useOwn, useQuery, useRows } from '@/lib/db';
import { streak } from '@/lib/logic';
import { prayerName, prayerTimes, PRAYERS, useCoords, type Prayer } from '@/lib/prayer';
import { useTheme } from '@/lib/theme';

const statusCycle = { none: 'on_time', on_time: 'late', late: 'missed', missed: 'none' } as const;
const statusLabel: Record<string, string> = { on_time: 'في وقتها', late: 'متأخرة', missed: 'فاتت', none: 'لم تُسجّل' };

export default function Worship() {
  const { c } = useTheme();
  const gold = c.acc.worship;
  const d = today();
  const now = useNow();
  const coords = useCoords();
  const profile = useOwn('profiles');
  const method = profile?.prayer_method ?? 'umm_al_qura';
  const times = prayerTimes(coords, d, method);
  const logs = useRows('prayer_logs');
  const todayLogs = logs.filter((l) => l.date === d);

  // W-02: days with all five prayed
  const byDate = new Map<string, number>();
  for (const l of logs) if (l.status !== 'missed') byDate.set(l.date, (byDate.get(l.date) ?? 0) + 1);
  const s = streak(Array.from(byDate).filter(([, n]) => n >= 5).map(([x]) => x));
  const prayedToday = todayLogs.filter((l) => l.status === 'on_time' || l.status === 'late').length;

  function cycle(p: Prayer) {
    tap();
    const cur = todayLogs.find((l) => l.prayer === p);
    const next = statusCycle[(cur?.status ?? 'none') as keyof typeof statusCycle];
    if (!cur) insert('prayer_logs', { date: d, prayer: p, status: next });
    else if (next === 'none') remove('prayer_logs', cur.id);
    else update('prayer_logs', cur.id, { status: next });
  }

  // W-03 wird
  const quran = useQuery('quran_logs', (q) => q.date === d, undefined, [d])[0];
  const lastPos = useQuery('quran_logs', (q) => !!q.last_position, (a, b) => b.date.localeCompare(a.date))[0]?.last_position;
  const goal = Number(profile?.quran_daily_pages ?? 0);
  const read = Number(quran?.pages_read ?? 0);
  const [goalInput, setGoalInput] = useState('');
  const [pos, setPos] = useState('');
  const [editPos, setEditPos] = useState(false);
  const addPages = (n: number) => {
    if (quran) update('quran_logs', quran.id, { pages_read: Math.max(0, read + n) });
    else if (n > 0) insert('quran_logs', { date: d, pages_read: n, last_position: lastPos ?? null });
  };
  const savePos = () => {
    if (!pos.trim()) return setEditPos(false);
    if (quran) update('quran_logs', quran.id, { last_position: pos.trim() });
    else insert('quran_logs', { date: d, pages_read: 0, last_position: pos.trim() });
    setPos('');
    setEditPos(false);
  };

  // W-05 adhkar as ready-made habits
  const habits = useRows('habits');
  const habitLogs = useRows('habit_logs');
  const adhkar = habits.filter((h) => h.name === 'أذكار الصباح' || h.name === 'أذكار المساء');

  return (
    <Screen
      back="اليوم"
      backColor={gold.fg}
      title="العبادات"
      subtitle={`${coords.city ?? 'موقعك'} · ${method === 'umm_al_qura' ? 'أم القرى' : 'طريقة مخصصة'}`}
      right={
        <View style={{ backgroundColor: gold.bg, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center' }}>
          <T size={18} w="bold" color={gold.fg} lh={1.2}>
            {s.current}
          </T>
          <T size={11} w="medium" color={gold.fg}>
            يوم كامل
          </T>
        </View>
      }
    >
      <Section title="صلوات اليوم" note={`${prayedToday} من 5`}>
        <Card list>
          {PRAYERS.map((p, i) => {
            const st = todayLogs.find((l) => l.prayer === p)?.status ?? 'none';
            const done = st === 'on_time' || st === 'late';
            const isNext = !done && times[p] > now && PRAYERS.filter((x) => times[x] > now)[0] === p;
            return (
              <ListRow key={p} minHeight={60} last={i === PRAYERS.length - 1}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: done ? c.primary : isNext ? gold.bar : c.track }} />
                <View style={{ flex: 1 }}>
                  <T size={16} w="semibold">
                    {prayerName[p]}
                  </T>
                  <T size={12} sub>
                    {timeLabel(times[p])}
                  </T>
                </View>
                <Pressable
                  onPress={() => cycle(p)}
                  style={{
                    minHeight: 36,
                    paddingHorizontal: 14,
                    borderRadius: 999,
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: st === 'on_time' ? c.primary : st === 'late' ? gold.bar : st === 'missed' ? c.danger : c.track,
                    backgroundColor: st === 'on_time' ? c.primary : st === 'late' ? gold.bg : c.card,
                  }}
                >
                  <T size={13} w="semibold" color={st === 'on_time' ? '#FFFFFF' : st === 'late' ? gold.fg : st === 'missed' ? c.danger : c.sub2}>
                    {statusLabel[st]}
                  </T>
                </Pressable>
              </ListRow>
            );
          })}
        </Card>
      </Section>

      <Card style={{ padding: 18, gap: 14 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T size={18} w="bold">
            ورد القرآن
          </T>
          {goal > 0 && (
            <Pressable onPress={() => upsertOwn('profiles', { quran_daily_pages: null })} style={{ backgroundColor: gold.bg, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 }}>
              <T size={12} w="semibold" color={gold.fg}>
                الهدف {goal} صفحات
              </T>
            </Pressable>
          )}
        </Row>
        {goal > 0 ? (
          <>
            <Row gap={6} style={{ alignItems: 'baseline' }}>
              <T size={34} w="bold" lh={1.2}>
                {read}
              </T>
              <T size={14} sub>
                / {goal} صفحات اليوم
              </T>
            </Row>
            <View style={{ height: 10, borderRadius: 999, backgroundColor: c.line, overflow: 'hidden' }}>
              <View style={{ height: 10, borderRadius: 999, backgroundColor: gold.bar, width: `${Math.min(100, (read / goal) * 100)}%` }} />
            </View>
          </>
        ) : (
          <Row>
            <View style={{ flex: 1 }}>
              <Field placeholder="هدفك اليومي بالصفحات (مثلاً 10)" keyboardType="decimal-pad" value={goalInput} onChangeText={setGoalInput} />
            </View>
            <Btn small title="حفظ" onPress={() => Number(goalInput) > 0 && upsertOwn('profiles', { quran_daily_pages: Number(goalInput) })} />
          </Row>
        )}
        {editPos ? (
          <Row>
            <View style={{ flex: 1 }}>
              <Field autoFocus placeholder="سورة الكهف · صفحة 296" value={pos} onChangeText={setPos} onSubmitEditing={savePos} />
            </View>
            <Btn small title="حفظ" onPress={savePos} />
          </Row>
        ) : (
          <Row gap={12}>
            <T size={13} sub style={{ flex: 1 }} onPress={() => setEditPos(true)}>
              آخر موضع: {quran?.last_position ?? lastPos ?? 'اضغط وحدّد'}
            </T>
            {read > 0 && <Btn small kind="ghost" title="−" onPress={() => addPages(-1)} />}
            <Btn small title="+ صفحة" onPress={() => addPages(1)} />
          </Row>
        )}
      </Card>

      <Card onPress={() => router.push('/quran-tables')} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: gold.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="grid-outline" size={24} color={gold.fg} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T size={16} w="bold">
            جدول حفظ القرآن
          </T>
          <T size={12} sub>
            ابنِ جدول حفظك بنفسك وتابع إنجازك
          </T>
        </View>
        <Ionicons name="chevron-back" size={18} color={c.faint} />
      </Card>

      {adhkar.length === 0 ? (
        <Btn
          kind="ghost"
          icon="sparkles-outline"
          title="أضف أذكار الصباح والمساء"
          onPress={() => {
            insert('habits', { name: 'أذكار الصباح', icon: 'sunny', sort_order: rows('habits').length });
            insert('habits', { name: 'أذكار المساء', icon: 'moon', sort_order: rows('habits').length + 1 });
          }}
        />
      ) : (
        <Row>
          {adhkar.map((h) => {
            const done = habitLogs.some((l) => l.habit_id === h.id && l.date === d);
            return (
              <Pressable key={h.id} onPress={() => bumpHabit(h)} style={{ flex: 1, backgroundColor: c.card, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16, minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <T w="medium">{h.name}</T>
                <Check on={done} onPress={() => bumpHabit(h)} />
              </Pressable>
            );
          })}
        </Row>
      )}
    </Screen>
  );
}
