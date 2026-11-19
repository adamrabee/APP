import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Btn, Card, Check, Chips, confirm, Empty, Field, IconBtn, Row, Screen, SectionTitle, T } from '@/components/ui';
import { deleteTask, toggleTask } from '@/lib/actions';
import { addDays, cleanYmd, today, weekdayShort } from '@/lib/dates';
import { get, insert, update, useQuery, useRows } from '@/lib/db';
import { categoryLabel, type RepeatRule } from '@/lib/logic';

/** Task details: title, date, category, repeat (T-02), notes + subtasks (T-03), reminder (T-07). */
export default function TaskDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useRows('tasks');
  const t = get('tasks', id);
  const subs = useQuery('tasks', (x) => x.parent_id === id, (a, b) => String(a.created_at).localeCompare(String(b.created_at)), [id]);
  const [title, setTitle] = useState(t?.title ?? '');
  const [notes, setNotes] = useState(t?.notes ?? '');
  const [date, setDate] = useState(t?.due_date ?? '');
  const [remind, setRemind] = useState(t?.remind_at?.slice(0, 5) ?? '');
  const [sub, setSub] = useState('');

  useEffect(() => {
    if (t) (setTitle(t.title), setNotes(t.notes ?? ''), setDate(t.due_date ?? ''), setRemind(t.remind_at?.slice(0, 5) ?? ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t?.id]);

  if (!t) {
    return (
      <Screen back title="مهمة">
        <Empty text="المهمة دي اتحذفت." mood="sad" />
      </Screen>
    );
  }
  const rule = t.repeat_rule as RepeatRule;
  const repeatValue = rule?.freq ?? 'none';

  const saveText = () => update('tasks', t.id, { title: title.trim() || t.title, notes: notes.trim() || null });

  return (
    <Screen
      back
      title="تفاصيل المهمة"
      right={<IconBtn name="trash-outline" onPress={() => confirm('تحذف المهمة دي؟', () => (deleteTask(t.id), router.back()))} />}
    >
      <Card>
        <Row>
          <Check on={!!t.done_at} onPress={() => toggleTask(t)} size={28} />
          <View style={{ flex: 1 }}>
            <Field value={title} onChangeText={setTitle} onBlur={saveText} />
          </View>
        </Row>
        <T size={13} sub>
          القسم
        </T>
        <Chips value={t.category} onChange={(v: string) => update('tasks', t.id, { category: v })} options={Object.entries(categoryLabel).map(([value, label]) => ({ label, value }))} />
        <T size={13} sub>
          الموعد
        </T>
        <Chips
          value={t.due_date ?? 'none'}
          onChange={(v: string) => (update('tasks', t.id, { due_date: v === 'none' ? null : v }), setDate(v === 'none' ? '' : v))}
          options={[
            { label: 'النهارده', value: today() },
            { label: 'بكرة', value: addDays(today(), 1) },
            { label: 'بعد أسبوع', value: addDays(today(), 7) },
            { label: 'بدون', value: 'none' },
          ]}
        />
        <Field
          placeholder="أو اكتب تاريخ YYYY-MM-DD"
          value={date}
          onChangeText={setDate}
          onBlur={() => {
            const v = cleanYmd(date);
            if (v) update('tasks', t.id, { due_date: v });
          }}
        />
        <Field
          label="تذكير (HH:MM)"
          placeholder="مثلاً 18:30"
          value={remind}
          onChangeText={setRemind}
          onBlur={() => update('tasks', t.id, { remind_at: /^\d{1,2}:\d{2}$/.test(remind) ? remind : null })}
        />
        <T size={13} sub>
          التكرار
        </T>
        <Chips
          value={repeatValue}
          onChange={(v: string) => update('tasks', t.id, { repeat_rule: v === 'none' ? null : v === 'days' ? { freq: 'days', days: rule?.days ?? [] } : { freq: v } })}
          options={[
            { label: 'مرة واحدة', value: 'none' },
            { label: 'يومي', value: 'daily' },
            { label: 'أسبوعي', value: 'weekly' },
            { label: 'أيام محددة', value: 'days' },
          ]}
        />
        {rule?.freq === 'days' && (
          <Chips multi value={rule.days ?? []} onChange={(days: number[]) => update('tasks', t.id, { repeat_rule: { freq: 'days', days } })} options={weekdayShort.map((label, value) => ({ label, value }))} />
        )}
      </Card>

      <SectionTitle>ملاحظات</SectionTitle>
      <Field multiline placeholder="اكتب أي تفاصيل…" value={notes} onChangeText={setNotes} onBlur={saveText} />

      <SectionTitle>مهام فرعية</SectionTitle>
      <Card style={{ gap: 4 }}>
        {subs.map((s) => (
          <Row key={s.id} style={{ paddingVertical: 6 }}>
            <Check on={!!s.done_at} onPress={() => update('tasks', s.id, { done_at: s.done_at ? null : new Date().toISOString() })} />
            <T style={{ flex: 1 }} strike={!!s.done_at}>
              {s.title}
            </T>
            <IconBtn name="close" size={18} onPress={() => deleteTask(s.id)} />
          </Row>
        ))}
        <Row>
          <View style={{ flex: 1 }}>
            <Field
              placeholder="مهمة فرعية…"
              value={sub}
              onChangeText={setSub}
              onSubmitEditing={() => {
                if (!sub.trim()) return;
                insert('tasks', { title: sub.trim(), parent_id: t.id, category: t.category });
                setSub('');
              }}
            />
          </View>
          <Btn
            small
            title="أضف"
            onPress={() => {
              if (!sub.trim()) return;
              insert('tasks', { title: sub.trim(), parent_id: t.id, category: t.category });
              setSub('');
            }}
          />
        </Row>
      </Card>
    </Screen>
  );
}
