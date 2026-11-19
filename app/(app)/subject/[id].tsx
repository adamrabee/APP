import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { LineChart } from '@/components/charts';
import { Mistakes } from '@/components/mistakes';
import { SubjectEditor } from '@/components/subject-editor';
import { Bar, Btn, Card, Chips, confirm, Empty, Field, IconBtn, Pill, Row, Screen, Segmented, Sheet, T } from '@/components/ui';
import { setUnitStatus } from '@/lib/actions';
import { cleanYmd, shortLabel, today } from '@/lib/dates';
import { get, insert, remove, update, useQuery, useRows } from '@/lib/db';
import { useTheme } from '@/lib/theme';

type Tab = 'units' | 'cards' | 'exams' | 'mistakes' | 'notes';
const unitStatus = [
  { label: 'لم يبدأ', value: 'not_started' },
  { label: 'جارٍ', value: 'in_progress' },
  { label: 'خلص', value: 'done' },
  { label: 'يحتاج مراجعة', value: 'needs_review' },
];

export default function Subject() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useRows('subjects');
  const s = get('subjects', id);
  const [tab, setTab] = useState<Tab>('units');
  const [edit, setEdit] = useState(false);
  if (!s) {
    return (
      <Screen back title="مادة">
        <Empty text="المادة دي اتحذفت." mood="sad" />
      </Screen>
    );
  }
  return (
    <Screen
      back
      title={s.name}
      right={
        <Row gap={2}>
          <IconBtn name="create-outline" onPress={() => setEdit(true)} />
          <IconBtn
            name="trash-outline"
            onPress={() =>
              confirm('تحذف المادة؟ هيتحذف معاها الأجزاء والبطاقات والواجبات ومهامها من الجدول.', () => {
                remove('subjects', s.id, [
                  ['subject_units', 'subject_id'],
                  ['flashcards', 'subject_id'],
                  ['exam_results', 'subject_id'],
                  ['mistakes', 'subject_id'],
                  ['notes', 'subject_id'],
                  ['study_assignments', 'subject_id'],
                  ['study_schedule_items', 'subject_id'],
                  ['study_sessions', 'subject_id'],
                ]);
                router.back();
              })
            }
          />
        </Row>
      }
    >
      <Btn title="ابدأ جلسة لهذه المادة" icon="timer-outline" onPress={() => router.push({ pathname: '/focus', params: { subject: s.id } })} />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { label: 'الأجزاء', value: 'units' },
          { label: 'البطاقات', value: 'cards' },
          { label: 'الاختبارات', value: 'exams' },
          { label: 'الأخطاء', value: 'mistakes' },
          { label: 'ملاحظات', value: 'notes' },
        ]}
      />
      {tab === 'units' && <Units subjectId={s.id} color={s.color} />}
      {tab === 'cards' && <Cards subjectId={s.id} />}
      {tab === 'exams' && <Exams subjectId={s.id} />}
      {tab === 'mistakes' && <Mistakes subjectId={s.id} />}
      {tab === 'notes' && <Notes subjectId={s.id} />}
      <Sheet visible={edit} onClose={() => setEdit(false)} title="تعديل المادة">
        <SubjectEditor subject={s} onDone={() => setEdit(false)} />
      </Sheet>
    </Screen>
  );
}

