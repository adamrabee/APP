import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Btn, Card, Chips, confirm, Empty, Field, Ring, Row, Screen, Sheet, T, tap } from '@/components/ui';
import { cleanYmd, shortLabel } from '@/lib/dates';
import { get, insert, remove, update, useQuery, useRows, type Row as DbRow } from '@/lib/db';
import { useTheme } from '@/lib/theme';

const KINDS = [
  { label: 'صفحات', value: 'page' },
  { label: 'جزء', value: 'juz' },
  { label: 'سورة', value: 'surah' },
  { label: 'آيات', value: 'ayah' },
  { label: 'حر', value: 'free' },
];
const kindLabel = Object.fromEntries(KINDS.map((k) => [k.value, k.label]));
const nextStatus: Record<string, string> = { none: 'doing', doing: 'done', done: 'none' };

/** Q-02…Q-09: an editable grid. Day column stays fixed while columns scroll sideways. Every edit autosaves. */
export default function QuranTable() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();

  useRows('quran_tables');
  const table = get('quran_tables', id);
  const cols = useQuery('quran_columns', (x) => x.table_id === id, (a, b) => a.sort_order - b.sort_order, [id]);
  const days = useQuery('quran_rows', (x) => x.table_id === id, (a, b) => a.sort_order - b.sort_order, [id]);
  const cells = useQuery('quran_cells', (x) => x.table_id === id, undefined, [id]);
  const [cellSheet, setCellSheet] = useState<DbRow | null>(null);
  const [rowSheet, setRowSheet] = useState<DbRow | 'new' | null>(null);
  const [colSheet, setColSheet] = useState<DbRow | 'new' | null>(null);

  if (!table) {
    return (
      <Screen back="الجداول" backColor={c.acc.worship.fg} title="جدول">
        <Empty text="الجدول ده اتحذف." mood="sad" />
      </Screen>
    );
  }
  const done = cells.filter((x) => x.status === 'done').length;
  const doing = cells.filter((x) => x.status === 'doing').length;
  const gold = c.acc.worship;
  const DAY_W = 116;
  const COL_W = 140;
  const cellAt = (r: string, col: string) => cells.find((x) => x.row_id === r && x.column_id === col);
  const fillAll = () => {
    for (const r of days) for (const col of cols) if (!cellAt(r.id, col.id)) insert('quran_cells', { table_id: id, row_id: r.id, column_id: col.id, kind: 'free', status: 'none' });
  };
  const pct = cells.length ? done / cells.length : 0;

  return (
    <Screen back="الجداول" backColor={gold.fg} title={table.name} padded={false}>
      <View style={{ paddingHorizontal: 18, gap: 14 }}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 16, borderRadius: 22 }}>
          <Ring value={pct} size={64} stroke={6} color={c.primaryDark}>
            <T size={14} w="bold">
              {Math.round(pct * 100)}%
            </T>
          </Ring>
          <View style={{ flex: 1, gap: 4 }}>
            <T size={14} w="bold">
              نسبة الإنجاز
            </T>
            <T size={12} sub lh={1.6}>
              {done} من {cells.length} خانة مكتملة · {doing} جاري
            </T>
          </View>
        </Card>
        <Row gap={8}>
          <GridBtn label="+ عمود" onPress={() => setColSheet('new')} />
          <GridBtn label="+ صف" onPress={() => setRowSheet('new')} />
          <GridBtn label="خانات للكل" onPress={fillAll} />
        </Row>
      </View>

      {cols.length === 0 && days.length === 0 ? (
        <View style={{ paddingHorizontal: 18 }}>
          <Card>
            <Empty text="ضيف أعمدة وأيام وابدأ تبني جدولك." mood="calm" />
          </Card>
        </View>
      ) : (
        <View style={{ gap: 6 }}>
          <T size={11} color="#8A8A85" style={{ paddingHorizontal: 18 }}>
            اسحب الجدول يمين وشمال عشان تشوف كل الأعمدة
          </T>
          <View style={{ flexDirection: 'row', paddingRight: 18 }}>
            {/* sticky day column */}
            <View style={{ width: DAY_W, gap: 8, zIndex: 2 }}>
              <View style={{ minHeight: 44, borderRadius: 14, backgroundColor: c.bg, justifyContent: 'center', paddingHorizontal: 6 }}>
                <T size={12} w="semibold" sub>
                  اليوم / الصف
                </T>
              </View>
              {days.map((r) => {
                const rc = cells.filter((x) => x.row_id === r.id);
                const rd = rc.filter((x) => x.status === 'done').length;
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => setRowSheet(r)}
                    style={{ height: 92, borderRadius: 16, backgroundColor: gold.bg, padding: 10, gap: 4, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: -6, height: 0 }, elevation: 1 }}
                  >
                    <Row gap={4}>
                      <T size={14} w="bold" lh={1.3} lines={1} style={{ flexShrink: 1 }}>
                        {r.name}
                      </T>
                      {r.note ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: gold.fg }} /> : null}
                    </Row>
                    {r.date ? (
                      <T size={11} color={gold.fg}>
                        {shortLabel(r.date)}
                      </T>
                    ) : null}
                    <T size={11} w="semibold" color={gold.fg}>
                      {rc.length ? `${Math.round((rd / rc.length) * 100)}%` : '—'}
                      {rc.some((x) => x.status === 'doing') ? ` · ${rc.filter((x) => x.status === 'doing').length} جاري` : ''}
                    </T>
                  </Pressable>
                );
              })}
            </View>
            {/* columns scroll sideways */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8, paddingLeft: 18 }}>
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {cols.map((col) => (
                    <Pressable key={col.id} onPress={() => setColSheet(col)} style={{ width: COL_W, minHeight: 44, borderRadius: 14, backgroundColor: '#1F2421', paddingVertical: 6, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <T size={13} w="bold" color="#FFFFFF" lines={1} style={{ flexShrink: 1 }}>
                        {col.name}
                      </T>
                      <Ionicons name="ellipsis-horizontal" size={14} color="#C9CFC9" />
                    </Pressable>
                  ))}
                </View>
                {days.map((r) => (
                  <View key={r.id} style={{ flexDirection: 'row', gap: 8, height: 92 }}>
                    {cols.map((col) => {
                      const cell = cellAt(r.id, col.id);
                      if (!cell)
                        return (
                          <Pressable
                            key={col.id}
                            onPress={() => insert('quran_cells', { table_id: id, row_id: r.id, column_id: col.id, kind: 'free', status: 'none' })}
                            style={{ width: COL_W, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#D9D4C7', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <T size={20} color="#A39C8C">
                              +
                            </T>
                          </Pressable>
                        );
                      const isDone = cell.status === 'done';
                      const isDoing = cell.status === 'doing';
                      return (
                        <View key={col.id} style={{ width: COL_W, borderRadius: 16, padding: 8, gap: 6, backgroundColor: isDone ? c.doneBg : c.card, borderWidth: 1, borderColor: isDone ? c.doneBorder : isDoing ? gold.bar : c.line }}>
                          <Pressable
                            onPress={() => (tap(), update('quran_cells', cell.id, { status: nextStatus[cell.status] }))}
                            style={{ alignSelf: 'flex-start', minHeight: 28, paddingHorizontal: 9, borderRadius: 999, borderWidth: 1, justifyContent: 'center', borderColor: isDone ? c.primaryDark : isDoing ? gold.bar : c.border, backgroundColor: isDone ? c.primaryDark : isDoing ? gold.bg : c.card }}
                          >
                            <T size={11} w="bold" color={isDone ? '#FFFFFF' : isDoing ? gold.fg : c.sub}>
                              {isDone ? '✓ تم' : isDoing ? '◐ جاري' : '○ لسه'}
                            </T>
                          </Pressable>
                          <Pressable onPress={() => setCellSheet(cell)} style={{ flex: 1, gap: 2 }}>
                            <T size={10} w="semibold" sub>
                              {kindLabel[cell.kind]}
                            </T>
                            <T size={13} w="semibold" lh={1.4} lines={2} color={cell.text ? c.text : c.faint}>
                              {cell.text || 'اضغط واكتب…'}
                            </T>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      )}

      <CellSheet cell={cellSheet} onClose={() => setCellSheet(null)} />
      <RowSheet row={rowSheet} tableId={id} rows={days} onClose={() => setRowSheet(null)} />
      <ColSheet col={colSheet} tableId={id} cols={cols} onClose={() => setColSheet(null)} />
    </Screen>
  );
}

function GridBtn({ label, onPress }: { label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ flex: 1, minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: '#E6E3DC', backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
      <T size={13} w="bold">
        {label}
      </T>
    </Pressable>
  );
}

function CellSheet({ cell, onClose }: { cell: DbRow | null; onClose: () => void }) {
  const [text, setText] = useState('');
  const [shown, setShown] = useState<string | null>(null);
  if (cell && shown !== cell.id) (setShown(cell.id), setText(cell.text ?? ''));
  if (!cell) return null;
  return (
    <Sheet visible onClose={() => (update('quran_cells', cell.id, { text }), onClose(), setShown(null))} title="تفاصيل الخانة">
      <Chips value={cell.kind} onChange={(v: string) => update('quran_cells', cell.id, { kind: v })} options={KINDS} />
      <Field multiline placeholder="هتحفظ إيه؟ (مثلاً: البقرة 1-20)" value={text} onChangeText={setText} />
      <Chips
        value={cell.status}
        onChange={(v: string) => update('quran_cells', cell.id, { status: v })}
        options={[
          { label: 'لسه', value: 'none' },
          { label: 'جاري', value: 'doing' },
          { label: 'تم ✓', value: 'done' },
        ]}
      />
      <Btn title="حفظ" onPress={() => (update('quran_cells', cell.id, { text }), onClose(), setShown(null))} />
      <Btn kind="danger" title="حذف الخانة" onPress={() => (remove('quran_cells', cell.id), onClose(), setShown(null))} />
    </Sheet>
  );
}

function move(table: string, list: DbRow[], item: DbRow, dir: -1 | 1) {
  const i = list.findIndex((x) => x.id === item.id);
  const j = i + dir;
  if (j < 0 || j >= list.length) return;
  const a = list[i], b = list[j];
  update(table, a.id, { sort_order: b.sort_order === a.sort_order ? j : b.sort_order });
  update(table, b.id, { sort_order: b.sort_order === a.sort_order ? i : a.sort_order });
}

function RowSheet({ row, tableId, rows, onClose }: { row: DbRow | 'new' | null; tableId: string; rows: DbRow[]; onClose: () => void }) {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [shown, setShown] = useState<string | null>(null);
  const key = row === 'new' ? 'new' : row?.id ?? null;
  if (row && shown !== key) {
    setShown(key);
    setName(row === 'new' ? '' : row.name);
    setDate(row === 'new' ? '' : row.date ?? '');
    setNote(row === 'new' ? '' : row.note ?? '');
  }
  if (!row) return null;
  const close = () => (onClose(), setShown(null));
  const save = () => {
    if (!name.trim()) return;
    if (row === 'new') insert('quran_rows', { table_id: tableId, name: name.trim(), date: cleanYmd(date), note: note.trim() || null, sort_order: rows.length });
    else update('quran_rows', row.id, { name: name.trim(), date: cleanYmd(date), note: note.trim() || null });
    close();
  };
  return (
    <Sheet visible onClose={close} title={row === 'new' ? 'يوم جديد' : 'تعديل اليوم'}>
      <Field label="الاسم" value={name} onChangeText={setName} />
      <Field label="التاريخ (اختياري) YYYY-MM-DD" value={date} onChangeText={setDate} />
      <Field label="ملاحظات اليوم" multiline value={note} onChangeText={setNote} />
      <Btn title="حفظ" onPress={save} />
      {row !== 'new' && (
        <>
          <Row>
            <Btn style={{ flex: 1 }} kind="ghost" icon="arrow-up" title="قدّم" onPress={() => move('quran_rows', rows, row, -1)} />
            <Btn style={{ flex: 1 }} kind="ghost" icon="arrow-down" title="أخّر" onPress={() => move('quran_rows', rows, row, 1)} />
          </Row>
          <Btn kind="danger" title="حذف اليوم وخاناته" onPress={() => confirm('تحذف اليوم ده وكل خاناته؟', () => (remove('quran_rows', row.id, [['quran_cells', 'row_id']]), close()))} />
        </>
      )}
    </Sheet>
  );
}

function ColSheet({ col, tableId, cols, onClose }: { col: DbRow | 'new' | null; tableId: string; cols: DbRow[]; onClose: () => void }) {
  const [name, setName] = useState('');
  const [shown, setShown] = useState<string | null>(null);
  const key = col === 'new' ? 'new' : col?.id ?? null;
  if (col && shown !== key) (setShown(key), setName(col === 'new' ? '' : col.name));
  if (!col) return null;
  const close = () => (onClose(), setShown(null));
  return (
    <Sheet visible onClose={close} title={col === 'new' ? 'عمود جديد' : 'تعديل العمود'}>
      <Field label="اسم العمود" value={name} onChangeText={setName} />
      <Btn
        title="حفظ"
        onPress={() => {
          if (!name.trim()) return;
          if (col === 'new') insert('quran_columns', { table_id: tableId, name: name.trim(), sort_order: cols.length });
          else update('quran_columns', col.id, { name: name.trim() });
          close();
        }}
      />
      {col !== 'new' && (
        <>
          <Row>
            <Btn style={{ flex: 1 }} kind="ghost" icon="arrow-forward" title="يمين" onPress={() => move('quran_columns', cols, col, -1)} />
            <Btn style={{ flex: 1 }} kind="ghost" icon="arrow-back" title="شمال" onPress={() => move('quran_columns', cols, col, 1)} />
          </Row>
          <Btn kind="danger" title="حذف العمود وخاناته" onPress={() => confirm('تحذف العمود ده وكل خاناته؟', () => (remove('quran_columns', col.id, [['quran_cells', 'column_id']]), close()))} />
        </>
      )}
    </Sheet>
  );
}
