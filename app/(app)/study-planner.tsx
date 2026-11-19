import { useTheme } from '@/lib/theme';
import { useState } from 'react';
import { View } from 'react-native';
import { Btn, Card, Chips, Empty, Field, IconBtn, Row, Screen, SectionTitle, T } from '@/components/ui';
import { diffDays, hhmm, minutesOf, today, weekdayNames } from '@/lib/dates';
import { insert, remove, useQuery, useRows } from '@/lib/db';

/**
 * S-04: set available weekly time slots; the app spreads subjects over them
 * by weekly hour goal, weighted up as the exam gets closer.
 */
export default function StudyPlanner() {
  const { c } = useTheme();
  const slots = useQuery('study_slots', undefined, (a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time));
  const subjects = useQuery('subjects', (s) => !s.archived);
  useRows('study_sessions');
  const [day, setDay] = useState(6);
  const [from, setFrom] = useState('17:00');
  const [to, setTo] = useState('19:00');

  const add = () => {
    if (!/^\d{1,2}:\d{2}$/.test(from) || !/^\d{1,2}:\d{2}$/.test(to) || minutesOf(to) <= minutesOf(from)) return;
    insert('study_slots', { weekday: day, start_time: from, end_time: to });
  };

  // Distribute: each subject's demand = weekly_hours × urgency (exam within 30 days boosts up to 2×)
  const demand = subjects.map((s) => {
    const days = s.exam_date ? diffDays(s.exam_date, today()) : null;
    const urgency = days !== null && days >= 0 && days <= 30 ? 1 + (30 - days) / 30 : 1;
    return { s, need: Math.max(0.5, Number(s.weekly_hours) || 1) * urgency * 60 };
  });
  const remaining = new Map(demand.map((x) => [x.s.id, x.need]));
  const plan = slots.map((slot) => {
    let t = minutesOf(slot.start_time);
    const end = minutesOf(slot.end_time);
    const blocks: { name: string; color: string; from: string; to: string }[] = [];
    while (end - t >= 25 && demand.length) {
      const pick = demand.slice().sort((a, b) => (remaining.get(b.s.id) ?? 0) - (remaining.get(a.s.id) ?? 0))[0];
      const len = Math.min(end - t, 60, Math.max(25, Math.round(remaining.get(pick.s.id) ?? 60)));
      blocks.push({ name: pick.s.name, color: pick.s.color, from: hhmm(t), to: hhmm(t + len) });
      remaining.set(pick.s.id, (remaining.get(pick.s.id) ?? 0) - len);
      t += len;
    }
    return { slot, blocks };
  });
  const totalMins = slots.reduce((a, s) => a + minutesOf(s.end_time) - minutesOf(s.start_time), 0);
  const goalMins = subjects.reduce((a, s) => a + (Number(s.weekly_hours) || 0) * 60, 0);

  return (
    <Screen back="المذاكرة" backColor={c.acc.study.fg} title="المخطط الأسبوعي">
      <Card>
        <T w="semibold">أوقاتك المتاحة</T>
        <Chips value={day} onChange={setDay} options={weekdayNames.map((label, value) => ({ label, value })).sort((a, b) => ((a.value + 1) % 7) - ((b.value + 1) % 7))} />
        <Row>
          <View style={{ flex: 1 }}>
            <Field label="من" value={from} onChangeText={setFrom} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="إلى" value={to} onChangeText={setTo} />
          </View>
        </Row>
        <Btn small title="أضف الوقت" onPress={add} />
        <T size={12} sub>
          متاح {Math.round(totalMins / 6) / 10} ساعة · أهداف المواد {Math.round(goalMins / 6) / 10} ساعة
          {goalMins > totalMins ? ' — الوقت أقل من الأهداف' : ''}
        </T>
      </Card>

      <SectionTitle>التوزيع المقترح</SectionTitle>
      {slots.length === 0 && <Empty text="حدد أوقاتك المتاحة والتطبيق يوزّع المواد." mood="calm" />}
      {plan.map(({ slot, blocks }) => (
        <Card key={slot.id} style={{ gap: 6 }}>
          <Row>
            <T w="bold" style={{ flex: 1 }}>
              {weekdayNames[slot.weekday]} · {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}
            </T>
            <IconBtn name="trash-outline" size={18} onPress={() => remove('study_slots', slot.id)} />
          </Row>
          {blocks.length === 0 && <T sub>ضيف مواد عشان تتوزع هنا.</T>}
          {blocks.map((b, i) => (
            <Row key={i}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: b.color }} />
              <T size={13} style={{ flex: 1 }}>
                {b.name}
              </T>
              <T size={12} sub>
                {b.from}–{b.to}
              </T>
            </Row>
          ))}
        </Card>
      ))}
    </Screen>
  );
}
