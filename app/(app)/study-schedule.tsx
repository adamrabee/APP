import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SubjectEditor } from '@/components/subject-editor';
import { Bar, Btn, Card, Check, Chips, confirm, Empty, Field, IconBtn, Row, Screen, Sheet, T } from '@/components/ui';
import { addDays, cleanYmd, hhmm, minutesOf, parseYmd, shortLabel, timeLabel, today, weekdayNames, weekdayShort } from '@/lib/dates';
import { get, insert, remove, rows, update, uuid, useQuery, type Row as DbRow } from '@/lib/db';
import { generate, suggestedTimes, type Item } from '@/lib/schedule';
import { useTheme } from '@/lib/theme';

const time12 = (hm: string) => {
  const [h, m] = hm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return timeLabel(d);
};

/** §4.6.1 Generate Study Schedule (SP-01…SP-09). Built only from the user's own subjects and assignments. */
export default function StudySchedule() {
  const { c } = useTheme();
  const blue = c.acc.study;
  const [tab, setTab] = useState<'schedule' | 'subjects' | 'assignments'>('schedule');
  const subjects = useQuery('subjects', (s) => !s.archived, (a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const assignments = useQuery('study_assignments', undefined, (a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'));
  const schedule = useQuery('study_schedules', undefined, (a, b) => String(b.generated_at).localeCompare(String(a.generated_at)))[0];
  const items = useQuery('study_schedule_items', (i) => i.schedule_id === schedule?.id, (a, b) => a.day.localeCompare(b.day) || a.sort_order - b.sort_order, [schedule?.id]);
  const [settings, setSettings] = useState({ start: today(), days: '7', hours: '3', time: '16:00' });
  const [openSettings, setOpenSettings] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [editItem, setEditItem] = useState<{ item: DbRow | 'new'; day: string } | null>(null);

  const scheduledAssignmentIds = new Set(items.filter((i) => i.assignment_id).map((i) => i.assignment_id));
  const missing = assignments.filter((a) => !a.done && !scheduledAssignmentIds.has(a.id));

  function create() {
    const s = { start_date: cleanYmd(settings.start) ?? today(), days: Math.max(1, Number(settings.days) || 7), hours_per_day: Math.max(0.5, Number(settings.hours) || 3), start_time: /^\d{1,2}:\d{2}$/.test(settings.time) ? settings.time : '16:00' };
    // SP-07: keep completed + manual items, redistribute the rest
    const keep: Item[] = items
      .filter((i) => i.status === 'completed' || i.kind === 'custom')
      .map((i) => ({ day: i.day, subject_id: i.subject_id, assignment_id: i.assignment_id, title: i.title, kind: i.kind, minutes: i.minutes, status: i.status, sort_order: i.sort_order }));
    const { items: out, warnings: w } = generate(s, subjects, assignments, keep);
    if (schedule) remove('study_schedules', schedule.id, [['study_schedule_items', 'schedule_id']]);
    const sid = uuid();
    insert('study_schedules', { id: sid, ...s, generated_at: new Date().toISOString() });
    for (const it of out) {
      const { due, ...rest } = it;
      insert('study_schedule_items', { ...rest, schedule_id: sid });
    }
    setWarnings(w);
    setOpenSettings(false);
  }

  function toggleItem(i: DbRow) {
    const status = i.status === 'completed' ? 'pending' : 'completed';
    update('study_schedule_items', i.id, { status });
    // SP-08: assignment completes itself when all of its items are done
    if (i.assignment_id) {
      const all = rows('study_schedule_items').filter((x) => x.assignment_id === i.assignment_id && x.schedule_id === i.schedule_id);
      const allDone = all.every((x) => (x.id === i.id ? status === 'completed' : x.status === 'completed'));
      update('study_assignments', i.assignment_id, { done: allDone });
    }
  }

  const days = schedule ? Array.from({ length: schedule.days }, (_, k) => addDays(schedule.start_date, k)) : [];
  const doneItems = items.filter((i) => i.status === 'completed').length;
  const summary = schedule
    ? `${schedule.days} أيام · ${schedule.hours_per_day} س/يوم · من ${time12(schedule.start_time.slice(0, 5))}`
    : `${settings.days} أيام · ${settings.hours} س/يوم · من ${time12(settings.time)}`;
  const tabs = [
    ['schedule', 'الجدول'],
    ['subjects', `المواد · ${subjects.length}`],
    ['assignments', `الواجبات · ${assignments.filter((a) => !a.done).length}`],
  ] as const;

  return (
    <Screen back="المذاكرة" backColor={blue.fg} title="جدول المذاكرة" subtitle="بيتعمل من موادك وواجباتك إنت بس، وتقدر تعدّله براحتك." padded={false}>
      <View style={{ paddingHorizontal: 18, gap: 14 }}>
        <View style={{ flexDirection: 'row', backgroundColor: c.seg, borderRadius: 14, padding: 4 }}>
          {tabs.map(([v, label]) => (
            <Pressable key={v} onPress={() => setTab(v)} style={{ flex: 1, minHeight: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: tab === v ? c.card : 'transparent' }}>
              <T size={13} w="semibold">
                {label}
              </T>
            </Pressable>
          ))}
        </View>

        {tab === 'schedule' && (
          <>
            <Card style={{ padding: 14, gap: 12 }}>
              <Pressable onPress={() => setOpenSettings(!openSettings)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 }}>
                <T size={14} w="bold">
                  إعدادات التوزيع
                </T>
                <Row gap={4}>
                  <T size={12} sub>
                    {summary}
                  </T>
                  <Ionicons name={openSettings ? 'chevron-up' : 'chevron-down'} size={14} color={c.sub} />
                </Row>
              </Pressable>
              {openSettings && (
                <View style={{ gap: 10 }}>
                  <Row>
                    <View style={{ flex: 1.4 }}>
                      <Field label="يبدأ من" value={settings.start} onChangeText={(v) => setSettings({ ...settings, start: v })} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field label="عدد الأيام" keyboardType="number-pad" value={settings.days} onChangeText={(v) => setSettings({ ...settings, days: v })} />
                    </View>
                  </Row>
                  <Row>
                    <View style={{ flex: 1 }}>
                      <Field label="ساعات في اليوم" keyboardType="decimal-pad" value={settings.hours} onChangeText={(v) => setSettings({ ...settings, hours: v })} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field label="ميعاد البداية" value={settings.time} onChangeText={(v) => setSettings({ ...settings, time: v })} />
                    </View>
                  </Row>
                </View>
              )}
              <Btn
                title="Create a Schedule"
                icon="sparkles-outline"
                disabled={!subjects.length}
                style={{ minHeight: 54, borderRadius: 16 }}
                onPress={() => (schedule ? confirm('هتعمل الجدول من جديد؟ المهام المكتملة والمضافة بإيدك هتفضل زي ما هي.', create) : create())}
              />
              {!subjects.length && (
                <T size={12} sub lh={1.6}>
                  ضيف مادة واحدة على الأقل من تبويب «المواد» عشان تقدر تعمل جدول.
                </T>
              )}
            </Card>

            {missing.length > 0 && schedule && (
              <Card tint={c.acc.worship.bg} style={{ gap: 4 }}>
                <T size={13} w="semibold" color={c.acc.worship.fg}>
                  فيه {missing.length} واجب مش في الجدول
                </T>
                <T size={12} sub>
                  {missing.map((m) => m.title).join('، ')} — اضغط Create a Schedule عشان يتوزعوا.
                </T>
              </Card>
            )}
            {warnings.map((w) => (
              <Card key={w} tint={c.acc.health.bg}>
                <T size={13} color={c.acc.health.fg}>
                  ⚠️ {w}
                </T>
              </Card>
            ))}

            {schedule && (
              <Card style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 18, gap: 6 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T size={13} w="bold">
                    الإنجاز
                  </T>
                  <T size={13} sub>
                    {doneItems} من {items.length} مهمة
                  </T>
                </Row>
                <Bar value={items.length ? doneItems / items.length : 0} color={blue.bar} />
              </Card>
            )}
          </>
        )}
        {tab === 'assignments' && <Assignments subjects={subjects} assignments={assignments} />}
        {tab === 'subjects' && <SubjectsManager subjects={subjects} />}
      </View>

      {tab === 'schedule' &&
        (!schedule ? (
          <View style={{ marginHorizontal: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#D3D9E0', borderRadius: 20, paddingVertical: 22, paddingHorizontal: 16 }}>
            <T size={13} sub center lh={1.8}>
              لسه ما عملتش جدول.{'\n'}ضيف موادك وواجباتك، وبعدين اضغط «Create a Schedule».
            </T>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 18, paddingBottom: 6 }}>
            {days.map((d) => {
              const di = items.filter((i) => i.day === d);
              const times = suggestedTimes(schedule.start_time.slice(0, 5), di.map((i) => i.minutes));
              const mins = di.reduce((a, i) => a + i.minutes, 0);
              return (
                <View key={d} style={{ width: 168, gap: 8 }}>
                  <View style={{ borderRadius: 14, backgroundColor: '#1F2421', paddingVertical: 10, paddingHorizontal: 12, gap: 2 }}>
                    <T size={14} w="bold" color="#FFFFFF">
                      {d === today() ? 'النهارده' : weekdayNames[parseYmd(d).getDay()]}
                    </T>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <T size={11} color="#C9CFC9">
                        {shortLabel(d)}
                      </T>
                      <T size={11} color="#C9CFC9">
                        {Math.floor(mins / 60)}س {mins % 60}د
                      </T>
                    </Row>
                  </View>
                  {di.map((i, k) => {
                    const subj = get('subjects', i.subject_id);
                    const isDone = i.status === 'completed';
                    const start = times[k];
                    const end = hhmm(minutesOf(start) + i.minutes);
                    return (
                      <View key={i.id} style={{ borderRadius: 16, padding: 10, gap: 6, backgroundColor: isDone ? c.doneBg : c.card, borderWidth: 1, borderColor: isDone ? c.doneBorder : '#ECE9E2' }}>
                        <Pressable
                          onPress={() => toggleItem(i)}
                          style={{ alignSelf: 'flex-start', minHeight: 28, paddingHorizontal: 9, borderRadius: 999, borderWidth: 1, justifyContent: 'center', borderColor: isDone ? c.primaryDark : '#E3DFD6', backgroundColor: isDone ? c.primaryDark : c.card }}
                        >
                          <T size={11} w="bold" color={isDone ? '#FFFFFF' : c.sub}>
                            {isDone ? '✓ Completed' : '○ Pending'}
                          </T>
                        </Pressable>
                        <Pressable onPress={() => setEditItem({ item: i, day: d })} style={{ gap: 3 }}>
                          <Row gap={5}>
                            <View style={{ width: 8, height: 8, borderRadius: 3, backgroundColor: subj?.color ?? c.faint }} />
                            <T size={11} w="semibold" color={c.sub2}>
                              {subj?.name ?? '—'}
                            </T>
                          </Row>
                          <T size={13} w="bold" lh={1.4}>
                            {i.title}
                          </T>
                          <T size={10} sub>
                            {time12(start)} – {time12(end)}
                          </T>
                        </Pressable>
                      </View>
                    );
                  })}
                  <Pressable onPress={() => setEditItem({ item: 'new', day: d })} style={{ minHeight: 48, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#D3D9E0', alignItems: 'center', justifyContent: 'center' }}>
                    <T size={20} color="#8A94A0">
                      +
                    </T>
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
        ))}

      <ItemSheet
        item={editItem?.item ?? null}
        day={editItem?.day}
        days={days}
        dayItems={items.filter((i) => i.day === editItem?.day)}
        scheduleId={schedule?.id}
        subjects={subjects}
        onClose={() => setEditItem(null)}
      />
    </Screen>
  );
}

function Assignments({ subjects, assignments }: { subjects: DbRow[]; assignments: DbRow[] }) {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState<string | null>(null);
  const [due, setDue] = useState('');
  const [hours, setHours] = useState('2');
  const add = () => {
    const sid = subject ?? subjects[0]?.id;
    if (!title.trim() || !sid) return;
    insert('study_assignments', { title: title.trim(), subject_id: sid, due_date: cleanYmd(due), est_hours: Math.max(0.25, Number(hours) || 1) });
    setTitle('');
    setDue('');
  };
  if (!subjects.length) return <Empty text="ضيف مادة الأول." mood="calm" />;
  return (
    <>
      <Card>
        <Field placeholder="عنوان الواجب" value={title} onChangeText={setTitle} />
        <Chips value={subject ?? subjects[0].id} onChange={setSubject} options={subjects.map((s) => ({ label: s.name, value: s.id }))} />
        <Row>
          <View style={{ flex: 1.4 }}>
            <Field placeholder="ميعاد التسليم YYYY-MM-DD (اختياري)" value={due} onChangeText={setDue} />
          </View>
          <View style={{ flex: 1 }}>
            <Field placeholder="ساعات متوقعة" keyboardType="decimal-pad" value={hours} onChangeText={setHours} />
          </View>
        </Row>
        <Btn small title="أضف الواجب" onPress={add} />
      </Card>
      {assignments.length === 0 && <Empty text="مفيش واجبات." mood="happy" />}
      {assignments.map((a) => (
        <Card key={a.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Check on={a.done} onPress={() => update('study_assignments', a.id, { done: !a.done })} />
          <View style={{ flex: 1 }}>
            <T w="medium" strike={a.done}>
              {a.title}
            </T>
            <T size={12} sub>
              {get('subjects', a.subject_id)?.name} · {a.est_hours} ساعة · {a.due_date ? `تسليم ${shortLabel(a.due_date)}` : 'بدون ميعاد'}
              {a.due_date && a.due_date < today() && !a.done ? ' · متأخر' : ''}
            </T>
          </View>
          <IconBtn name="trash-outline" size={18} onPress={() => confirm('تحذف الواجب؟', () => remove('study_assignments', a.id, [['study_schedule_items', 'assignment_id']]))} />
        </Card>
      ))}
    </>
  );
}

function SubjectsManager({ subjects }: { subjects: DbRow[] }) {
  const [edit, setEdit] = useState<DbRow | 'new' | null>(null);
  return (
    <>
      <Btn kind="soft" icon="add" title="مادة جديدة" onPress={() => setEdit('new')} />
      {subjects.map((s) => (
        <Card key={s.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: s.color }} />
          <T w="medium" style={{ flex: 1 }}>
            {s.name}
          </T>
          <IconBtn name="create-outline" size={18} onPress={() => setEdit(s)} />
          <IconBtn
            name="trash-outline"
            size={18}
            onPress={() =>
              confirm(`تحذف "${s.name}"؟ واجباتها ومهامها في الجدول هتتحذف كمان.`, () =>
                remove('subjects', s.id, [
                  ['study_assignments', 'subject_id'],
                  ['study_schedule_items', 'subject_id'],
                  ['subject_units', 'subject_id'],
                  ['flashcards', 'subject_id'],
                ]),
              )
            }
          />
        </Card>
      ))}
      <Sheet visible={!!edit} onClose={() => setEdit(null)} title="مادة">
        <SubjectEditor subject={edit && edit !== 'new' ? edit : undefined} onDone={() => setEdit(null)} />
      </Sheet>
    </>
  );
}

function ItemSheet({
  item,
  day,
  days,
  dayItems,
  scheduleId,
  subjects,
  onClose,
}: {
  item: DbRow | 'new' | null;
  day?: string;
  days: string[];
  dayItems: DbRow[];
  scheduleId?: string;
  subjects: DbRow[];
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [mins, setMins] = useState('45');
  const [subject, setSubject] = useState<string | null>(null);
  const [target, setTarget] = useState<string | undefined>(day);
  const [shown, setShown] = useState<string | null>(null);
  const key = item === 'new' ? 'new' : item?.id ?? null;
  if (item && shown !== key) {
    setShown(key);
    setTitle(item === 'new' ? '' : item.title);
    setMins(String(item === 'new' ? 45 : item.minutes));
    setSubject(item === 'new' ? subjects[0]?.id ?? null : item.subject_id);
    setTarget(item === 'new' ? day : item.day);
  }
  if (!item || !scheduleId) return null;
  const close = () => (onClose(), setShown(null));
  const save = () => {
    if (!title.trim()) return;
    const v = { title: title.trim(), minutes: Math.max(5, Number(mins) || 45), subject_id: subject, day: target ?? day };
    if (item === 'new') insert('study_schedule_items', { ...v, schedule_id: scheduleId, kind: 'custom', status: 'pending', sort_order: dayItems.length });
    else update('study_schedule_items', item.id, { ...v, sort_order: v.day !== item.day ? 999 : item.sort_order });
    close();
  };
  const shift = (dir: -1 | 1) => {
    if (item === 'new') return;
    const i = dayItems.findIndex((x) => x.id === item.id);
    const j = i + dir;
    if (j < 0 || j >= dayItems.length) return;
    update('study_schedule_items', item.id, { sort_order: dayItems[j].sort_order });
    update('study_schedule_items', dayItems[j].id, { sort_order: item.sort_order });
  };
  return (
    <Sheet visible onClose={close} title={item === 'new' ? 'مهمة جديدة لليوم' : 'تعديل المهمة'}>
      <Field label="العنوان" value={title} onChangeText={setTitle} />
      {subjects.length > 0 && <Chips value={subject} onChange={setSubject} options={subjects.map((s) => ({ label: s.name, value: s.id }))} />}
      <Field label="المدة (دقيقة)" keyboardType="number-pad" value={mins} onChangeText={setMins} />
      <T size={13} sub>
        اليوم
      </T>
      <Chips value={target ?? null} onChange={setTarget} options={days.map((d) => ({ label: `${weekdayShort[parseYmd(d).getDay()]} ${parseYmd(d).getDate()}`, value: d }))} />
      <Btn title="حفظ" onPress={save} />
      {item !== 'new' && (
        <>
          <Row>
            <Btn style={{ flex: 1 }} kind="ghost" icon="arrow-up" title="قدّم" onPress={() => shift(-1)} />
            <Btn style={{ flex: 1 }} kind="ghost" icon="arrow-down" title="أخّر" onPress={() => shift(1)} />
          </Row>
          <Btn kind="danger" title="حذف" onPress={() => (remove('study_schedule_items', item.id), close())} />
        </>
      )}
    </Sheet>
  );
}
