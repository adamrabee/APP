import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Btn, Field, T } from '@/components/ui';
import { cleanYmd } from '@/lib/dates';
import { insert, update, type Row } from '@/lib/db';
import { useTheme } from '@/lib/theme';

export const SUBJECT_COLORS = ['#5E7F6A', '#6C7FA6', '#A67C6C', '#8A6CA6', '#C09A4B', '#4F8E92', '#B05A6E', '#6B6B6B'];

/** S-01 / SP-01: subject with a color, weekly hour goal and optional exam date. */
export function SubjectEditor({ subject, onDone }: { subject?: Row; onDone: () => void }) {
  const { c } = useTheme();
  const [name, setName] = useState(subject?.name ?? '');
  const [color, setColor] = useState(subject?.color ?? SUBJECT_COLORS[0]);
  const [hours, setHours] = useState(String(subject?.weekly_hours ?? ''));
  const [exam, setExam] = useState(subject?.exam_date ?? '');
  const save = () => {
    if (!name.trim()) return;
    const v = { name: name.trim(), color, weekly_hours: Number(hours) || 0, exam_date: cleanYmd(exam) };
    if (subject) update('subjects', subject.id, v);
    else insert('subjects', v);
    onDone();
  };
  return (
    <View style={{ gap: 12 }}>
      <Field label="اسم المادة" value={name} onChangeText={setName} placeholder="IELTS Writing، كيمياء…" />
      <T size={13} sub>
        اللون
      </T>
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        {SUBJECT_COLORS.map((col) => (
          <Pressable key={col} onPress={() => setColor(col)} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: col, borderWidth: color === col ? 3 : 0, borderColor: c.ink }} />
        ))}
      </View>
      <Field label="الهدف الأسبوعي (ساعات)" keyboardType="decimal-pad" value={hours} onChangeText={setHours} />
      <Field label="موعد الاختبار (اختياري) YYYY-MM-DD" value={exam} onChangeText={setExam} />
      <Btn title="حفظ" onPress={save} />
    </View>
  );
}
