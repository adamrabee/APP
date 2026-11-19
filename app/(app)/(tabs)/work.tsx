import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Image, Linking, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { art } from '@/components/mee';
import { Bar, Btn, Card, Check, Chips, confirm, Empty, Field, IconBtn, Pill, Row, Sheet, T } from '@/components/ui';
import { logActivity, toggleWorkTask } from '@/lib/actions';
import { addDays, cleanYmd, durationLabel, shortLabel, today } from '@/lib/dates';
import { get, insert, remove, update, upsertOwn, useNow, useOwn, useQuery, type Row as DbRow } from '@/lib/db';
import { useTheme } from '@/lib/theme';

type Area = 'home' | 'inbox' | 'tasks' | 'projects' | 'notes';
const areas: { value: Area; label: string; icon: any }[] = [
  { value: 'home', label: 'الرئيسية', icon: 'home-outline' },
  { value: 'inbox', label: 'الوارد', icon: 'file-tray-outline' },
  { value: 'tasks', label: 'المهام', icon: 'checkbox-outline' },
  { value: 'projects', label: 'المشاريع', icon: 'folder-outline' },
  { value: 'notes', label: 'الملاحظات', icon: 'document-text-outline' },
];

/** Work keeps its own neutral grey palette in the design. */
const W = { bg: '#F6F6F6', ink: '#1F1F1F', sub: '#6B6B6B', soft: '#F1F1F1', line: '#ECECEC', tab: '#7A7A7A', rule: '#E6E4E0' };

