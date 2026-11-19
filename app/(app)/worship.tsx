import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Btn, Card, Field, Row, Screen, SectionTitle, Stat, T, tap } from '@/components/ui';
import { bumpHabit } from '@/lib/actions';
import { timeLabel, today } from '@/lib/dates';
import { insert, remove, rows, update, upsertOwn, useNow, useOwn, useQuery, useRows } from '@/lib/db';
import { streak } from '@/lib/logic';
import { nextPrayer, prayerName, prayerTimes, PRAYERS, useCoords, type Prayer } from '@/lib/prayer';
import { useTheme } from '@/lib/theme';

const statusCycle = { none: 'on_time', on_time: 'late', late: 'missed', missed: 'none' } as const;
const statusLabel: Record<string, string> = { on_time: 'في وقتها', late: 'متأخرة', missed: 'لم تُسجّل', none: '—' };

export default function Worship() {
  const { c } = useTheme();
  const d = today();
  const now = useNow();
  const coords = useCoords();
  const profile = useOwn('profiles');
  const method = profile?.prayer_method ?? 'umm_al_qura';
  const times = prayerTimes(coords, d, method);
  const np = nextPrayer(coords, now, method);
  const logs = useRows('prayer_logs');
  const todayLogs = logs.filter((l) => l.date === d);

  // W-02: streak of days where all five were prayed (on time or late)
  const byDate = new Map<string, number>();
  for (const l of logs) if (l.status !== 'missed') byDate.set(l.date, (byDate.get(l.date) ?? 0) + 1);
  const fullDays = Array.from(byDate).filter(([, n]) => n >= 5).map(([x]) => x);
  const s = streak(fullDays);

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
  const [pages, setPages] = useState('');
  const [pos, setPos] = useState('');
  const [goalInput, setGoalInput] = useState('');
  const wirdDays = useQuery('quran_logs', (q) => goal > 0 && q.pages_read >= goal).map((q) => q.date);
  const ws = streak(wirdDays);

  function addPages(n: number) {
    if (!n) return;
    if (quran) update('quran_logs', quran.id, { pages_read: Number(quran.pages_read) + n, last_position: pos.trim() || quran.last_position });
    else insert('quran_logs', { date: d, pages_read: n, last_position: pos.trim() || lastPos || null });
    setPages('');
    setPos('');
  }

  // W-05 adhkar as ready-made habits
  const habits = useRows('habits');
  const habitLogs = useRows('habit_logs');
  const adhkar = habits.filter((h) => h.name === 'أذكار الصباح' || h.name === 'أذكار المساء');

  return (
    <Screen back title="العبادات">
      <Card tint={c.sec.worship}>
        <Row>
          <View style={{ flex: 1 }}>
            <T size={13} sub>
              {coords.city ?? 'موقعك'} · أم القرى
            </T>
            <T size={18} w="bold">
              {prayerName[np.prayer]} {timeLabel(np.at)}
            </T>
          </View>
          <Stat label="سلسلة الخمس" value={`🔥 ${s.current}`} />
        </Row>
      </Card>

      <SectionTitle>صلوات اليوم</SectionTitle>
      <Card style={{ gap: 0 }}>
        {PRAYERS.map((p) => {
          const st = todayLogs.find((l) => l.prayer === p)?.status ?? 'none';
          const past = times[p] <= now;
          return (
            <Pressable key={p} onPress={() => cycle(p)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: st === 'on_time' ? c.ink : st === 'late' ? c.primarySoft : 'transparent',
                  borderWidth: st === 'none' || st === 'missed' ? 1.5 : 0,
                  borderColor: st === 'missed' ? c.danger : c.faint,
                }}
              >
                {st === 'on_time' && <Ionicons name="checkmark" size={16} color={c.onInk} />}
                {st === 'late' && <Ionicons name="time-outline" size={15} color={c.primary} />}
                {st === 'missed' && <Ionicons name="close" size={15} color={c.danger} />}
              </View>
              <T w="semibold" style={{ flex: 1 }}>
                {prayerName[p]}
              </T>
              <T size={13} sub>
                {statusLabel[st]}
              </T>
              <T size={13} w="medium" color={past ? c.faint : c.text}>
                {timeLabel(times[p])}
              </T>
            </Pressable>
          );
        })}
        <T size={11} faint>
          اضغط على الصلاة: في وقتها ← متأخرة ← لم تُسجّل
        </T>
      </Card>

      <SectionTitle>ورد القرآن</SectionTitle>
      <Card>
        {goal > 0 ? (
          <Row>
            <View style={{ flex: 1 }}>
              <T w="bold" size={18}>
                {Number(quran?.pages_read ?? 0)} / {goal} صفحة
              </T>
              <T size={12} sub>
                آخر موضع: {quran?.last_position ?? lastPos ?? '—'} · 🔥 {ws.current} يوم
              </T>
            </View>
            <Btn small kind="soft" title="+1" onPress={() => addPages(1)} />
            <Btn small kind="soft" title="+5" onPress={() => addPages(5)} />
          </Row>
        ) : (
          <Row>
            <View style={{ flex: 1 }}>
              <Field placeholder="هدفك اليومي بالصفحات (مثلاً 4)" keyboardType="decimal-pad" value={goalInput} onChangeText={setGoalInput} />
            </View>
            <Btn small title="حفظ" onPress={() => Number(goalInput) > 0 && upsertOwn('profiles', { quran_daily_pages: Number(goalInput) })} />
          </Row>
        )}
        <Row>
          <View style={{ flex: 1 }}>
            <Field placeholder="صفحات" keyboardType="decimal-pad" value={pages} onChangeText={setPages} />
          </View>
          <View style={{ flex: 2 }}>
            <Field placeholder="وصلت فين؟ (سورة/صفحة)" value={pos} onChangeText={setPos} />
          </View>
          <Btn small title="سجّل" onPress={() => addPages(Number(pages) || 0)} />
        </Row>
        {goal > 0 && (
          <T size={12} faint onPress={() => upsertOwn('profiles', { quran_daily_pages: null })}>
            تغيير الهدف
          </T>
        )}
      </Card>

      <Card onPress={() => router.push('/quran-tables')} style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="grid-outline" size={24} color={c.text} />
        <View style={{ flex: 1 }}>
          <T w="semibold">جدول حفظ القرآن</T>
          <T size={12} sub>
            ابنِ جدول الحفظ بنفسك: أيام، أعمدة، خانات
          </T>
        </View>
        <Ionicons name="chevron-back" size={18} color={c.faint} />
      </Card>

      <SectionTitle>الأذكار</SectionTitle>
      {adhkar.length === 0 ? (
        <Btn
          kind="soft"
          icon="sparkles-outline"
          title="أضف أذكار الصباح والمساء كعادات"
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
              <Card key={h.id} onPress={() => bumpHabit(h)} tint={done ? c.ink : c.card} style={{ flex: 1, alignItems: 'center' }}>
                <Ionicons name={h.icon} size={22} color={done ? c.onInk : c.text} />
                <T w="semibold" color={done ? c.onInk : c.text}>
                  {h.name}
                </T>
              </Card>
            );
          })}
        </Row>
      )}
    </Screen>
  );
}
