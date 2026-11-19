import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { LineChart } from '@/components/charts';
import { Mistakes } from '@/components/mistakes';
import { SubjectEditor } from '@/components/subject-editor';
import { Btn, Card, Chips, confirm, Empty, Field, IconBtn, ListRow, PillTabs, Row, Screen, Sheet, T } from '@/components/ui';
import { setUnitStatus } from '@/lib/actions';
import { cleanYmd, diffDays, shortLabel, today, weekStart } from '@/lib/dates';
import { get, insert, remove, update, useQuery, useRows } from '@/lib/db';
import { useTheme, type Accent } from '@/lib/theme';

type Tab = 'units' | 'cards' | 'exams' | 'mistakes' | 'notes';
const unitStatus: { label: string; value: string; acc: Accent }[] = [
  { label: 'لسه', value: 'not_started', acc: 'neutral' },
  { label: 'بذاكره', value: 'in_progress', acc: 'study' },
  { label: 'خلص', value: 'done', acc: 'green' },
  { label: 'محتاج مراجعة', value: 'needs_review', acc: 'worship' },
];

export default function Subject() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  useRows('subjects');
  const units = useQuery('subject_units', (u) => u.subject_id === id, undefined, [id]);
  const sessions = useQuery('study_sessions', (x) => x.subject_id === id, undefined, [id]);
  const cardsCount = useQuery('flashcards', (f) => f.subject_id === id, undefined, [id]).length;
  const exams = useQuery('exam_results', (e) => e.subject_id === id, (a, b) => a.date.localeCompare(b.date), [id]);
  const mistakesCount = useQuery('mistakes', (m) => m.subject_id === id, undefined, [id]).length;
  const s = get('subjects', id);
  const [tab, setTab] = useState<Tab>('units');
  const [edit, setEdit] = useState(false);
  if (!s) {
    return (
      <Screen back="المذاكرة" title="مادة">
        <Empty text="المادة دي اتحذفت." mood="sad" />
      </Screen>
    );
  }
  const pct = units.length ? Math.round((units.filter((u) => u.status === 'done').length / units.length) * 100) : 0;
  const weekMins = sessions.filter((x) => String(x.started_at).slice(0, 10) >= weekStart()).reduce((a, x) => a + x.minutes, 0);
  const lastExam = exams[exams.length - 1];
  const examIn = s.exam_date ? diffDays(s.exam_date, today()) : null;
  return (
    <Screen
      back="المذاكرة"
      backColor={c.acc.study.fg}
      footer={
        <View style={{ position: 'absolute', bottom: 24, left: 20, right: 20 }}>
          <Pressable
            onPress={() => router.push({ pathname: '/focus', params: { subject: s.id, start: '1' } })}
            style={{ minHeight: 52, borderRadius: 16, backgroundColor: s.color, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: s.color, shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 6 }}
          >
            <Ionicons name="play" size={18} color="#FFFFFF" />
            <T size={15} w="bold" color="#FFFFFF">
              ابدأ جلسة {s.name}
            </T>
          </Pressable>
        </View>
      }
    >
      <View style={{ gap: 10 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={10} style={{ flex: 1 }}>
            <View style={{ width: 14, height: 14, borderRadius: 5, backgroundColor: s.color }} />
            <T size={26} w="bold" lh={1.3} style={{ flexShrink: 1 }}>
              {s.name}
            </T>
          </Row>
          <Pressable onPress={() => setEdit(true)} style={{ backgroundColor: c.card, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 }}>
            <T size={12} sub>
              {examIn !== null && examIn >= 0 ? `الاختبار بعد ${examIn} يوم` : 'الاختبار: حدّد الموعد'}
            </T>
          </Pressable>
        </Row>
        <Row gap={8}>
          <MiniStat label="الإنجاز" value={`${pct}%`} />
          <MiniStat label="هذا الأسبوع" value={`${Math.round((weekMins / 60) * 10) / 10}${s.weekly_hours ? ` / ${s.weekly_hours}` : ''} س`} />
          <MiniStat label="آخر اختبار" value={lastExam ? `${Math.round((lastExam.score / lastExam.max_score) * 100)}%` : '—'} />
        </Row>
      </View>
      <PillTabs
        value={tab}
        onChange={setTab}
        options={[
          { label: 'الأجزاء', value: 'units' },
          { label: `البطاقات · ${cardsCount}`, value: 'cards' },
          { label: 'الاختبارات', value: 'exams' },
          { label: `الأخطاء · ${mistakesCount}`, value: 'mistakes' },
          { label: 'ملاحظات', value: 'notes' },
        ]}
      />
      {tab === 'units' && <Units subjectId={s.id} />}
      {tab === 'cards' && <Cards subjectId={s.id} />}
      {tab === 'exams' && <Exams subjectId={s.id} />}
      {tab === 'mistakes' && <Mistakes subjectId={s.id} />}
      {tab === 'notes' && <Notes subjectId={s.id} />}
      <Sheet visible={edit} onClose={() => setEdit(false)} title="تعديل المادة">
        <SubjectEditor subject={s} onDone={() => setEdit(false)} />
        <Btn
          kind="danger"
          title="حذف المادة"
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
              setEdit(false);
              router.back();
            })
          }
        />
      </Sheet>
    </Screen>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.card, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12 }}>
      <T size={11} sub>
        {label}
      </T>
      <T size={18} w="bold">
        {value}
      </T>
    </View>
  );
}

