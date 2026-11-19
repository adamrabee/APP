import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { LineChart } from '@/components/charts';
import { Mee } from '@/components/mee';
import { Row, Screen, T } from '@/components/ui';
import { meeDown, meeSame, meeUp, sectionLabels, suggestions } from '@/lib/content';
import { addDays, parseYmd, shortLabel, weekdayShort, weekStart } from '@/lib/dates';
import { insert, rows, update, useOwn, useQuery, useRows } from '@/lib/db';
import { weekReport } from '@/lib/score';

const INK = '#F2F2EF';
const SUB = '#9BA19C';
const CARD = '#1B1E1C';

/** §4.10 weekly review with MEE — always dark (R-01…R-06). */
export default function WeeklyReview() {
  const profile = useOwn('profiles');
  // load everything the score depends on
  for (const t of ['tasks', 'work_tasks', 'habits', 'habit_logs', 'prayer_logs', 'subjects', 'study_sessions', 'skincare_steps', 'routine_logs', 'workouts', 'transactions']) useRows(t); // eslint-disable-line react-hooks/rules-of-hooks
  const history = useQuery('weekly_reviews', undefined, (a, b) => b.week_start.localeCompare(a.week_start));
  const [week, setWeek] = useState(weekStart());
  const weights = (profile?.score_weights as Record<string, number>) ?? {};
  const cur = weekReport(week, weights);
  const prev = weekReport(addDays(week, -7), weights);
  const diff = Math.round((cur.score - prev.score) * 10) / 10;

  // R-03: up or down per section (money: spending less = up)
  const table = ['study', 'prayers', 'habits', 'routine', 'gym', 'money'].map((k) => {
    const a = cur.section[k];
    const b = prev.section[k];
    let dir: 'up' | 'down' | 'same' | 'na' = 'na';
    if (a !== undefined && b !== undefined) dir = a === b ? 'same' : k === 'money' ? (a < b ? 'up' : 'down') : a > b ? 'up' : 'down';
    else if (a !== undefined) dir = 'same';
    return { k, label: sectionLabels[k] ?? k, a, dir };
  });
  const weakest = table.filter((x) => x.dir === 'down')[0]?.k ?? (Object.entries(cur.section).filter(([k]) => k in suggestions && k !== 'gym' && k !== 'money').sort((x, y) => x[1] - y[1])[0]?.[0] ?? 'tasks');
  const mood = diff > 0.2 ? 'happy' : diff < -0.2 ? 'sad' : cur.score >= 7 ? 'stars' : 'calm';
  const pool = diff > 0.2 ? meeUp : diff < -0.2 ? meeDown : meeSame;
  const message = pool[parseYmd(week).getDate() % pool.length];

  // save/refresh this week's review row
  useEffect(() => {
    if (!cur.scores.some((s) => s !== null)) return;
    const existing = rows('weekly_reviews').find((r) => r.week_start === week);
    const vals = { week_start: week, score: cur.score, section_scores: cur.section, best_day: cur.bestDay };
    if (existing) {
      if (existing.score !== cur.score || existing.best_day !== cur.bestDay) update('weekly_reviews', existing.id, vals);
    } else insert('weekly_reviews', vals);
  }, [week, cur.score, cur.bestDay]); // eslint-disable-line react-hooks/exhaustive-deps

  const bestIdx = cur.bestDay ? cur.days.indexOf(cur.bestDay) : -1;

  return (
    <Screen back title="مراجعة الأسبوع" dark>
      <Row>
        <Pressable onPress={() => setWeek(addDays(week, -7))}>
          <T color={SUB}>‹ الأسبوع اللي فات</T>
        </Pressable>
        <T w="semibold" color={INK} center style={{ flex: 1 }}>
          {shortLabel(week)} – {shortLabel(addDays(week, 6))}
        </T>
        {week < weekStart() && (
          <Pressable onPress={() => setWeek(addDays(week, 7))}>
            <T color={SUB}>الجاي ›</T>
          </Pressable>
        )}
      </Row>

      <View style={{ backgroundColor: CARD, borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Mee mood={mood} size={86} />
        <View style={{ flex: 1, gap: 2 }}>
          <T color={SUB} size={13}>
            سكور الأسبوع
          </T>
          <T color={INK} size={40} w="bold">
            {cur.score}
            <T color={SUB} size={18}>
              /10
            </T>
          </T>
          <T color={diff >= 0 ? '#8DB39A' : '#E08A76'} w="semibold">
            {diff > 0 ? `طالع ↑ ${diff}` : diff < 0 ? `نازل ↓ ${-diff}` : 'زي الأسبوع اللي فات'}
          </T>
        </View>
      </View>

      <View style={{ backgroundColor: CARD, borderRadius: 22, padding: 16, gap: 8 }}>
        <T color={INK} w="semibold">
          سكور كل يوم {cur.bestDay ? `· أحسن يوم ${weekdayShort[parseYmd(cur.bestDay).getDay()]}` : ''}
        </T>
        <LineChart dark values={cur.scores.map((s) => s ?? 0)} labels={cur.days.map((d) => weekdayShort[parseYmd(d).getDay()])} max={10} highlight={bestIdx} />
      </View>

      <View style={{ backgroundColor: CARD, borderRadius: 22, padding: 16, gap: 10 }}>
        <T color={INK} w="semibold">
          طالع ولا نازل؟
        </T>
        {table.map((r) => (
          <Row key={r.k}>
            <T color={INK} style={{ flex: 1 }}>
              {r.label}
            </T>
            <T color={SUB} size={12}>
              {r.a === undefined ? '—' : r.k === 'gym' ? `${r.a} جلسة` : r.k === 'money' ? `${r.a} ر.س` : `${r.a}%`}
            </T>
            <T w="bold" color={r.dir === 'up' ? '#8DB39A' : r.dir === 'down' ? '#E08A76' : SUB} style={{ width: 28 }} center>
              {r.dir === 'up' ? '↑' : r.dir === 'down' ? '↓' : '–'}
            </T>
          </Row>
        ))}
      </View>

      <View style={{ backgroundColor: CARD, borderRadius: 22, padding: 16, gap: 6 }}>
        <T color={INK} w="semibold">
          MEE بيقول
        </T>
        <T color={INK}>{message}</T>
        <T color={SUB} size={13}>
          اقتراح للأسبوع الجاي: {suggestions[weakest] ?? suggestions.tasks}
        </T>
      </View>

      {history.length > 1 && (
        <View style={{ backgroundColor: CARD, borderRadius: 22, padding: 16, gap: 8 }}>
          <T color={INK} w="semibold">
            الأسابيع اللي فاتت
          </T>
          {history.map((h) => (
            <Pressable key={h.id} onPress={() => setWeek(h.week_start)}>
              <Row>
                <T color={SUB} style={{ flex: 1 }}>
                  {shortLabel(h.week_start)}
                </T>
                <T color={INK} w="semibold">
                  {h.score}/10
                </T>
              </Row>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}
