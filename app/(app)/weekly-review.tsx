import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { LineChart } from '@/components/charts';
import { MeeArt } from '@/components/mee';
import { Row, Screen, T } from '@/components/ui';
import { meeDown, meeSame, meeUp, sectionLabels, suggestions } from '@/lib/content';
import { addDays, parseYmd, shortLabel, weekdayShort, weekStart } from '@/lib/dates';
import { insert, rows, update, useOwn, useQuery, useRows } from '@/lib/db';
import { weekReport } from '@/lib/score';
import { useTheme } from '@/lib/theme';

const TABLES = ['tasks', 'work_tasks', 'habits', 'habit_logs', 'prayer_logs', 'subjects', 'study_sessions', 'skincare_steps', 'routine_logs', 'workouts', 'transactions'];

/** §4.10 weekly review with MEE — follows the app theme (design). */
export default function WeeklyReview() {
  const { c } = useTheme();
  const profile = useOwn('profiles');
  for (const t of TABLES) useRows(t); // eslint-disable-line react-hooks/rules-of-hooks
  const prayers = useRows('prayer_logs');
  const sessions = useRows('study_sessions');
  const [week, setWeek] = useState(weekStart());
  const weights = (profile?.score_weights as Record<string, number>) ?? {};
  const cur = weekReport(week, weights);
  const prev = weekReport(addDays(week, -7), weights);
  const diff = Math.round((cur.score - prev.score) * 10) / 10;
  const end = addDays(week, 7);
  const inWeek = (d: string) => d >= week && d < end;
  const studyMins = sessions.filter((s) => inWeek(String(s.started_at).slice(0, 10))).reduce((a, s) => a + s.minutes, 0);
  const prevStudy = sessions.filter((s) => String(s.started_at).slice(0, 10) >= addDays(week, -7) && String(s.started_at).slice(0, 10) < week).reduce((a, s) => a + s.minutes, 0);
  const onTime = prayers.filter((p) => inWeek(p.date) && p.status === 'on_time').length;

  // R-03 up or down (money: spending less = up)
  const table = ['study', 'prayers', 'habits', 'routine', 'gym', 'money'].map((k) => {
    const a = cur.section[k];
    const b = prev.section[k];
    let dir: 'up' | 'down' | 'same' = 'same';
    if (a !== undefined && b !== undefined && a !== b) dir = k === 'money' ? (a < b ? 'up' : 'down') : a > b ? 'up' : 'down';
    const value = a === undefined ? '—' : k === 'study' ? `${Math.round((studyMins / 60) * 10) / 10} س` : k === 'prayers' ? `${onTime} / 35` : k === 'gym' ? `${a} جلسة` : k === 'money' ? `${a} ر.س` : `${a}%`;
    return { k, label: k === 'prayers' ? 'الصلاة في وقتها' : sectionLabels[k] ?? k, value, dir };
  });
  const weakest = table.find((x) => x.dir === 'down')?.k ?? 'study';
  const pool = diff > 0.2 ? meeUp : diff < -0.2 ? meeDown : meeSame;
  const message = pool[parseYmd(week).getDate() % pool.length];
  const studyDiff = Math.round(((studyMins - prevStudy) / 60) * 10) / 10;
  const detail = studyDiff ? ` المذاكرة ${studyDiff > 0 ? 'زادت' : 'قلّت'} ${Math.abs(studyDiff)} ساعة.` : '';

  useEffect(() => {
    if (!cur.scores.some((s) => s !== null)) return;
    const existing = rows('weekly_reviews').find((r) => r.week_start === week);
    const vals = { week_start: week, score: cur.score, section_scores: cur.section, best_day: cur.bestDay };
    if (existing) {
      if (existing.score !== cur.score || existing.best_day !== cur.bestDay) update('weekly_reviews', existing.id, vals);
    } else insert('weekly_reviews', vals);
  }, [week, cur.score, cur.bestDay]); // eslint-disable-line react-hooks/exhaustive-deps

  const history = useQuery('weekly_reviews', (r) => r.week_start < weekStart(), (a, b) => b.week_start.localeCompare(a.week_start));
  const bestIdx = cur.bestDay ? cur.days.indexOf(cur.bestDay) : -1;
  const isThis = week === weekStart();

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 }}>
          <Ionicons name="chevron-forward" size={18} color={c.text} />
          <T size={14} w="medium">
            اليوم
          </T>
        </Pressable>
        <View style={{ flexDirection: 'row', backgroundColor: c.card, borderRadius: 999, padding: 3 }}>
          {(
            [
              [weekStart(), 'الأسبوع ده'],
              [addDays(weekStart(), -7), 'اللي فات'],
            ] as const
          ).map(([w, label]) => (
            <Pressable key={w} onPress={() => setWeek(w)} style={{ minHeight: 36, paddingHorizontal: 14, borderRadius: 999, justifyContent: 'center', backgroundColor: week === w ? c.bg : 'transparent' }}>
              <T size={13} w="semibold" color={week === w ? c.text : c.sub2}>
                {label}
              </T>
            </Pressable>
          ))}
        </View>
      </Row>

      <View style={{ backgroundColor: c.card, borderRadius: 28, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <T size={15} color={c.sub2}>
            {shortLabel(week)} – {shortLabel(addDays(week, 6))}
          </T>
          <T size={72} w="light" lh={1} style={{ letterSpacing: -1 }}>
            {cur.score}
          </T>
          <T size={15} w="semibold" color={diff >= 0 ? c.primary : c.danger}>
            {diff > 0 ? `طالع ↑ ${diff}` : diff < 0 ? `نازل ↓ ${-diff}` : 'زي الأسبوع اللي فات'}
          </T>
          <T size={12} sub>
            من 10 · {isThis ? 'لحد النهارده' : 'الأسبوع كامل'}
          </T>
        </View>
        <View style={{ width: 128, alignItems: 'center', gap: 8 }}>
          <MeeArt size={128} />
          <T size={11} w="semibold" sub style={{ letterSpacing: 1 }}>
            MEE
          </T>
        </View>
      </View>

      <View style={{ backgroundColor: c.primarySoft, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 16 }}>
        <T size={14} w="medium" lh={1.6}>
          {message}
          {detail}
        </T>
      </View>

      <View style={{ backgroundColor: c.card, borderRadius: 28, paddingTop: 18, paddingHorizontal: 16, paddingBottom: 12, gap: 12 }}>
        <Row gap={8}>
          <MiniStat label="مذاكرة" value={`${Math.floor(studyMins / 60)}س ${studyMins % 60}د`} />
          <MiniStat label="صلاة في وقتها" value={`${onTime} / 35`} />
          <MiniStat label="أحسن يوم" value={cur.bestDay ? weekdayShort[parseYmd(cur.bestDay).getDay()] : '—'} />
        </Row>
        <LineChart values={cur.scores.map((s) => s ?? 0)} labels={cur.days.map((d) => weekdayShort[parseYmd(d).getDay()])} max={10} highlight={bestIdx} color={c.primary} />
      </View>

      <View style={{ backgroundColor: c.card, borderRadius: 28, paddingVertical: 6, paddingHorizontal: 18 }}>
        <T size={13} w="semibold" sub style={{ marginTop: 12, marginBottom: 4 }}>
          طالع ولا نازل؟
        </T>
        {table.map((r, i) => (
          <Row key={r.k} style={{ minHeight: 52, borderBottomWidth: i === table.length - 1 ? 0 : 1, borderBottomColor: c.line }}>
            <T w="medium" style={{ flex: 1 }}>
              {r.label}
            </T>
            <T size={14} color={c.sub2}>
              {r.value}
            </T>
            <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: r.dir === 'up' ? c.primarySoft : r.dir === 'down' ? c.acc.health.bg : c.line }}>
              <T size={13} w="bold" color={r.dir === 'up' ? c.primaryDark : r.dir === 'down' ? c.acc.health.fg : c.sub}>
                {r.dir === 'up' ? '↑' : r.dir === 'down' ? '↓' : '–'}
              </T>
            </View>
          </Row>
        ))}
        <View style={{ height: 8 }} />
      </View>

      <View style={{ backgroundColor: c.card, borderRadius: 28, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <T size={15} w="semibold">
            خطة الأسبوع الجاي
          </T>
          <T size={12} sub lh={1.6}>
            MEE بيقترح: {suggestions[weakest] ?? suggestions.tasks}
          </T>
        </View>
        <Pressable onPress={() => router.push(weakest === 'study' ? '/study' : weakest === 'prayers' ? '/worship' : weakest === 'routine' ? '/skincare' : '/tasks')} style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={22} color={c.onInk} />
        </Pressable>
      </View>

      {history.length > 0 && (
        <View style={{ backgroundColor: c.card, borderRadius: 28, paddingVertical: 6, paddingHorizontal: 18 }}>
          <T size={13} w="semibold" sub style={{ marginTop: 12, marginBottom: 4 }}>
            الأسابيع اللي فاتت
          </T>
          {history.map((h, i) => (
            <Pressable key={h.id} onPress={() => setWeek(h.week_start)} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, borderBottomWidth: i === history.length - 1 ? 0 : 1, borderBottomColor: c.line }}>
              <T style={{ flex: 1 }}>{shortLabel(h.week_start)}</T>
              <T w="semibold">{h.score} / 10</T>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <T size={11} w="semibold" sub>
        {label}
      </T>
      <T size={20} w="medium">
        {value}
      </T>
    </View>
  );
}
