import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Bar, Btn, Card, Chips, confirm, Empty, Field, IconBtn, Row, Screen, Segmented, Sheet, T } from '@/components/ui';
import { cleanYmd } from '@/lib/dates';
import { insert, remove, rows, update, uuid, useQuery, useRows, type Row as DbRow } from '@/lib/db';

/** Q-01, Q-07: create and manage memorization tables. Starts empty. */
export default function QuranTables() {
  const [view, setView] = useState<'active' | 'archived'>('active');
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<DbRow | null>(null);
  const [newName, setNewName] = useState('');
  const tables = useQuery('quran_tables', (t) => (view === 'archived' ? t.archived : !t.archived), (a, b) => String(b.created_at).localeCompare(String(a.created_at)), [view]);
  const cells = useRows('quran_cells');

  return (
    <Screen back title="جدول حفظ القرآن">
      <Segmented value={view} onChange={setView} options={[{ label: 'الجداول', value: 'active' }, { label: 'الأرشيف', value: 'archived' }]} />
      {view === 'active' && <Btn title="جدول جديد" icon="add" onPress={() => setCreating(true)} />}
      {tables.length === 0 && (
        <Card>
          <Empty text={view === 'active' ? 'الجدول بيبدأ فاضي — اعمل أول جدول وابنيه بنفسك.' : 'الأرشيف فاضي.'} mood="calm" />
        </Card>
      )}
      {tables.map((t) => {
        const tc = cells.filter((c) => c.table_id === t.id);
        const done = tc.filter((c) => c.status === 'done').length;
        const doing = tc.filter((c) => c.status === 'doing').length;
        return (
          <Card key={t.id} onPress={() => router.push({ pathname: '/quran-tables/[id]', params: { id: t.id } })}>
            <Row>
              <T w="bold" style={{ flex: 1 }}>
                {t.name}
              </T>
              <IconBtn name="create-outline" size={18} onPress={() => (setRenaming(t), setNewName(t.name))} />
              <IconBtn name="copy-outline" size={18} onPress={() => duplicate(t)} />
              <IconBtn name={t.archived ? 'arrow-undo-outline' : 'archive-outline'} size={18} onPress={() => update('quran_tables', t.id, { archived: !t.archived })} />
              <IconBtn
                name="trash-outline"
                size={18}
                onPress={() =>
                  confirm(`تحذف "${t.name}" وكل خاناته؟`, () =>
                    remove('quran_tables', t.id, [
                      ['quran_cells', 'table_id'],
                      ['quran_rows', 'table_id'],
                      ['quran_columns', 'table_id'],
                    ]),
                  )
                }
              />
            </Row>
            <Bar value={tc.length ? done / tc.length : 0} />
            <T size={12} sub>
              {tc.length ? `${Math.round((done / tc.length) * 100)}% · ${done}/${tc.length} خانة · ${doing} جاري` : 'لسه مفيش خانات'}
            </T>
          </Card>
        );
      })}

      <Sheet visible={creating} onClose={() => setCreating(false)} title="جدول جديد">
        <NewTable onDone={(id) => (setCreating(false), router.push({ pathname: '/quran-tables/[id]', params: { id } }))} />
      </Sheet>
      <Sheet visible={!!renaming} onClose={() => setRenaming(null)} title="إعادة تسمية">
        <Field value={newName} onChangeText={setNewName} />
        <Btn title="حفظ" onPress={() => (renaming && newName.trim() && update('quran_tables', renaming.id, { name: newName.trim() }), setRenaming(null))} />
      </Sheet>
    </Screen>
  );
}

