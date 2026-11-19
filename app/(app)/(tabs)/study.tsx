import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SubjectEditor } from '@/components/subject-editor';
import { Card, Empty, IconBtn, ListRow, Row, Screen, Section, Sheet, T } from '@/components/ui';
import { completeReview, subjectOfReview } from '@/lib/actions';
import { addDays, diffDays, today, weekStart } from '@/lib/dates';
import { get, useQuery, useRows } from '@/lib/db';
import { streak } from '@/lib/logic';
import { useTheme } from '@/lib/theme';

export default function Study() {
  const { c } = useTheme();
  const blue = c.acc.study;
  const d = today();
  const [adding, setAdding] = useState(false);
  const [subject, setSubject] = useState<string | null>(null);
  const subjects = useQuery('subjects', (s) => !s.archived, (a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const units = useRows('subject_units');
  const sessions = useRows('study_sessions');
  const mistakes = useRows('mistakes');
  const reviews = useQuery('reviews', (r) => !r.done_at && r.due_date <= d, (a, b) => a.due_date.localeCompare(b.due_date), [d]);
  const cards = useQuery('flashcards', (f) => f.due_date <= d, undefined, [d]);
  const ws = weekStart(d);
  const day = (s: any) => String(s.started_at).slice(0, 10);
  const weekMins = (sid: string) => sessions.filter((s) => s.subject_id === sid && day(s) >= ws).reduce((a, s) => a + s.minutes, 0);
  const st = streak(sessions.map(day));
  const weekTotal = subjects.reduce((a, s) => a + weekMins(s.id), 0);
  const weekGoal = subjects.reduce((a, s) => a + (Number(s.weekly_hours) || 0), 0);
  const pick = subject ?? subjects[0]?.id ?? null;
  const tip = mistakes.filter((m) => m.subject_id === pick).sort((a, b) => a.times_seen - b.times_seen)[0];

  // 12-week heatmap (S-11)
  const start = addDays(ws, -11 * 7);
  const byDay = new Map<string, number>();
  for (const s of sessions) byDay.set(day(s), (byDay.get(day(s)) ?? 0) + s.minutes);
  const cells = Array.from({ length: 12 * 7 }, (_, i) => addDays(start, i));
  const heat = (m: number) => (!m ? c.line : m < 30 ? '#BFD2E6' : m < 90 ? '#7FA3C9' : blue.bar);
  const hours12 = Math.round(cells.reduce((a, x) => a + (byDay.get(x) ?? 0), 0) / 60);
  const neglected = subjects
    .map((s) => ({ s, last: sessions.filter((x) => x.subject_id === s.id).map(day).sort().pop() }))
    .filter((x) => !x.last || diffDays(d, x.last) >= 5)
    .map((x) => ({ name: x.s.name, days: x.last ? diffDays(d, x.last) : null }))[0];

  const dueCount = reviews.length + (cards.length ? 1 : 0);

  return (
    <Screen
      title="المذاكرة"
      right={
        <Row gap={8}>
          <View style={{ backgroundColor: blue.bg, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 }}>
            <T size={12} w="semibold" color={blue.fg}>
              {st.current} يوم متتالي
            </T>
          </View>
          <IconBtn box name="add" onPress={() => setAdding(true)} />
        </Row>
      }
    >
      <Card onPress={() => router.push('/study-schedule')} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 }}>
        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: blue.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="calendar-outline" size={22} color={blue.fg} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T size={16} w="bold">
            جدول المذاكرة
          </T>
          <T size={12} sub>
            Create a Schedule من موادك وواجباتك
          </T>
        </View>
        <Ionicons name="chevron-back" size={18} color={c.faint} />
      </Card>

      {/* focus timer card */}
      <View style={{ backgroundColor: '#1F2421', borderRadius: 24, padding: 18, gap: 12 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T size={12} color="#C9CFC9">
            المادة
          </T>
          <T size={12} color="#C9CFC9">
            25 / 5 د
          </T>
        </Row>
        {subjects.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {subjects.map((s) => (
              <Pressable key={s.id} onPress={() => setSubject(s.id)} style={{ borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: pick === s.id ? '#F6F5F1' : '#343A36' }}>
                <T size={13} color={pick === s.id ? '#1F2421' : '#F6F5F1'}>
                  {s.name}
                </T>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <T size={13} color="#C9CFC9">
            ضيف مادة عشان الجلسة تتسجل عليها.
          </T>
        )}
        <Row gap={12} style={{ justifyContent: 'space-between' }}>
          <T size={52} w="bold" color="#F6F5F1" lh={1.1} style={{ letterSpacing: 1 }}>
            25:00
          </T>
          <Row gap={8}>
            <Pressable onPress={() => router.push({ pathname: '/focus', params: pick ? { subject: pick } : {} })} style={{ width: 48, height: 48, borderRadius: 14, borderWidth: 1, borderColor: '#4A514C', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="options-outline" size={20} color="#F6F5F1" />
            </Pressable>
            <Pressable onPress={() => router.push({ pathname: '/focus', params: { ...(pick ? { subject: pick } : {}), start: '1' } })} style={{ height: 48, borderRadius: 14, backgroundColor: '#A9C0B1', paddingHorizontal: 22, justifyContent: 'center' }}>
              <T size={15} w="bold" color="#1F2421">
                ابدأ
              </T>
            </Pressable>
          </Row>
        </Row>
        {tip && (
          <View style={{ backgroundColor: '#2A302C', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 }}>
            <T size={12} color="#C9CFC9">
              من بنك الأخطاء: {tip.text}
            </T>
          </View>
        )}
      </View>

      <Section title="مراجعات اليوم" note={`${dueCount} مستحقة`}>
        <Card list>
          {dueCount === 0 && <Empty text="مفيش مراجعات مستحقة النهارده." mood="happy" />}
          {reviews.map((r, i) => {
            const { unit, subject: sub } = subjectOfReview(r);
            return (
              <ListRow key={r.id} minHeight={62} last={i === reviews.length - 1 && !cards.length}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: sub?.color ?? blue.bar }} />
                <View style={{ flex: 1 }}>
                  <T w="semibold">{unit?.title ?? 'جزء'}</T>
                  <T size={12} sub>
                    {sub?.name} · مراجعة اليوم {r.step}
                    {r.due_date < d ? ' · متأخرة' : ''}
                  </T>
                </View>
                <SmallAction label="تم" onPress={() => completeReview(r)} />
              </ListRow>
            );
          })}
          {cards.length > 0 && (
            <ListRow minHeight={62} last>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: blue.bar }} />
              <View style={{ flex: 1 }}>
                <T w="semibold">بطاقات المراجعة</T>
                <T size={12} sub>
                  {Array.from(new Set(cards.map((x) => get('subjects', x.subject_id)?.name).filter(Boolean))).join('، ')} · {cards.length} بطاقة
                </T>
              </View>
              <SmallAction label="ابدأ" onPress={() => router.push('/flashcards')} />
            </ListRow>
          )}
        </Card>
      </Section>

      <Section title="المواد" note={weekGoal ? `هذا الأسبوع ${Math.round(weekTotal / 60)} / ${weekGoal} ساعة` : undefined}>
        {subjects.length === 0 && (
          <Card>
            <Empty text="مفيش مواد جاهزة — ضيف أول مادة (آيلتس، مادة جامعة، كورس…)." mood="calm" />
          </Card>
        )}
        {subjects.map((s) => {
          const su = units.filter((u) => u.subject_id === s.id);
          const pct = su.length ? Math.round((su.filter((u) => u.status === 'done').length / su.length) * 100) : 0;
          const mins = weekMins(s.id);
          const examIn = s.exam_date ? diffDays(s.exam_date, d) : null;
          const weekPct = s.weekly_hours ? Math.min(1, mins / 60 / s.weekly_hours) : 0;
          return (
            <Card key={s.id} onPress={() => router.push({ pathname: '/subject/[id]', params: { id: s.id } })} style={{ paddingVertical: 14 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Row gap={8}>
                  <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: s.color }} />
                  <T size={16} w="semibold">
                    {s.name}
                  </T>
                </Row>
                <T size={12} w="medium" color={examIn !== null && examIn >= 0 ? c.acc.worship.fg : c.sub}>
                  {examIn !== null && examIn >= 0 ? `بعد ${examIn} يوم` : 'الاختبار: حدّد الموعد'}
                </T>
              </Row>
              <Row style={{ justifyContent: 'space-between' }}>
                <T size={12} sub>
                  الإنجاز {pct}%
                </T>
                <T size={12} sub>
                  {Math.round((mins / 60) * 10) / 10}
                  {s.weekly_hours ? ` / ${s.weekly_hours}` : ''} ساعات هذا الأسبوع
                </T>
              </Row>
              <View style={{ height: 8, borderRadius: 999, backgroundColor: c.line, overflow: 'hidden' }}>
                <View style={{ height: 8, borderRadius: 999, backgroundColor: s.color, width: `${(s.weekly_hours ? weekPct : pct / 100) * 100}%` }} />
              </View>
            </Card>
          );
        })}
      </Section>

      <Card onPress={() => router.push('/study-reports')} style={{ gap: 12 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T size={16} w="bold">
            آخر 12 أسبوع
          </T>
          <T size={12} sub>
            {hours12} ساعة
          </T>
        </Row>
        <View style={{ flexDirection: 'row', gap: 4, direction: 'ltr' }}>
          {Array.from({ length: 12 }, (_, w) => (
            <View key={w} style={{ flex: 1, gap: 4 }}>
              {cells.slice(w * 7, w * 7 + 7).map((x) => (
                <View key={x} style={{ height: 14, borderRadius: 4, backgroundColor: x > d ? 'transparent' : heat(byDay.get(x) ?? 0) }} />
              ))}
            </View>
          ))}
        </View>
        <Row gap={6}>
          <T size={11} sub>
            أقل
          </T>
          {[c.line, '#BFD2E6', '#7FA3C9', blue.bar].map((col) => (
            <View key={col} style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: col }} />
          ))}
          <T size={11} sub>
            أكثر
          </T>
          <View style={{ flex: 1 }} />
          {neglected && (
            <T size={11} w="medium" color={c.acc.health.fg}>
              {neglected.name}: {neglected.days === null ? 'لسه ما بدأتش' : `بقالها ${neglected.days} أيام`}
            </T>
          )}
        </Row>
      </Card>

      <Row>
        <ToolTile icon="albums-outline" label="البطاقات" onPress={() => router.push('/flashcards')} />
        <ToolTile icon="time-outline" label="المخطط" onPress={() => router.push('/study-planner')} />
        <ToolTile icon="flag-outline" label="الأهداف" onPress={() => router.push('/goals')} />
      </Row>

      <Sheet visible={adding} onClose={() => setAdding(false)} title="مادة جديدة">
        <SubjectEditor onDone={() => setAdding(false)} />
      </Sheet>
    </Screen>
  );
}

function SmallAction({ label, onPress }: { label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ minHeight: 36, paddingHorizontal: 14, borderRadius: 12, backgroundColor: c.acc.study.bg, justifyContent: 'center' }}>
      <T size={13} w="semibold" color={c.acc.study.dark}>
        {label}
      </T>
    </Pressable>
  );
}

function ToolTile({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ flex: 1, backgroundColor: c.card, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 12, gap: 8, minHeight: 88 }}>
      <Ionicons name={icon} size={22} color={c.text} />
      <T size={13} w="semibold">
        {label}
      </T>
    </Pressable>
  );
}