/** §4.12 Work: 4 areas + a home page. Starts empty. */
export default function Work() {
  const [area, setArea] = useState<Area>('home');
  const [quick, setQuick] = useState(false);
  const [search, setSearch] = useState(false);
  const { c, mode } = useTheme();
  const bg = mode === 'dark' ? c.bg : W.bg;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={['top']}>
      <ScrollView keyboardShouldPersistTaps="handled" stickyHeaderIndices={[1]} contentContainerStyle={{ paddingBottom: 130 }}>
        <View style={{ paddingHorizontal: 18, paddingTop: 12, gap: 12 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Pressable onPress={() => router.navigate('/')} style={boxStyle(c, mode)}>
              <Ionicons name="home-outline" size={20} color={c.text} />
            </Pressable>
            <View style={[boxStyle(c, mode), { width: undefined, flexDirection: 'row', alignItems: 'center' }]}>
              <Pressable onPress={() => setSearch(true)} style={{ width: 46, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="search" size={19} color={c.text} />
              </Pressable>
              <View style={{ width: 1, height: 22, backgroundColor: '#DEDEDE' }} />
              <Pressable onPress={() => setQuick(true)} style={{ width: 46, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="ellipsis-horizontal" size={19} color={c.text} />
              </Pressable>
            </View>
          </Row>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View style={{ gap: 2 }}>
              <T size={40} w="bold" lh={1.1} style={{ letterSpacing: -0.5 }}>
                الشغل
              </T>
              <T size={15} w="medium" color={W.sub}>
                خطّط. نفّذ. أنجز.
              </T>
            </View>
            <Image source={art.work} style={{ width: 170, height: 80 }} resizeMode="contain" />
          </Row>
        </View>
        <View style={{ backgroundColor: bg, paddingHorizontal: 18 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 2, borderBottomWidth: 1, borderBottomColor: W.rule }}>
            {areas.map((a) => {
              const on = area === a.value;
              return (
                <Pressable key={a.value} onPress={() => setArea(a.value)} style={{ minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderBottomWidth: 2, borderBottomColor: on ? c.text : 'transparent' }}>
                  <Ionicons name={a.icon} size={16} color={on ? c.text : W.tab} />
                  <T size={14} w={on ? 'bold' : 'medium'} color={on ? c.text : W.tab}>
                    {a.label}
                  </T>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
        <View style={{ paddingHorizontal: 18, paddingTop: 14, gap: 14 }}>
          {area === 'home' && <Home go={setArea} />}
          {area === 'inbox' && <Inbox />}
          {area === 'tasks' && <TaskColumns />}
          {area === 'projects' && <Projects />}
          {area === 'notes' && <Notes />}
        </View>
      </ScrollView>
      <QuickAdd visible={quick} onClose={() => setQuick(false)} />
      <Search visible={search} onClose={() => setSearch(false)} />
    </SafeAreaView>
  );
}

const boxStyle = (c: any, mode: string) => ({
  width: 46,
  height: 46,
  borderRadius: 16,
  backgroundColor: mode === 'dark' ? c.card : W.soft,
  borderWidth: 1,
  borderColor: mode === 'dark' ? c.border : '#E9E9E9',
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
});

/** White bordered section card used across the Work tab. */
function WCard({ title, icon, onAll, children, gap = 12 }: { title?: string; icon?: any; onAll?: () => void; children: ReactNode; gap?: number }) {
  const { c, mode } = useTheme();
  return (
    <View style={{ backgroundColor: c.card, borderWidth: 1, borderColor: mode === 'dark' ? c.border : W.line, borderRadius: 24, padding: 16, gap, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 1 }}>
      {title ? (
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={8}>
            {icon ? <Ionicons name={icon} size={18} color={c.text} /> : null}
            <T size={18} w="bold">
              {title}
            </T>
          </Row>
          {onAll ? (
            <T size={13} color="#4A4A4A" onPress={onAll}>
              الكل ‹
            </T>
          ) : null}
        </Row>
      ) : null}
      {children}
    </View>
  );
}

// ───────── shared ─────────
function PriorityDot({ p }: { p: string }) {
  const { c } = useTheme();
  // WK-08: high = black · medium = grey · normal = outline
  return <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p === 'high' ? c.ink : p === 'med' ? c.faint : 'transparent', borderWidth: p === 'low' ? 1.5 : 0, borderColor: c.faint }} />;
}

function useTimer() {
  const state = useOwn('work_state');
  const now = useNow(1000);
  const running = state?.timer_task_id && state.timer_started_at ? { id: state.timer_task_id as string, since: new Date(state.timer_started_at).getTime() } : null;
  const elapsed = running ? Math.round((now.getTime() - running.since) / 1000) : 0;
  return {
    running,
    elapsed,
    // WK-11: one timer at a time; switching saves the previous one
    start(t: DbRow) {
      stopTimer();
      upsertOwn('work_state', { timer_task_id: t.id, timer_started_at: new Date().toISOString() });
    },
    stop: stopTimer,
  };
  function stopTimer() {
    if (running) {
      const t = get('work_tasks', running.id);
      if (t) update('work_tasks', t.id, { tracked_seconds: (t.tracked_seconds ?? 0) + Math.round((Date.now() - running.since) / 1000) });
      upsertOwn('work_state', { timer_task_id: null, timer_started_at: null });
    }
  }
}

function TaskRow({ t, onPress }: { t: DbRow; onPress?: () => void }) {
  const { c } = useTheme();
  const timer = useTimer();
  const live = timer.running?.id === t.id;
  const secs = (t.tracked_seconds ?? 0) + (live ? timer.elapsed : 0);
  const project = get('work_projects', t.project_id);
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 }}>
      <Check on={t.done} onPress={() => toggleWorkTask(t)} />
      <PriorityDot p={t.priority} />
      <View style={{ flex: 1 }}>
        <T w="medium" strike={t.done}>
          {t.title}
        </T>
        <T size={11} sub>
          {[t.due_date ? (t.due_date < today() && !t.done ? `متأخرة · ${shortLabel(t.due_date)}` : shortLabel(t.due_date)) : null, project?.name, t.repeat !== 'none' ? '🔁' : null, secs ? durationLabel(secs * 1000) : null].filter(Boolean).join(' · ')}
        </T>
      </View>
      {!t.done && <IconBtn name={live ? 'pause-circle' : 'play-circle-outline'} color={live ? c.primary : c.sub} onPress={() => (live ? timer.stop() : timer.start(t))} />}
    </Pressable>
  );
}

// ───────── home (WK-01, WK-07, WK-12, WK-13) ─────────
function Home({ go }: { go: (a: Area) => void }) {
  const { c, mode } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const d = today();
  const inbox = useQuery('work_inbox', (i) => !i.archived, (a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const tasks = useQuery('work_tasks', undefined, (a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'));
  const projects = useQuery('work_projects', (p) => !p.archived);
  const notes = useQuery('work_notes', undefined, (a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  const activity = useQuery('work_activity', undefined, (a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const state = useOwn('work_state');
  const timer = useTimer();
  const [pickFocus, setPickFocus] = useState(false);
  const focus = get('work_tasks', state?.focus_task_id);
  const todayTasks = tasks.filter((t) => !t.done && t.due_date && t.due_date <= d);
  const upcoming = tasks.filter((t) => !t.done && (!t.due_date || t.due_date > d));
  const progress = (p: DbRow) => {
    const pt = tasks.filter((t) => t.project_id === p.id);
    return pt.length ? pt.filter((t) => t.done).length / pt.length : 0;
  };
  const stats: { label: string; value: number; icon: any; go: Area }[] = [
    { label: 'الوارد', value: inbox.length, icon: 'file-tray-outline', go: 'inbox' },
    { label: 'مهام النهارده', value: todayTasks.length, icon: 'today-outline', go: 'tasks' },
    { label: 'المهام الجاية', value: upcoming.length, icon: 'calendar-outline', go: 'tasks' },
    { label: 'مشاريع شغالة', value: projects.length, icon: 'folder-open-outline', go: 'projects' },
  ];

  return (
    <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {stats.map((s) => (
          <Pressable
            key={s.label}
            onPress={() => go(s.go)}
            style={{ width: wide ? '23.5%' : '48.4%', backgroundColor: c.card, borderWidth: 1, borderColor: mode === 'dark' ? c.border : W.line, borderRadius: 22, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}
          >
            <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: mode === 'dark' ? c.bg : '#F0F0F0', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={s.icon} size={20} color={c.text} />
            </View>
            <View style={{ flex: 1 }}>
              <T size={24} w="bold" lh={1.1}>
                {s.value}
              </T>
              <T size={12} color={W.sub} lines={1}>
                {s.label}
              </T>
            </View>
          </Pressable>
        ))}
      </View>

      <WCard title="ركّز على" icon="locate-outline">
        {focus && !focus.done ? (
          <View style={{ gap: 10 }}>
            <T size={17} w="bold">
              {focus.title}
            </T>
            <Row>
              <Btn
                small
                title={timer.running?.id === focus.id ? durationLabel(timer.elapsed * 1000) : 'ابدأ دلوقتي'}
                icon={timer.running?.id === focus.id ? 'pause' : 'play'}
                onPress={() => (timer.running?.id === focus.id ? timer.stop() : timer.start(focus))}
              />
              <Btn small kind="ghost" title="خلصت" icon="checkmark" onPress={() => (toggleWorkTask(focus), upsertOwn('work_state', { focus_task_id: null }))} />
              <IconBtn name="swap-horizontal" onPress={() => setPickFocus(true)} />
            </Row>
          </View>
        ) : (
          <Pressable onPress={() => setPickFocus(true)} style={{ borderRadius: 18, backgroundColor: mode === 'dark' ? c.bg : '#F4F4F4', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#DADADA', padding: 16 }}>
            <T size={13} color={W.sub} lh={1.7}>
              مفيش مهمة تركيز.{'\n'}اضغط هنا واختار مهمة واحدة تركّز عليها.
            </T>
          </Pressable>
        )}
      </WCard>

      <WCard title="مهام النهارده" icon="checkbox-outline" onAll={() => go('tasks')} gap={4}>
        {todayTasks.length === 0 ? (
          <T size={13} color={W.sub}>
            مفيش مهام النهارده.
          </T>
        ) : (
          todayTasks.slice(0, 6).map((t) => <TaskRow key={t.id} t={t} />)
        )}
      </WCard>

      <WCard title="الوارد" icon="file-tray-outline" onAll={() => go('inbox')} gap={4}>
        {inbox.length === 0 ? (
          <T size={13} color={W.sub} style={{ paddingVertical: 6 }}>
            الوارد فاضي. اضغط ⋯ فوق أو + عشان تسجّل أي حاجة.
          </T>
        ) : (
          inbox.slice(0, 4).map((i) => (
            <T key={i.id} size={14} lines={1} style={{ paddingVertical: 6 }}>
              • {i.text}
            </T>
          ))
        )}
      </WCard>

      <WCard title="المشاريع" icon="folder-outline" onAll={() => go('projects')}>
        {projects.length === 0 && (
          <T size={13} color={W.sub}>
            مفيش مشاريع لسه.
          </T>
        )}
        {projects.slice(0, 4).map((p) => (
          <Pressable key={p.id} onPress={() => go('projects')} style={{ gap: 6 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T w="semibold">{p.name}</T>
              <T size={12} color={W.sub}>
                {Math.round(progress(p) * 100)}%
              </T>
            </Row>
            <Bar value={progress(p)} color={c.text} />
          </Pressable>
        ))}
      </WCard>

      <WCard title="الملاحظات" icon="document-text-outline" onAll={() => go('notes')}>
        {notes.length === 0 ? (
          <T size={13} color={W.sub}>
            مفيش ملاحظات لسه.
          </T>
        ) : (
          notes.slice(0, 3).map((n) => (
            <T key={n.id} size={14} lines={1}>
              {n.title || n.body}
            </T>
          ))
        )}
      </WCard>

      <WCard title="آخر حاجات" icon="time-outline" gap={6}>
        {activity.length === 0 && (
          <T size={13} color={W.sub}>
            لسه مفيش نشاط.
          </T>
        )}
        {activity.slice(0, 8).map((a) => (
          <Row key={a.id}>
            <T size={13} style={{ flex: 1 }} lines={1}>
              {a.text}
            </T>
            <T size={11} color={W.sub}>
              {shortLabel(String(a.created_at).slice(0, 10))}
            </T>
          </Row>
        ))}
      </WCard>

      <Sheet visible={pickFocus} onClose={() => setPickFocus(false)} title="مهمة التركيز">
        {tasks.filter((t) => !t.done).length === 0 && <T sub>ضيف مهام الأول.</T>}
        {tasks
          .filter((t) => !t.done)
          .map((t) => (
            <Pressable key={t.id} onPress={() => (upsertOwn('work_state', { focus_task_id: t.id }), setPickFocus(false))} style={{ paddingVertical: 10 }}>
              <T w={state?.focus_task_id === t.id ? 'bold' : 'regular'}>{t.title}</T>
            </Pressable>
          ))}
      </Sheet>
    </>
  );
}

// ───────── inbox (WK-02) ─────────
function Inbox() {
  const [text, setText] = useState('');
  const [convert, setConvert] = useState<DbRow | null>(null);
  const items = useQuery('work_inbox', (i) => !i.archived, (a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const add = () => {
    const t = text.trim();
    if (!t) return;
    insert('work_inbox', { text: t, kind: /^https?:\/\/\S+$/i.test(t) ? 'link' : 'task' });
    logActivity(`وارد: ${t}`, 'add');
    setText('');
  };
  const kindIcon: Record<string, any> = { task: 'checkbox-outline', idea: 'bulb-outline', link: 'link-outline', note: 'document-text-outline' };
  return (
    <>
      <Row>
        <View style={{ flex: 1 }}>
          <Field placeholder="سجّل أي حاجة… مهمة، فكرة، لينك" value={text} onChangeText={setText} onSubmitEditing={add} returnKeyType="done" />
        </View>
        <Btn small title="أضف" onPress={add} />
      </Row>
      {items.length === 0 && <Empty text="الوارد فاضي 👌" mood="happy" />}
      {items.map((i) => (
        <Card key={i.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name={kindIcon[i.kind] ?? 'ellipse-outline'} size={18} />
          <T style={{ flex: 1 }} onPress={i.kind === 'link' ? () => Linking.openURL(i.text).catch(() => {}) : undefined}>
            {i.text}
          </T>
          <Btn small kind="soft" title="حوّل" onPress={() => setConvert(i)} />
        </Card>
      ))}
      <Sheet visible={!!convert} onClose={() => setConvert(null)} title="تحويل">
        {convert && (
          <>
            <T>{convert.text}</T>
            <Btn
              icon="checkbox-outline"
              title="مهمة للنهارده"
              onPress={() => {
                insert('work_tasks', { title: convert.text, due_date: today() });
                update('work_inbox', convert.id, { archived: true });
                logActivity(`تحويل لمهمة: ${convert.text}`, 'convert');
                setConvert(null);
              }}
            />
            <Btn
              kind="soft"
              icon="checkbox-outline"
              title="مهمة بدون ميعاد"
              onPress={() => {
                insert('work_tasks', { title: convert.text });
                update('work_inbox', convert.id, { archived: true });
                logActivity(`تحويل لمهمة: ${convert.text}`, 'convert');
                setConvert(null);
              }}
            />
            <Btn
              kind="soft"
              icon="folder-outline"
              title="مشروع"
              onPress={() => {
                insert('work_projects', { name: convert.text });
                update('work_inbox', convert.id, { archived: true });
                logActivity(`تحويل لمشروع: ${convert.text}`, 'convert');
                setConvert(null);
              }}
            />
            <Btn
              kind="soft"
              icon="document-text-outline"
              title="ملاحظة"
              onPress={() => {
                insert('work_notes', { title: '', body: convert.text, updated_at: new Date().toISOString() });
                update('work_inbox', convert.id, { archived: true });
                logActivity(`تحويل لملاحظة: ${convert.text}`, 'convert');
                setConvert(null);
              }}
            />
            <Chips value={convert.kind} onChange={(k: string) => (update('work_inbox', convert.id, { kind: k }), setConvert({ ...convert, kind: k }))} options={[{ label: 'مهمة', value: 'task' }, { label: 'فكرة', value: 'idea' }, { label: 'لينك', value: 'link' }, { label: 'ملاحظة', value: 'note' }]} />
            <Btn kind="ghost" icon="archive-outline" title="أرشفة" onPress={() => (update('work_inbox', convert.id, { archived: true }), logActivity(`أرشفة: ${convert.text}`, 'archive'), setConvert(null))} />
          </>
        )}
      </Sheet>
    </>
  );
}

// ───────── tasks: 3 columns (WK-03) ─────────
function TaskColumns() {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const d = today();
  const tasks = useQuery('work_tasks', undefined, (a, b) => prio(a) - prio(b) || (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'));
  const [edit, setEdit] = useState<DbRow | 'new' | null>(null);
  const cols = [
    { key: 'today', label: 'النهارده', list: tasks.filter((t) => !t.done && t.due_date && t.due_date <= d) },
    { key: 'next', label: 'الجاي وبدون ميعاد', list: tasks.filter((t) => !t.done && (!t.due_date || t.due_date > d)) },
    { key: 'done', label: 'خلصت', list: tasks.filter((t) => t.done).sort((a, b) => String(b.done_at).localeCompare(String(a.done_at))).slice(0, 30) },
  ];
  return (
    <>
      <Btn kind="soft" icon="add" title="مهمة جديدة" onPress={() => setEdit('new')} />
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 14 }}>
        {cols.map((col) => (
          <View key={col.key} style={{ flex: 1, gap: 8 }}>
            <T size={13} sub w="semibold">
              {col.label} · {col.list.length}
            </T>
            <Card style={{ gap: 0, paddingVertical: 6 }}>
              {col.list.length === 0 && <T sub>—</T>}
              {col.list.map((t) => (
                <TaskRow key={t.id} t={t} onPress={() => setEdit(t)} />
              ))}
            </Card>
          </View>
        ))}
      </View>
      <TaskSheet task={edit} onClose={() => setEdit(null)} />
    </>
  );
}
const prio = (t: DbRow) => ({ high: 0, med: 1, low: 2 })[t.priority as 'high'] ?? 2;

function TaskSheet({ task, onClose, projectId }: { task: DbRow | 'new' | null; onClose: () => void; projectId?: string }) {
  const projects = useQuery('work_projects', (p) => !p.archived);
  const [v, setV] = useState({ title: '', description: '', priority: 'low', due: '', project: null as string | null, repeat: 'none' });
  const [shown, setShown] = useState<string | null>(null);
  const key = task === 'new' ? 'new' : task?.id ?? null;
  if (task && shown !== key) {
    setShown(key);
    setV(
      task === 'new'
        ? { title: '', description: '', priority: 'low', due: today(), project: projectId ?? null, repeat: 'none' }
        : { title: task.title, description: task.description ?? '', priority: task.priority, due: task.due_date ?? '', project: task.project_id, repeat: task.repeat },
    );
  }
  if (!task) return null;
  const close = () => (onClose(), setShown(null));
  const save = () => {
    if (!v.title.trim()) return;
    const vals = { title: v.title.trim(), description: v.description || null, priority: v.priority, due_date: cleanYmd(v.due), project_id: v.project, repeat: v.repeat };
    if (task === 'new') {
      insert('work_tasks', vals);
      logActivity(`مهمة جديدة: ${vals.title}`, 'add');
    } else update('work_tasks', task.id, vals);
    close();
  };
  return (
    <Sheet visible onClose={close} title={task === 'new' ? 'مهمة شغل' : 'تعديل المهمة'}>
      <Field label="العنوان" value={v.title} onChangeText={(title) => setV({ ...v, title })} />
      <Field label="الوصف" multiline value={v.description} onChangeText={(description) => setV({ ...v, description })} />
      <Chips value={v.priority} onChange={(priority: string) => setV({ ...v, priority })} options={[{ label: 'عالية', value: 'high' }, { label: 'متوسطة', value: 'med' }, { label: 'عادية', value: 'low' }]} />
      <Chips value={v.due || 'none'} onChange={(due: string) => setV({ ...v, due: due === 'none' ? '' : due })} options={[{ label: 'النهارده', value: today() }, { label: 'بكرة', value: addDays(today(), 1) }, { label: 'بدون', value: 'none' }]} />
      <Field placeholder="أو تاريخ YYYY-MM-DD" value={v.due} onChangeText={(due) => setV({ ...v, due })} />
      {projects.length > 0 && <Chips value={v.project} onChange={(p: string) => setV({ ...v, project: v.project === p ? null : p })} options={projects.map((p) => ({ label: p.name, value: p.id }))} />}
      <Chips value={v.repeat} onChange={(repeat: string) => setV({ ...v, repeat })} options={[{ label: 'مرة واحدة', value: 'none' }, { label: 'يومي', value: 'daily' }, { label: 'أسبوعي', value: 'weekly' }, { label: 'شهري', value: 'monthly' }]} />
      <Btn title="حفظ" onPress={save} />
      {task !== 'new' && <Btn kind="danger" title="حذف" onPress={() => confirm('تحذف المهمة؟', () => (remove('work_tasks', task.id), close()))} />}
    </Sheet>
  );
}

// ───────── projects (WK-04) ─────────
function Projects() {
  const { c } = useTheme();
  const [showArchived, setShowArchived] = useState(false);
  const projects = useQuery('work_projects', (p) => !!p.archived === showArchived, (a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'), [showArchived]);
  const tasks = useQuery('work_tasks');
  const [open, setOpen] = useState<DbRow | 'new' | null>(null);
  return (
    <>
      <Row>
        <Btn style={{ flex: 1 }} kind="soft" icon="add" title="مشروع جديد" onPress={() => setOpen('new')} />
        <Btn small kind="ghost" title={showArchived ? 'الشغالة' : 'الأرشيف'} onPress={() => setShowArchived(!showArchived)} />
      </Row>
      {projects.length === 0 && <Empty text="مفيش مشاريع هنا." mood="calm" />}
      {projects.map((p) => {
        const pt = tasks.filter((t) => t.project_id === p.id);
        const done = pt.filter((t) => t.done).length;
        return (
          <Card key={p.id} onPress={() => setOpen(p)}>
            <Row>
              <T w="bold" style={{ flex: 1 }}>
                {p.name}
              </T>
              {p.deadline && <T size={12} color={p.deadline < today() ? c.danger : c.sub}>{shortLabel(p.deadline)}</T>}
            </Row>
            {p.description ? (
              <T size={13} sub lines={2}>
                {p.description}
              </T>
            ) : null}
            <Bar value={pt.length ? done / pt.length : 0} color={c.ink} />
            <T size={12} sub>
              {done}/{pt.length} مهمة
            </T>
          </Card>
        );
      })}
      <ProjectSheet project={open} onClose={() => setOpen(null)} />
    </>
  );
}

function ProjectSheet({ project, onClose }: { project: DbRow | 'new' | null; onClose: () => void }) {
  const [v, setV] = useState({ name: '', description: '', notes: '', deadline: '' });
  const [shown, setShown] = useState<string | null>(null);
  const [newTask, setNewTask] = useState<'new' | null>(null);
  const pid = project && project !== 'new' ? project.id : null;
  const tasks = useQuery('work_tasks', (t) => t.project_id === pid, (a, b) => Number(a.done) - Number(b.done), [pid]);
  const key = project === 'new' ? 'new' : project?.id ?? null;
  if (project && shown !== key) {
    setShown(key);
    setV(project === 'new' ? { name: '', description: '', notes: '', deadline: '' } : { name: project.name, description: project.description ?? '', notes: project.notes ?? '', deadline: project.deadline ?? '' });
  }
  if (!project) return null;
  const close = () => (onClose(), setShown(null));
  const save = () => {
    if (!v.name.trim()) return;
    const vals = { name: v.name.trim(), description: v.description || null, notes: v.notes || null, deadline: cleanYmd(v.deadline) };
    if (project === 'new') {
      insert('work_projects', vals);
      logActivity(`مشروع جديد: ${vals.name}`, 'add');
    } else update('work_projects', project.id, vals);
    close();
  };
  return (
    <Sheet visible onClose={close} title={project === 'new' ? 'مشروع جديد' : v.name}>
      <Field label="الاسم" value={v.name} onChangeText={(name) => setV({ ...v, name })} />
      <Field label="الوصف" value={v.description} onChangeText={(description) => setV({ ...v, description })} />
      <Field label="الديدلاين YYYY-MM-DD" value={v.deadline} onChangeText={(deadline) => setV({ ...v, deadline })} />
      <Field label="ملاحظات" multiline value={v.notes} onChangeText={(notes) => setV({ ...v, notes })} />
      <Btn title="حفظ" onPress={save} />
      {project !== 'new' && (
        <>
          <T w="semibold">المهام</T>
          {tasks.map((t) => (
            <TaskRow key={t.id} t={t} />
          ))}
          <Btn small kind="soft" icon="add" title="مهمة للمشروع" onPress={() => setNewTask('new')} />
          <Row>
            <Btn style={{ flex: 1 }} kind="ghost" icon={project.archived ? 'arrow-undo-outline' : 'archive-outline'} title={project.archived ? 'رجوع من الأرشيف' : 'أرشفة'} onPress={() => (update('work_projects', project.id, { archived: !project.archived }), logActivity(`أرشفة مشروع: ${project.name}`, 'archive'), close())} />
            <Btn
              style={{ flex: 1 }}
              kind="danger"
              title="حذف"
              onPress={() =>
                confirm('تحذف المشروع؟ المهام هتتفصل عنه ومش هتتحذف.', () => {
                  for (const t of tasks) update('work_tasks', t.id, { project_id: null });
                  remove('work_projects', project.id);
                  close();
                })
              }
            />
          </Row>
          <TaskSheet task={newTask} projectId={project.id} onClose={() => setNewTask(null)} />
        </>
      )}
    </Sheet>
  );
}

// ───────── notes (WK-05) ─────────
function Notes() {
  const notes = useQuery('work_notes', undefined, (a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  const [open, setOpen] = useState<DbRow | 'new' | null>(null);
  const [v, setV] = useState({ title: '', body: '' });
  const openNote = (n: DbRow | 'new') => (setOpen(n), setV(n === 'new' ? { title: '', body: '' } : { title: n.title, body: n.body }));
  const save = () => {
    if (open === 'new') {
      if (v.title.trim() || v.body.trim()) insert('work_notes', { ...v, updated_at: new Date().toISOString() });
    } else if (open) update('work_notes', open.id, v);
    setOpen(null);
  };
  return (
    <>
      <Btn kind="soft" icon="add" title="ملاحظة" onPress={() => openNote('new')} />
      {notes.length === 0 && <Empty text="مفيش ملاحظات." mood="calm" />}
      {notes.map((n) => (
        <Card key={n.id} onPress={() => openNote(n)} style={{ gap: 4 }}>
          <T w="semibold">{n.title || 'بدون عنوان'}</T>
          <T size={13} sub lines={2}>
            {n.body}
          </T>
          <T size={11} faint>
            {shortLabel(String(n.updated_at).slice(0, 10))}
          </T>
        </Card>
      ))}
      <Sheet visible={!!open} onClose={save} title="ملاحظة">
        <Field placeholder="العنوان" value={v.title} onChangeText={(title) => setV({ ...v, title })} />
        <Field multiline placeholder="اكتب…" value={v.body} onChangeText={(body) => setV({ ...v, body })} style={{ minHeight: 220 }} />
        <Btn title="حفظ" onPress={save} />
        {open && open !== 'new' && <Btn kind="danger" title="حذف" onPress={() => (remove('work_notes', open.id), setOpen(null))} />}
      </Sheet>
    </>
  );
}

// ───────── quick add (WK-06) + search (WK-09) ─────────
function QuickAdd({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [text, setText] = useState('');
  const go = (kind: 'inbox' | 'task' | 'note') => {
    const t = text.trim();
    if (!t) return;
    if (kind === 'inbox') insert('work_inbox', { text: t, kind: /^https?:\/\/\S+$/i.test(t) ? 'link' : 'task' });
    if (kind === 'task') insert('work_tasks', { title: t, due_date: today() });
    if (kind === 'note') insert('work_notes', { title: '', body: t, updated_at: new Date().toISOString() });
    logActivity(`إضافة: ${t}`, 'add');
    setText('');
    onClose();
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="إضافة سريعة للشغل">
      <Field autoFocus placeholder="اكتب…" value={text} onChangeText={setText} onSubmitEditing={() => go('inbox')} />
      <Row>
        <Btn style={{ flex: 1 }} title="للوارد" onPress={() => go('inbox')} />
        <Btn style={{ flex: 1 }} kind="soft" title="مهمة للنهارده" onPress={() => go('task')} />
        <Btn style={{ flex: 1 }} kind="soft" title="ملاحظة" onPress={() => go('note')} />
      </Row>
    </Sheet>
  );
}

function Search({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const s = q.trim();
  const tasks = useQuery('work_tasks', (t) => !!s && `${t.title} ${t.description ?? ''}`.includes(s), undefined, [s]);
  const projects = useQuery('work_projects', (p) => !!s && `${p.name} ${p.description ?? ''} ${p.notes ?? ''}`.includes(s), undefined, [s]);
  const notes = useQuery('work_notes', (n) => !!s && `${n.title} ${n.body}`.includes(s), undefined, [s]);
  const inbox = useQuery('work_inbox', (i) => !!s && i.text.includes(s), undefined, [s]);
  return (
    <Sheet visible={visible} onClose={onClose} title="بحث في الشغل">
      <Field autoFocus placeholder="ابحث…" value={q} onChangeText={setQ} />
      {[
        ['المهام', tasks.map((t) => t.title)],
        ['المشاريع', projects.map((p) => p.name)],
        ['الملاحظات', notes.map((n) => n.title || n.body)],
        ['الوارد', inbox.map((i) => i.text)],
      ].map(([label, list]) =>
        (list as string[]).length ? (
          <View key={label as string} style={{ gap: 4 }}>
            <T size={12} sub w="semibold">
              {label as string}
            </T>
            {(list as string[]).map((x, i) => (
              <T key={i} lines={1}>
                {x}
              </T>
            ))}
          </View>
        ) : null,
      )}
      {s && !tasks.length && !projects.length && !notes.length && !inbox.length && <T sub>مفيش نتائج.</T>}
    </Sheet>
  );
}
