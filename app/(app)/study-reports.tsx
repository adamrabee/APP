import { ScrollView } from 'react-native';
import { Bars, Heatmap } from '@/components/charts';
import { Card, Empty, Row, Screen, SectionTitle, Stat, T } from '@/components/ui';
import { addDays, today, weekStart } from '@/lib/dates';
import { useQuery, useRows } from '@/lib/db';
import { streak } from '@/lib/logic';
import { useTheme } from '@/lib/theme';

/** S-11: hours per subject this week, heatmap of study days, neglected-subject alerts. */
export default function StudyReports() {
  const { c } = useTheme();
  const sessions = useRows('study_sessions');
  const subjects = useQuery('subjects', (s) => !s.archived);
  const ws = weekStart();
  const week = sessions.filter((s) => String(s.started_at).slice(0, 10) >= ws);
  const items = subjects.map((s) => ({
    label: s.name,
    color: s.color,
    value: week.filter((x) => x.subject_id === s.id).reduce((a, x) => a + x.minutes, 0) / 60,
    goal: Number(s.weekly_hours) || undefined,
  }));
  const byDay = new Map<string, number>();
  for (const s of sessions) {
    const d = String(s.started_at).slice(0, 10);
    byDay.set(d, (byDay.get(d) ?? 0) + s.minutes);
  }
  // 16 weeks, aligned to Saturday
  const start = addDays(weekStart(), -15 * 7);
  const dates = Array.from({ length: 16 * 7 }, (_, i) => addDays(start, i)).filter((d) => d <= today());
  const st = streak(byDay.keys());
  const neglected = subjects.filter((s) => {
    const last = sessions.filter((x) => x.subject_id === s.id).map((x) => String(x.started_at).slice(0, 10)).sort().pop();
    return !last || last < addDays(today(), -7);
  });
  const totalWeek = week.reduce((a, x) => a + x.minutes, 0);

  return (
    <Screen back title="تقارير المذاكرة">
      <Row>
        <Stat label="الأسبوع ده" value={`${Math.round(totalWeek / 6) / 10} س`} />
        <Stat label="السلسلة" value={`🔥 ${st.current}`} sub={`الأطول ${st.longest}`} />
      </Row>
      <SectionTitle>ساعات كل مادة الأسبوع ده</SectionTitle>
      <Card>{subjects.length ? <Bars items={items} unit="ساعة" /> : <Empty text="مفيش مواد." />}</Card>
      <SectionTitle>أيام المذاكرة</SectionTitle>
      <Card>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Heatmap dates={dates} values={byDay} />
        </ScrollView>
      </Card>
      {neglected.length > 0 && (
        <>
          <SectionTitle>مواد مهملة</SectionTitle>
          <Card tint={c.sec.me}>
            {neglected.map((s) => (
              <T key={s.id} color={c.danger}>
                ⚠️ {s.name} — ما ذاكرتهاش من أسبوع أو أكتر
              </T>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