function Units({ subjectId, color }: { subjectId: string; color: string }) {
  const { c } = useTheme();
  const units = useQuery('subject_units', (u) => u.subject_id === subjectId, (a, b) => a.sort_order - b.sort_order, [subjectId]);
  const [title, setTitle] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const done = units.filter((u) => u.status === 'done').length;
  const add = () => title.trim() && (insert('subject_units', { subject_id: subjectId, title: title.trim(), sort_order: units.length }), setTitle(''));
  return (
    <>
      <Card>
        <Row>
          <T w="bold" style={{ flex: 1 }}>
            نسبة الإنجاز
          </T>
          <T w="bold">{units.length ? Math.round((done / units.length) * 100) : 0}%</T>
        </Row>
        <Bar value={units.length ? done / units.length : 0} color={color} />
      </Card>
      <Row>
        <View style={{ flex: 1 }}>
          <Field placeholder="جزء جديد (فصل / مهارة / درس)" value={title} onChangeText={setTitle} onSubmitEditing={add} />
        </View>
        <Btn small title="أضف" onPress={add} />
      </Row>
      {units.length === 0 && <Empty text="قسّم المادة لأجزاء." mood="calm" />}
      {units.map((u) => (
        <Card key={u.id} onPress={() => setOpen(open === u.id ? null : u.id)} style={{ gap: 8 }}>
          <Row>
            <T w="medium" style={{ flex: 1 }} strike={u.status === 'done'}>
              {u.title}
            </T>
            <Pill text={unitStatus.find((x) => x.value === u.status)?.label ?? ''} color={u.status === 'done' ? c.onInk : u.status === 'needs_review' ? c.danger : c.primary} bg={u.status === 'done' ? c.ink : undefined} />
          </Row>
          {open === u.id && (
            <>
              <Chips value={u.status} onChange={(v: string) => setUnitStatus(u, v)} options={unitStatus} />
              <T size={11} faint>
                لما تخلّص جزء، بتتجدول مراجعات بعد 1 و3 و7 و30 يوم وتظهر في مهام اليوم.
              </T>
              <Row>
                <Btn small kind="ghost" title="ابدأ جلسة" icon="timer-outline" onPress={() => router.push({ pathname: '/focus', params: { subject: subjectId, unit: u.id } })} />
                <Btn small kind="danger" title="حذف" onPress={() => confirm('تحذف الجزء ده؟', () => remove('subject_units', u.id, [['reviews', 'unit_id']]))} />
              </Row>
            </>
          )}
        </Card>
      ))}
    </>
  );
}

function Cards({ subjectId }: { subjectId: string }) {
  const cards = useQuery('flashcards', (f) => f.subject_id === subjectId, (a, b) => a.due_date.localeCompare(b.due_date), [subjectId]);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const due = cards.filter((f) => f.due_date <= today()).length;
  const add = () => front.trim() && back.trim() && (insert('flashcards', { subject_id: subjectId, front: front.trim(), back: back.trim() }), setFront(''), setBack(''));
  return (
    <>
      <Btn disabled={!due} title={due ? `راجع ${due} بطاقة مستحقة` : 'مفيش بطاقات مستحقة'} icon="albums-outline" onPress={() => router.push({ pathname: '/flashcards', params: { subject: subjectId } })} />
      <Card>
        <Field placeholder="سؤال / كلمة" value={front} onChangeText={setFront} />
        <Field placeholder="جواب / معنى" value={back} onChangeText={setBack} onSubmitEditing={add} />
        <Btn small title="أضف بطاقة" onPress={add} />
      </Card>
      {cards.map((f) => (
        <Card key={f.id} style={{ gap: 4 }}>
          <Row>
            <T w="medium" style={{ flex: 1 }}>
              {f.front}
            </T>
            <IconBtn name="close" size={18} onPress={() => remove('flashcards', f.id)} />
          </Row>
          <T size={13} sub>
            {f.back}
          </T>
          <T size={11} faint>
            المراجعة الجاية {shortLabel(f.due_date)}
          </T>
        </Card>
      ))}
    </>
  );
}

