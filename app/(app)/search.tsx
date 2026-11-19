import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Card, Field, ListItem, Screen, T } from '@/components/ui';
import { shortLabel } from '@/lib/dates';
import { useQuery } from '@/lib/db';

/** X-02: one search across tasks, notes and expenses. */
export default function Search() {
  const [q, setQ] = useState('');
  const s = q.trim();
  const has = (...v: any[]) => !!s && v.filter(Boolean).join(' ').includes(s);
  const tasks = useQuery('tasks', (t) => has(t.title, t.notes), undefined, [s]);
  const work = useQuery('work_tasks', (t) => has(t.title, t.description), undefined, [s]);
  const notes = useQuery('notes', (n) => has(n.title, n.body), undefined, [s]);
  const workNotes = useQuery('work_notes', (n) => has(n.title, n.body), undefined, [s]);
  const inbox = useQuery('work_inbox', (i) => has(i.text), undefined, [s]);
  const money = useQuery('transactions', (t) => has(t.note, t.category, String(t.amount_sar)), (a, b) => b.date.localeCompare(a.date), [s]);
  const groups = [
    { label: 'المهام', items: tasks.map((t) => ({ id: t.id, title: t.title, sub: t.due_date ? shortLabel(t.due_date) : '', go: () => router.push({ pathname: '/task/[id]', params: { id: t.id } }) })) },
    { label: 'مهام الشغل', items: work.map((t) => ({ id: t.id, title: t.title, sub: 'شغل', go: () => router.push('/work') })) },
    { label: 'ملاحظات المواد', items: notes.map((n) => ({ id: n.id, title: n.title || n.body.slice(0, 40), sub: '', go: () => n.subject_id && router.push({ pathname: '/subject/[id]', params: { id: n.subject_id } }) })) },
    { label: 'ملاحظات الشغل', items: [...workNotes.map((n) => ({ id: n.id, title: n.title || n.body.slice(0, 40), sub: '' })), ...inbox.map((i) => ({ id: i.id, title: i.text, sub: 'وارد' }))].map((x) => ({ ...x, go: () => router.push('/work') })) },
    { label: 'المصاريف', items: money.map((t) => ({ id: t.id, title: `${t.type === 'income' ? '+' : '−'}${t.amount_sar} ر.س · ${t.category ?? t.source ?? ''}`, sub: `${shortLabel(t.date)}${t.note ? ` · ${t.note}` : ''}`, go: () => router.push('/money') })) },
  ];
  const total = groups.reduce((a, g) => a + g.items.length, 0);
  return (
    <Screen back title="بحث">
      <Field autoFocus placeholder="ابحث في المهام والملاحظات والمصاريف…" value={q} onChangeText={setQ} />
      {s && total === 0 && <T sub center>مفيش نتائج.</T>}
      {groups.map(
        (g) =>
          g.items.length > 0 && (
            <View key={g.label} style={{ gap: 6 }}>
              <T size={13} sub w="semibold">
                {g.label}
              </T>
              <Card style={{ gap: 0, paddingVertical: 4 }}>
                {g.items.slice(0, 20).map((i) => (
                  <ListItem key={i.id} title={i.title} subtitle={i.sub} onPress={i.go} />
                ))}
              </Card>
            </View>
          ),
      )}
    </Screen>
  );
}