/** Copy structure + cells' kind/text. Statuses and notes start fresh (Q-07). */
function duplicate(t: DbRow) {
  const newId = uuid();
  insert('quran_tables', { id: newId, name: `${t.name} (نسخة)` });
  const colMap = new Map<string, string>();
  const rowMap = new Map<string, string>();
  for (const c of rows('quran_columns').filter((x) => x.table_id === t.id)) {
    const id = uuid();
    colMap.set(c.id, id);
    insert('quran_columns', { id, table_id: newId, name: c.name, sort_order: c.sort_order });
  }
  for (const r of rows('quran_rows').filter((x) => x.table_id === t.id)) {
    const id = uuid();
    rowMap.set(r.id, id);
    insert('quran_rows', { id, table_id: newId, name: r.name, date: r.date, sort_order: r.sort_order });
  }
  for (const c of rows('quran_cells').filter((x) => x.table_id === t.id)) {
    insert('quran_cells', { table_id: newId, row_id: rowMap.get(c.row_id), column_id: colMap.get(c.column_id), kind: c.kind, text: c.text, status: 'none' });
  }
}

function NewTable({ onDone }: { onDone: (id: string) => void }) {
  const [name, setName] = useState('');
  const [cols, setCols] = useState<string[]>([]);
  const [colInput, setColInput] = useState('');
  const [days, setDays] = useState<{ name: string; date: string }[]>([]);
  const [dayName, setDayName] = useState('');
  const [dayDate, setDayDate] = useState('');
  const [fill, setFill] = useState<'all' | 'one'>('all');

  function create() {
    if (!name.trim()) return;
    const tid = uuid();
    insert('quran_tables', { id: tid, name: name.trim() });
    const colIds = cols.map((c, i) => insert('quran_columns', { table_id: tid, name: c, sort_order: i }).id);
    const rowIds = days.map((d, i) => insert('quran_rows', { table_id: tid, name: d.name, date: cleanYmd(d.date), sort_order: i }).id);
    if (fill === 'all') for (const r of rowIds) for (const c of colIds) insert('quran_cells', { table_id: tid, row_id: r, column_id: c, kind: 'free', status: 'none' });
    onDone(tid);
  }

  return (
    <View style={{ gap: 12 }}>
      <Field label="اسم الجدول" value={name} onChangeText={setName} placeholder="مثلاً: حفظ جزء عمّ" />
      <T size={13} sub>
        الأعمدة
      </T>
      <Row>
        <View style={{ flex: 1 }}>
          <Field placeholder="اسم العمود (حفظ جديد، مراجعة…)" value={colInput} onChangeText={setColInput} onSubmitEditing={() => colInput.trim() && (setCols([...cols, colInput.trim()]), setColInput(''))} />
        </View>
        <Btn small title="أضف" onPress={() => colInput.trim() && (setCols([...cols, colInput.trim()]), setColInput(''))} />
      </Row>
      {cols.length > 0 && <Chips value={null} onChange={(v: string) => setCols(cols.filter((x) => x !== v))} options={cols.map((x) => ({ label: `${x} ✕`, value: x }))} />}
      <T size={13} sub>
        الأيام / الصفوف
      </T>
      <Row>
        <View style={{ flex: 2 }}>
          <Field placeholder="اسم اليوم" value={dayName} onChangeText={setDayName} />
        </View>
        <View style={{ flex: 2 }}>
          <Field placeholder="تاريخ (اختياري)" value={dayDate} onChangeText={setDayDate} />
        </View>
        <Btn small title="أضف" onPress={() => dayName.trim() && (setDays([...days, { name: dayName.trim(), date: dayDate }]), setDayName(''), setDayDate(''))} />
      </Row>
      {days.length > 0 && <Chips value={null} onChange={(v: string) => setDays(days.filter((x) => x.name !== v))} options={days.map((x) => ({ label: `${x.name}${x.date ? ` · ${x.date}` : ''} ✕`, value: x.name }))} />}
      <Chips value={fill} onChange={setFill} options={[{ label: 'اعمل خانات في كل الجدول', value: 'all' }, { label: 'هضيف الخانات واحدة واحدة', value: 'one' }]} />
      <Btn title="إنشاء الجدول" onPress={create} />
    </View>
  );
}