function Exams({ subjectId }: { subjectId: string }) {
  const exams = useQuery('exam_results', (e) => e.subject_id === subjectId, (a, b) => a.date.localeCompare(b.date), [subjectId]);
  const [score, setScore] = useState('');
  const [max, setMax] = useState('');
  const [date, setDate] = useState(today());
  const [mock, setMock] = useState(true);
  const [note, setNote] = useState('');
  const add = () => {
    if (!Number(max)) return;
    insert('exam_results', { subject_id: subjectId, score: Number(score) || 0, max_score: Number(max), date: cleanYmd(date) ?? today(), is_mock: mock, note: note.trim() || null });
    setScore('');
    setNote('');
  };
  const pctValues = exams.map((e) => Math.round((e.score / e.max_score) * 100));
  return (
    <>
      <Card>
        <T w="semibold">منحنى التقدّم (%)</T>
        <LineChart values={pctValues} labels={exams.map((e) => shortLabel(e.date))} max={100} />
      </Card>
      <Card>
        <Chips value={mock} onChange={setMock} options={[{ label: 'تجريبي', value: true as any }, { label: 'حقيقي', value: false as any }]} />
        <Row>
          <View style={{ flex: 1 }}>
            <Field placeholder="الدرجة" keyboardType="decimal-pad" value={score} onChangeText={setScore} />
          </View>
          <View style={{ flex: 1 }}>
            <Field placeholder="من" keyboardType="decimal-pad" value={max} onChangeText={setMax} />
          </View>
          <View style={{ flex: 1.4 }}>
            <Field placeholder="التاريخ" value={date} onChangeText={setDate} />
          </View>
        </Row>
        <Field placeholder="ملاحظة (اختياري)" value={note} onChangeText={setNote} />
        <Btn small title="سجّل النتيجة" onPress={add} />
      </Card>
      {exams
        .slice()
        .reverse()
        .map((e) => (
          <Card key={e.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <T w="semibold">
                {e.score} / {e.max_score} · {Math.round((e.score / e.max_score) * 100)}%
              </T>
              <T size={12} sub>
                {shortLabel(e.date)} · {e.is_mock ? 'تجريبي' : 'حقيقي'}
                {e.note ? ` · ${e.note}` : ''}
              </T>
            </View>
            <IconBtn name="trash-outline" size={18} onPress={() => remove('exam_results', e.id)} />
          </Card>
        ))}
    </>
  );
}

function Notes({ subjectId }: { subjectId: string }) {
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const notes = useQuery(
    'notes',
    (n) => n.subject_id === subjectId && (!q || `${n.title ?? ''} ${n.body}`.includes(q)),
    (a, b) => String(b.updated_at).localeCompare(String(a.updated_at)),
    [subjectId, q],
  );
  const openNote = (n: any | 'new') => {
    setEditing(n);
    setTitle(n === 'new' ? '' : n.title ?? '');
    setBody(n === 'new' ? '' : n.body);
  };
  const save = () => {
    if (editing === 'new') {
      if (title.trim() || body.trim()) insert('notes', { subject_id: subjectId, title: title.trim(), body, updated_at: new Date().toISOString() });
    } else if (editing) update('notes', editing.id, { title: title.trim(), body });
    setEditing(null);
  };
  return (
    <>
      <Row>
        <View style={{ flex: 1 }}>
          <Field placeholder="ابحث في الملاحظات…" value={q} onChangeText={setQ} />
        </View>
        <Btn small title="ملاحظة" icon="add" onPress={() => openNote('new')} />
      </Row>
      {notes.length === 0 && <Empty text="مفيش ملاحظات." mood="calm" />}
      {notes.map((n) => (
        <Card key={n.id} onPress={() => openNote(n)} style={{ gap: 4 }}>
          <T w="semibold">{n.title || 'بدون عنوان'}</T>
          <T size={13} sub lines={2}>
            {n.body}
          </T>
        </Card>
      ))}
      <Sheet visible={!!editing} onClose={save} title="ملاحظة">
        <Field placeholder="العنوان" value={title} onChangeText={setTitle} />
        <Field multiline placeholder="اكتب…" value={body} onChangeText={setBody} style={{ minHeight: 200 }} />
        <Btn title="حفظ" onPress={save} />
        {editing && editing !== 'new' && <Btn kind="danger" title="حذف" onPress={() => (remove('notes', editing.id), setEditing(null))} />}
      </Sheet>
    </>
  );
}
