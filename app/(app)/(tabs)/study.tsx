import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { SubjectEditor } from '@/components/subject-editor';
import { Bar, Btn, Card, Check, Empty, ListItem, Row, Screen, SectionTitle, Sheet, Stat, T } from '@/components/ui';
import { completeReview, subjectOfReview } from '@/lib/actions';
import { diffDays, today, weekStart } from '@/lib/dates';
import { useQuery, useRows } from '@/lib/db';
import { streak } from '@/lib/logic';
import { useTheme } from '@/lib/theme';

export default function Study() {
  const { c } = useTheme();
  const d = today();
  const [adding, setAdding] = useState(false);
  const subjects = useQuery('subjects', (s) => !s.archived, (a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const units = useRows('subject_units');
  const sessions = useRows('study_sessions');
  const reviews = useQuery('reviews', (r) => !r.done_at && r.due_date <= d, (a, b) => a.due_date.localeCompare(b.due_date), [d]);
  const cards = useQuery('flashcards', (f) => f.due_date <= d, undefined, [d]);
  const ws = weekStart(d);
  const weekMins = (sid: string) => sessions.filter((s) => s.subject_id === sid && String(s.started_at).slice(0, 10) >= ws).reduce((a, s) => a + s.minutes, 0);
  const st = streak(sessions.map((s) => String(s.started_at).slice(0, 10)));
  const todayMins = sessions.filter((s) => String(s.started_at).slice(0, 10) === d).reduce((a, s) => a + s.minutes, 0);

  return (
    <Screen title="المذاكرة" right={<Btn small kind="soft" icon="add" title="مادة" onPress={() => setAdding(true)} />}>
      <Card onPress={() => router.push('/focus')} tint={c.ink} style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="timer-outline" size={28} color={c.onInk} />
        <View style={{ flex: 1 }}>
          <T w="bold" color={c.onInk}>
            ابدأ جلسة تركيز
          </T>
          <T size={12} color={c.onInk} style={{ opacity: 0.7 }}>
            بومودورو · النهارده {todayMins} دقيقة
          </T>
        </View>
        <T w="bold" color={c.onInk}>
          🔥 {st.current}
        </T>
      </Card>

      <SectionTitle>مراجعات اليوم</SectionTitle>
      <Card style={{ gap: 2 }}>
        {reviews.length === 0 && cards.length === 0 && <Empty text="مفيش مراجعات مستحقة النهارده." mood="happy" />}
        {reviews.map((r) => {
          const { unit, subject } = subjectOfReview(r);
          return (
            <Row key={r.id} style={{ paddingVertical: 8 }}>
              <Check on={false} onPress={() => completeReview(r)} />
              <View style={{ flex: 1 }}>
                <T w="medium">{unit?.title ?? 'جزء'}</T>
                <T size={12} sub>
                  {subject?.name} · مراجعة بعد {r.step} يوم{r.due_date < d ? ' · متأخرة' : ''}
                </T>
              </View>
            </Row>
          );
        })}
        {cards.length > 0 && <Btn kind="soft" icon="albums-outline" title={`راجع ${cards.length} بطاقة`} onPress={() => router.push('/flashcards')} />}
      </Card>

      <SectionTitle>المواد</SectionTitle>
      {subjects.length === 0 && (
        <Card>
          <Empty text="مفيش مواد جاهزة — ضيف أول مادة (آيلتس، مادة جامعة، كورس…)." mood="calm" />
        </Card>
      )}
      {subjects.map((s) => {
        const su = units.filter((u) => u.subject_id === s.id);
        const done = su.filter((u) => u.status === 'done').length;
        const mins = weekMins(s.id);
        const examIn = s.exam_date ? diffDays(s.exam_date, d) : null;
        return (
          <Pressable key={s.id} onPress={() => router.push({ pathname: '/subject/[id]', params: { id: s.id } })}>
            <Card style={{ borderRightWidth: 5, borderRightColor: s.color }}>
              <Row>
                <T w="bold" style={{ flex: 1 }}>
                  {s.name}
                </T>
                {examIn !== null && examIn >= 0 && <T size={12} color={examIn <= 7 ? c.danger : c.sub}>الاختبار بعد {examIn} يوم</T>}
              </Row>
              <Bar value={su.length ? done / su.length : 0} color={s.color} />
              <Row>
                <T size={12} sub style={{ flex: 1 }}>
                  {su.length ? `${done}/${su.length} جزء خلص` : 'ضيف الأجزاء'}
                </T>
                <T size={12} sub>
                  {Math.round((mins / 60) * 10) / 10}
                  {s.weekly_hours ? ` / ${s.weekly_hours}` : ''} ساعة الأسبوع ده
                </T>
              </Row>
            </Card>
          </Pressable>
        );
      })}

      <SectionTitle>أدوات</SectionTitle>
      <Card style={{ gap: 0 }}>
        <ListItem icon="calendar-outline" title="جدول المذاكرة" subtitle="Create a Schedule من واجباتك" onPress={() => router.push('/study-schedule')} />
        <ListItem icon="time-outline" title="المخطط الأسبوعي" subtitle="أوقاتك المتاحة وتوزيع المواد" onPress={() => router.push('/study-planner')} />
        <ListItem icon="albums-outline" title="البطاقات" subtitle={`${cards.length} مستحقة`} onPress={() => router.push('/flashcards')} />
        <ListItem icon="bar-chart-outline" title="التقارير" subtitle="ساعات كل مادة والخريطة الحرارية" onPress={() => router.push('/study-reports')} />
        <ListItem icon="flag-outline" title="الأهداف والعدّادات" subtitle="دخول الجامعة ومواعيد الاختبارات" onPress={() => router.push('/goals')} />
      </Card>
      <Row>
        <Stat label="سلسلة المذاكرة" value={`🔥 ${st.current}`} sub={`الأطول ${st.longest}`} />
        <Stat label="النهارده" value={`${todayMins} د`} />
      </Row>

      <Sheet visible={adding} onClose={() => setAdding(false)} title="مادة جديدة">
        <SubjectEditor onDone={() => setAdding(false)} />
      </Sheet>
    </Screen>
  );
}