function Units({ subjectId }: { subjectId: string }) {
  const { c } = useTheme();
  const units = useQuery('subject_units', (u) => u.subject_id === subjectId, (a, b) => a.sort_order - b.sort_order, [subjectId]);
  const [title, setTitle] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const add = () => title.trim() && (insert('subject_units', { subject_id: subjectId, title: title.trim(), sort_order: units.length }), setTitle(''));
  return (
    <>
      <Row>
        <View style={{ flex: 1 }}>
          <Field placeholder="جزء جديد (فصل / مهارة / درس)" value={title} onChangeText={setTitle} onSubmitEditing={add} />
        </View>
        <Btn small title="أضف" onPress={add} />
      </Row>
      {units.length === 0 && <Empty text="قسّم المادة لأجزاء." mood="calm" />}
      {units.length > 0 && (
        <View style={{ backgroundColor: c.card, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 2 }}>
          {units.map((u, i) => {
            const st = unitStatus.find((x) => x.value === u.status) ?? unitStatus[0];
            const a = c.acc[st.acc];
            return (
              <View key={u.id}>
                <ListRow minHeight={50} last={i === units.length - 1 && open !== u.id} onPress={() => setOpen(open === u.id ? null : u.id)}>
                  <T size={14} w="medium" style={{ flex: 1 }}>
                    {u.title}
                  </T>
                  <View style={{ borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, backgroundColor: a.bg }}>
                    <T size={11} w="semibold" color={a.dark}>
                      {st.label}
                    </T>
                  </View>
                </ListRow>
                {open === u.id && (
                  <View style={{ gap: 8, paddingBottom: 12 }}>
                    <Chips value={u.status} onChange={(v: string) => setUnitStatus(u, v)} options={unitStatus} />
                    <T size={11} faint>
                      لما تخلّص جزء، بتتجدول مراجعات بعد 1 و3 و7 و30 يوم وتظهر في مهام اليوم.
                    </T>
                    <Row>
                      <Btn small kind="ghost" title="ابدأ جلسة" icon="timer-outline" onPress={() => router.push({ pathname: '/focus', params: { subject: subjectId, unit: u.id } })} />
                      <Btn small kind="danger" title="حذف" onPress={() => confirm('تحذف الجزء ده؟', () => remove('subject_units', u.id, [['reviews', 'unit_id']]))} />
                    </Row>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
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
