import { useState } from 'react';
import { View } from 'react-native';
import { Bar, Btn, Card, Chips, confirm, Empty, Field, IconBtn, Row, Screen, SectionTitle, T } from '@/components/ui';
import { cleanYmd, diffDays, shortLabel, today } from '@/lib/dates';
import { insert, remove, update, upsertOwn, useOwn, useQuery } from '@/lib/db';
import { useTheme } from '@/lib/theme';

/** S-10: long-term goals and countdowns (university entry, exams). */
export default function Goals() {
  const { c } = useTheme();
  const profile = useOwn('profiles');
  const goals = useQuery('goals', undefined, (a, b) => (a.target_date ?? '9999').localeCompare(b.target_date ?? '9999'));
  const exams = useQuery('subjects', (s) => !!s.exam_date && s.exam_date >= today(), (a, b) => a.exam_date.localeCompare(b.exam_date));
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [countdown, setCountdown] = useState(true);
  const [uni, setUni] = useState(profile?.university_date ?? '');

  const add = () => {
    if (!title.trim()) return;
    insert('goals', { title: title.trim(), target_date: cleanYmd(date), is_countdown: countdown, progress: 0 });
    setTitle('');
    setDate('');
  };

  return (
    <Screen back="المذاكرة" backColor={c.acc.study.fg} title="الأهداف والعدّادات">
      <Card tint={c.acc.study.bg}>
        <T w="semibold">دخول الجامعة</T>
        {profile?.university_date ? (
          <Row>
            <T size={28} w="bold" style={{ flex: 1 }}>
              {diffDays(profile.university_date, today())} يوم
            </T>
            <T sub>{shortLabel(profile.university_date)}</T>
            <IconBtn name="close" size={18} onPress={() => upsertOwn('profiles', { university_date: null })} />
          </Row>
        ) : (
          <Row>
            <View style={{ flex: 1 }}>
              <Field placeholder="تاريخ دخول الجامعة YYYY-MM-DD" value={uni} onChangeText={setUni} />
            </View>
            <Btn small title="حفظ" onPress={() => cleanYmd(uni) && upsertOwn('profiles', { university_date: cleanYmd(uni) })} />
          </Row>
        )}
      </Card>

      {exams.length > 0 && (
        <>
          <SectionTitle>الاختبارات الجاية</SectionTitle>
          {exams.map((s) => (
            <Card key={s.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }} />
              <T w="medium" style={{ flex: 1 }}>
                {s.name}
              </T>
              <T w="bold">{diffDays(s.exam_date, today())} يوم</T>
            </Card>
          ))}
        </>
      )}

      <SectionTitle>أهدافك</SectionTitle>
      <Card>
        <Field placeholder="هدف طويل المدى (Band 7 في الآيلتس…)" value={title} onChangeText={setTitle} />
        <Field placeholder="تاريخ الهدف YYYY-MM-DD (اختياري)" value={date} onChangeText={setDate} />
        <Chips value={countdown} onChange={setCountdown} options={[{ label: 'عدّاد تنازلي في اليوم', value: true as any }, { label: 'هدف بنسبة تقدّم', value: false as any }]} />
        <Btn small title="أضف" onPress={add} />
      </Card>
      {goals.length === 0 && <Empty text="مفيش أهداف لسه." mood="calm" />}
      {goals.map((g) => (
        <Card key={g.id}>
          <Row>
            <T w="semibold" style={{ flex: 1 }}>
              {g.title}
            </T>
            {g.target_date && <T sub>{diffDays(g.target_date, today())} يوم</T>}
            <IconBtn name="trash-outline" size={18} onPress={() => confirm('تحذف الهدف؟', () => remove('goals', g.id))} />
          </Row>
          <Bar value={g.progress / 100} />
          <Row>
            {[0, 25, 50, 75, 100].map((p) => (
              <Btn key={p} small kind={Number(g.progress) === p ? 'ink' : 'ghost'} title={`${p}%`} onPress={() => update('goals', g.id, { progress: p })} />
            ))}
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
