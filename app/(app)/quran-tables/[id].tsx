import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { Bar, Btn, Card, Chips, confirm, Empty, Field, IconBtn, Row, Screen, Sheet, T, tap } from '@/components/ui';
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
  const { width } = useWindowDimensions();
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
      <Screen back title="جدول">
        <Empty text="الجدول ده اتحذف." mood="sad" />
      </Screen>
    );
  }
  const done = cells.filter((x) => x.status === 'done').length;
  const doing = cells.filter((x) => x.status === 'doing').length;
  const DAY_W = 112;
  const colW = Math.max(130, cols.length ? (width - 36 - DAY_W) / Math.min(cols.length, 3) : 130);
  const cellAt = (r: string, col: string) => cells.find((x) => x.row_id === r && x.column_id === col);

  return (
    <Screen back title={table.name} right={<IconBtn name="add-circle-outline" onPress={() => setColSheet('new')} />}>
      <Card>
        <Row>
          <T w="bold" size={18} style={{ flex: 1 }}>
            {cells.length ? Math.round((done / cells.length) * 100) : 0}%
          </T>
          <T size={12} sub>
            {done}/{cells.length} تم · {doing} جاري
          </T>
        </Row>
        <Bar value={cells.length ? done / cells.length : 0} />
      </Card>

      {cols.length === 0 && days.length === 0 ? (
        <Card>
          <Empty text="ضيف أعمدة وأيام وابدأ تبني جدولك." mood="calm" />
        </Card>
      ) : (
        <View style={{ flexDirection: 'row' }}>
          {/* fixed day column */}
          <View style={{ width: DAY_W }}>
            <View style={{ height: 44, justifyContent: 'center' }}>
              <T size={12} sub w="semibold">
                اليوم
              </T>
            </View>
            {days.map((r) => {
              const rc = cells.filter((x) => x.row_id === r.id);
              const rd = rc.filter((x) => x.status === 'done').length;
              return (
                <Pressable key={r.id} onPress={() => setRowSheet(r)} style={{ height: 92, justifyContent: 'center', paddingLeft: 6, borderTopWidth: 1, borderColor: c.line }}>
                  <Row gap={4}>
                    <T w="semibold" lines={1} style={{ flexShrink: 1 }}>
                      {r.name}
                    </T>
                    {r.note ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.primary }} /> : null}
                  </Row>
                  {r.date ? (
                    <T size={11} sub>
                      {shortLabel(r.date)}
                    </T>
                  ) : null}
                  <T size={11} faint>
                    {rc.length ? `${Math.round((rd / rc.length) * 100)}%` : '—'}
                    {rc.some((x) => x.status === 'doing') ? ` · ${rc.filter((x) => x.status === 'doing').length} جاري` : ''}
                  </T>
                </Pressable>
              );
            })}
          </View>
          {/* scrollable columns */}
          <ScrollView horizontal showsHorizontalScrollIndicator style={{ flex: 1 }}>
            <View>
              <View style={{ flexDirection: 'row', height: 44 }}>
                {cols.map((col) => (
                  <Pressable key={col.id} onPress={() => setColSheet(col)} style={{ width: colW, justifyContent: 'center', paddingHorizontal: 8 }}>
                    <T size={13} w="semibold" lines={1}>
                      {col.name}
                    </T>
                  </Pressable>
                ))}
              </View>
              {days.map((r) => (
                <View key={r.id} style={{ flexDirection: 'row', height: 92, borderTopWidth: 1, borderColor: c.line }}>
                  {cols.map((col) => {
                    const cell = cellAt(r.id, col.id);
                    return (
                      <View key={col.id} style={{ width: colW, padding: 5 }}>
                        {cell ? (
                          <View style={{ flex: 1, borderRadius: 12, backgroundColor: cell.status === 'done' ? c.ink : c.card, padding: 8, gap: 4 }}>
                            <Pressable
                              onPress={() => (tap(), update('quran_cells', cell.id, { status: nextStatus[cell.status] }))}
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                            >
                              <Ionicons
                                name={cell.status === 'done' ? 'checkmark-circle' : cell.status === 'doing' ? 'ellipse-outline' : 'remove-circle-outline'}
                                size={16}
                                color={cell.status === 'done' ? c.onInk : cell.status === 'doing' ? c.primary : c.faint}
                              />
                              <T size={11} color={cell.status === 'done' ? c.onInk : c.sub}>
                                {cell.status === 'done' ? 'تم ✓' : cell.status === 'doing' ? 'جاري' : 'لسه'} · {kindLabel[cell.kind]}
                              </T>
                            </Pressable>
                            <Pressable onPress={() => setCellSheet(cell)} style={{ flex: 1 }}>
                              <T size={13} lines={2} color={cell.status === 'done' ? c.onInk : c.text}>
                                {cell.text || 'اضغط واكتب…'}
                              </T>
                            </Pressable>
                          </View>
                        ) : (
                          <Pressable
                            onPress={() => insert('quran_cells', { table_id: id, row_id: r.id, column_id: col.id, kind: 'free', status: 'none' })}
                            style={{ flex: 1, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Ionicons name="add" size={18} color={c.faint} />
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      <Row>
        <Btn style={{ flex: 1 }} kind="soft" icon="add" title="يوم" onPress={() => setRowSheet('new')} />
        <Btn style={{ flex: 1 }} kind="soft" icon="add" title="عمود" onPress={() => setColSheet('new')} />
      </Row>

      <CellSheet cell={cellSheet} onClose={() => setCellSheet(null)} />
      <RowSheet row={rowSheet} tableId={id} rows={days} onClose={() => setRowSheet(null)} />
      <ColSheet col={colSheet} tableId={id} cols={cols} onClose={() => setColSheet(null)} />
    </Screen>
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
