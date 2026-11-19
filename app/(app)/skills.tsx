import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { art } from '@/components/mee';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { Btn, Check, Chips, confirm, Field, IconBtn, Ring, Row, Sheet, T } from '@/components/ui';
import { descendants } from '@/lib/actions';
import { skillIcons } from '@/lib/content';
import { cleanYmd, shortLabel, today } from '@/lib/dates';
import { get, insert, remove, rows, update, useQuery, useRows, type Row as DbRow } from '@/lib/db';
import { font, useTheme } from '@/lib/theme';

const NODE = 76;
const GAP_X = 104;
const GAP_Y = 150;
const PAD = 60;
type Status = 'none' | 'learning' | 'progress' | 'done';
const statusLabel: Record<Status, string> = { none: 'لم تبدأ', learning: 'بتتعلّم', progress: 'جاري', done: 'مكتمل' };

/** §4.11 Skill tree — starts with a single root "me"; the user builds everything. */
export default function Skills() {
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  const nodes = useRows('skill_nodes');
  const logs = useRows('skill_logs');
  useRows('skill_milestones');
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Status | 'all'>('all');

  // the root is created once, empty otherwise
  const root = nodes.find((n) => !n.parent_id);
  useEffect(() => {
    const t = setTimeout(() => {
      if (!rows('skill_nodes').some((n) => !n.parent_id)) insert('skill_nodes', { name: 'me', icon: 'person', parent_id: null });
    }, 1200); // give the first pull a moment so we don't create a duplicate root
    return () => clearTimeout(t);
  }, []);

  const kids = useMemo(() => {
    const m = new Map<string, DbRow[]>();
    for (const n of nodes) if (n.parent_id) (m.get(n.parent_id) ?? m.set(n.parent_id, []).get(n.parent_id)!).push(n);
    for (const l of m.values()) l.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    return m;
  }, [nodes]);

  // K-07: progress — manual, or average of children when `aggregate`
  const progressOf = useMemo(() => {
    const memo = new Map<string, number>();
    const f = (n: DbRow): number => {
      if (memo.has(n.id)) return memo.get(n.id)!;
      const ch = kids.get(n.id) ?? [];
      const v = n.aggregate && ch.length ? ch.reduce((s, x) => s + f(x), 0) / ch.length : Number(n.progress ?? 0);
      memo.set(n.id, v);
      return v;
    };
    return f;
  }, [kids]);
  // K-08: auto status from progress, or manual
  const statusOf = (n: DbRow): Status => {
    if (n.status && n.status !== 'auto') return n.status;
    const p = progressOf(n);
    return p >= 100 ? 'done' : p >= 50 ? 'progress' : p > 0 ? 'learning' : 'none';
  };
  const hoursOf = (id: string): number => logs.filter((l) => l.node_id === id).reduce((s, l) => s + Number(l.hours), 0) + (kids.get(id) ?? []).reduce((s, k) => s + hoursOf(k.id), 0);

  // tidy layout: leaves left→right, parents centered, root at the bottom (tree grows up)
  const layout = useMemo(() => {
    const pos = new Map<string, { x: number; depth: number }>();
    let leaf = 0;
    let maxDepth = 0;
    const walk = (n: DbRow, depth: number): number => {
      maxDepth = Math.max(maxDepth, depth);
      const ch = n.collapsed ? [] : kids.get(n.id) ?? [];
      let x: number;
      if (!ch.length) x = leaf++;
      else {
        const xs = ch.map((k) => walk(k, depth + 1));
        x = (xs[0] + xs[xs.length - 1]) / 2;
      }
      pos.set(n.id, { x, depth });
      return x;
    };
    if (root) walk(root, 0);
    const w = Math.max(1, leaf) * GAP_X + PAD * 2;
    const h = (maxDepth + 1) * GAP_Y + PAD * 2;
    const at = (id: string) => {
      const p = pos.get(id)!;
      return { cx: PAD + p.x * GAP_X + GAP_X / 2, cy: h - PAD - p.depth * GAP_Y - NODE / 2 };
    };
    return { pos, w, h, at };
  }, [root, kids]);

  // pan + pinch + buttons (K-16)
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const start = useSharedValue({ x: 0, y: 0, s: 1 });
  const viewH = height - 260;
  const fit = () => {
    const s = Math.min(1.2, Math.max(0.3, Math.min((width - 20) / layout.w, viewH / layout.h)));
    scale.value = withTiming(s);
    tx.value = withTiming((width - layout.w) / 2);
    ty.value = withTiming((viewH - layout.h) / 2);
  };
  useEffect(fit, [layout.w, layout.h]); // eslint-disable-line react-hooks/exhaustive-deps
  const pan = Gesture.Pan()
    .onStart(() => {
      start.value = { x: tx.value, y: ty.value, s: scale.value };
    })
    .onUpdate((e) => {
      tx.value = start.value.x + e.translationX;
      ty.value = start.value.y + e.translationY;
    });
  const pinch = Gesture.Pinch()
    .onStart(() => {
      start.value = { x: tx.value, y: ty.value, s: scale.value };
    })
    .onUpdate((e) => {
      scale.value = Math.min(2.5, Math.max(0.25, start.value.s * e.scale));
    });
  const canvasStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));
  const zoom = (k: number) => (scale.value = withTiming(Math.min(2.5, Math.max(0.25, scale.value * k))));
  const focusOn = (id: string) => {
    const { cx, cy } = layout.at(id);
    scale.value = withTiming(1);
    tx.value = withTiming(width / 2 - cx);
    ty.value = withTiming(viewH / 2 - cy);
  };

  // K-13 indicator
  const nonRoot = nodes.filter((n) => n.parent_id);
  const categories = nonRoot.filter((n) => (kids.get(n.id) ?? []).length > 0).length;
  const skills = nonRoot.length - categories;
  const completed = nonRoot.filter((n) => statusOf(n) === 'done').length;
  const overall = root ? ((kids.get(root.id) ?? []).length ? (kids.get(root.id) ?? []).reduce((s, k) => s + progressOf(k), 0) / (kids.get(root.id) ?? []).length : progressOf(root)) : 0;

  // K-17 search
  const pathOf = (n: DbRow) => {
    const out: string[] = [];
    let cur: DbRow | undefined = n;
    while (cur) (out.unshift(cur.name), (cur = get('skill_nodes', cur.parent_id)));
    return out.join(' ← ');
  };
  const results = q.trim() ? nodes.filter((n) => n.name.includes(q.trim())).slice(0, 6) : [];
  const reveal = (n: DbRow) => {
    let p = get('skill_nodes', n.parent_id);
    while (p) {
      if (p.collapsed) update('skill_nodes', p.id, { collapsed: false });
      p = get('skill_nodes', p.parent_id);
    }
    setQ('');
    setTimeout(() => focusOn(n.id), 350);
    setSelected(n.id);
  };

  const visible = nodes.filter((n) => layout.pos.has(n.id));

  const onlyRoot = nodes.filter((n) => n.parent_id).length === 0;
  const addCategory = () => {
    if (!root) return;
    const row = insert('skill_nodes', { parent_id: root.id, name: 'تصنيف جديد', icon: 'leaf', sort_order: (kids.get(root.id) ?? []).length });
    setSelected(row.id);
  };
  const dotFor: Record<string, string> = { all: '#FFFFFF', none: '#FAFAFA', learning: '#BDBDBD', progress: '#1F1F1F', done: '#1F1F1F' };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, gap: 10, backgroundColor: '#FFFFFF' }}>
        <Row gap={10}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/me'))} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#F4F4F4', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-forward" size={20} color="#1F1F1F" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <T size={22} w="bold" lh={1.2} color="#1F1F1F">
              شجرة المهارات
            </T>
            <T size={12} color="#6B6B6B">
              {categories} تصنيف · {skills} مهارة · {completed} مكتملة
            </T>
          </View>
          <Ring value={overall / 100} size={50} stroke={4} color="#1F1F1F" track="#EEEEEE">
            <T size={12} w="bold" color="#1F1F1F">
              {Math.round(overall)}%
            </T>
          </Ring>
        </Row>
        <View>
          <TextInput
            placeholder="ابحث عن مهارة"
            placeholderTextColor="#9A9A9A"
            value={q}
            onChangeText={setQ}
            style={{ height: 42, borderRadius: 14, backgroundColor: '#F4F4F4', paddingRight: 40, paddingLeft: 14, fontFamily: font.regular, fontSize: 14, color: '#1F1F1F', textAlign: 'right' }}
          />
          <Ionicons name="search" size={18} color="#8A8A8A" style={{ position: 'absolute', right: 14, top: 12 }} />
        </View>
        {results.map((n) => (
          <Pressable key={n.id} onPress={() => reveal(n)} style={{ paddingVertical: 4 }}>
            <T size={13} color="#1F1F1F">
              {n.name}{' '}
              <T size={11} color="#8A8A8A">
                {pathOf(n)}
              </T>
            </T>
          </Pressable>
        ))}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {[['all', 'الكل'] as const, ...(Object.keys(statusLabel) as Status[]).map((s) => [s, statusLabel[s]] as const)].map(([v, label]) => {
            const on = filter === v;
            return (
              <Pressable key={v} onPress={() => setFilter(v as any)} style={{ minHeight: 34, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: on ? '#1F1F1F' : '#E5E5E5', backgroundColor: on ? '#1F1F1F' : '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dotFor[v], borderWidth: 1, borderColor: '#BDBDBD' }} />
                <T size={12} w="semibold" color={on ? '#FFFFFF' : '#1F1F1F'}>
                  {label}
                </T>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={{ flex: 1, overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
        <GestureDetector gesture={Gesture.Simultaneous(pan, pinch)}>
          <View style={{ flex: 1 }}>
            <Animated.View style={[{ width: layout.w, height: layout.h, direction: 'ltr', transformOrigin: 'top left' } as any, canvasStyle]}>
              <Svg width={layout.w} height={layout.h} style={{ position: 'absolute' }}>
                {visible
                  .filter((n) => n.parent_id && layout.pos.has(n.parent_id))
                  .map((n) => {
                    const a = layout.at(n.parent_id);
                    const b = layout.at(n.id);
                    const y1 = a.cy - NODE / 2;
                    const y2 = b.cy + NODE / 2;
                    const mid = (y1 + y2) / 2;
                    const dim = filter !== 'all' && statusOf(n) !== filter;
                    return <Path key={n.id} d={`M${a.cx},${y1} C${a.cx},${mid} ${b.cx},${mid} ${b.cx},${y2}`} stroke="#D6D6D6" strokeWidth={2.5} fill="none" opacity={dim ? 0.25 : 1} />;
                  })}
              </Svg>
              {visible.map((n) => {
                const { cx, cy } = layout.at(n.id);
                const st = statusOf(n);
                const p = progressOf(n);
                const hidden = n.collapsed ? descendants(n.id).length : 0;
                const dim = filter !== 'all' && st !== filter;
                return (
                  <Animated.View key={n.id} entering={FadeIn} layout={LinearTransition} style={{ position: 'absolute', left: cx - (GAP_X - 4) / 2, top: cy - NODE / 2, width: GAP_X - 4, alignItems: 'center', gap: 6, opacity: dim ? 0.25 : 1 }}>
                    <Pressable onPress={() => setSelected(n.id)} onLongPress={() => (kids.get(n.id) ?? []).length && update('skill_nodes', n.id, { collapsed: !n.collapsed })}>
                      <NodeBox status={st} progress={p} icon={n.icon} selected={selected === n.id} root={!n.parent_id} />
                      {hidden > 0 && (
                        <View style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#1F1F1F', borderRadius: 10, paddingHorizontal: 6 }}>
                          <T size={10} color="#FFFFFF">
                            +{hidden}
                          </T>
                        </View>
                      )}
                    </Pressable>
                    <T size={12} w="semibold" center lines={2} lh={1.3} color="#1F1F1F">
                      {n.parent_id ? n.name : 'me'}
                    </T>
                    {!n.parent_id && (
                      <T size={11} color="#6B6B6B">
                        {Math.round(overall)}% إجمالي
                      </T>
                    )}
                  </Animated.View>
                );
              })}
            </Animated.View>
          </View>
        </GestureDetector>

        {onlyRoot && (
          <View pointerEvents="none" style={{ position: 'absolute', top: 30, left: 24, right: 24, alignItems: 'center', gap: 8 }}>
            <Image source={art.skillTree} style={{ width: 110, height: 130 }} resizeMode="contain" />
            <T size={17} w="bold" color="#1F1F1F">
              شجرتك لسه بذرة
            </T>
            <T size={13} color="#6B6B6B" center lh={1.6}>
              ابدأ بأول تصنيف، وبعدين ضيف تحته فروع ومهارات بالشكل اللي يناسبك.
            </T>
          </View>
        )}

        <View style={{ position: 'absolute', left: 14, bottom: 16, gap: 8 }}>
          {[
            ['+', () => zoom(1.25)],
            ['−', () => zoom(0.8)],
          ].map(([label, fn]) => (
            <Pressable key={label as string} onPress={fn as () => void} style={zoomBtn}>
              <T size={20} color="#1F1F1F">
                {label as string}
              </T>
            </Pressable>
          ))}
          <Pressable onPress={fit} style={zoomBtn}>
            <Ionicons name="scan-outline" size={18} color="#1F1F1F" />
          </Pressable>
        </View>
        <Pressable
          onPress={addCategory}
          style={{ position: 'absolute', right: 14, bottom: 16, minHeight: 48, paddingHorizontal: 18, borderRadius: 16, backgroundColor: '#1F1F1F', flexDirection: 'row', alignItems: 'center', gap: 6, shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 6 }}
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <T size={14} w="bold" color="#FFFFFF">
            تصنيف جديد
          </T>
        </Pressable>
      </View>

      <NodeSheet id={selected} onClose={() => setSelected(null)} kids={kids} progressOf={progressOf} statusOf={statusOf} hoursOf={hoursOf} onAdded={(id) => setSelected(id)} />
    </SafeAreaView>
  );
}

const zoomBtn = { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center' as const, justifyContent: 'center' as const, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 3 };

/**
 * K-12, design style: soft 3D tile (76px, r24).
 * not started = faded dashed · learning = grey ring · in progress = black ring · done = black tile + white icon.
 */
function NodeBox({ status, progress, icon, selected, root }: { status: Status; progress: number; icon?: string; selected?: boolean; root?: boolean }) {
  const done = status === 'done';
  const ring = status === 'learning' ? '#A8A8A8' : '#1F1F1F';
  const r = 30;
  const len = 2 * Math.PI * r;
  return (
    <View
      style={{
        width: NODE,
        height: NODE,
        borderRadius: 24,
        backgroundColor: done ? '#1F1F1F' : status === 'none' && !root ? '#FAFAFA' : '#F6F6F6',
        borderWidth: selected ? 2.5 : 1,
        borderStyle: status === 'none' && !root ? 'dashed' : 'solid',
        borderColor: selected ? '#4F6F5C' : status === 'none' && !root ? '#CFCFCF' : '#E6E6E6',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 10 },
        elevation: 4,
        opacity: status === 'none' && !root ? 0.85 : 1,
      }}
    >
      {!done && status !== 'none' && (
        <Svg width={NODE} height={NODE} style={{ position: 'absolute' }}>
          <Circle cx={NODE / 2} cy={NODE / 2} r={r} stroke="#ECECEC" strokeWidth={3} fill="none" />
          <Circle cx={NODE / 2} cy={NODE / 2} r={r} stroke={ring} strokeWidth={3} fill="none" strokeDasharray={`${len} ${len}`} strokeDashoffset={len * (1 - progress / 100)} strokeLinecap="round" transform={`rotate(-90 ${NODE / 2} ${NODE / 2})`} />
        </Svg>
      )}
      {root ? (
        <Image source={require('@/assets/design/logo.png')} style={{ width: 44, height: 44 }} />
      ) : (
        <Ionicons name={(icon as any) || 'ellipse-outline'} size={26} color={done ? '#FFFFFF' : status === 'none' ? '#A3A3A3' : '#1F1F1F'} />
      )}
    </View>
  );
}

function NodeSheet({
  id,
  onClose,
  kids,
  progressOf,
  statusOf,
  hoursOf,
  onAdded,
}: {
  id: string | null;
  onClose: () => void;
  kids: Map<string, DbRow[]>;
  progressOf: (n: DbRow) => number;
  statusOf: (n: DbRow) => Status;
  hoursOf: (id: string) => number;
  onAdded: (id: string) => void;
}) {
  const { c } = useTheme();
  const n = get('skill_nodes', id);
  const [childName, setChildName] = useState('');
  const [hours, setHours] = useState('');
  const [logNote, setLogNote] = useState('');
  const [ms, setMs] = useState('');
  const [moving, setMoving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', goal: '', notes: '', target: '' });
  const [shown, setShown] = useState<string | null>(null);
  const logs = useQuery('skill_logs', (l) => l.node_id === id, (a, b) => b.logged_at.localeCompare(a.logged_at), [id]);
  const milestones = useQuery('skill_milestones', (m) => m.node_id === id, (a, b) => a.sort_order - b.sort_order, [id]);
  if (n && shown !== n.id) {
    setShown(n.id);
    setForm({ name: n.name, description: n.description ?? '', goal: n.goal ?? '', notes: n.notes ?? '', target: n.target_date ?? '' });
    setMoving(false);
  }
  if (!n) return null;
  const isRoot = !n.parent_id;
  const ch = kids.get(n.id) ?? [];
  const siblings = n.parent_id ? kids.get(n.parent_id) ?? [] : [];
  const close = () => {
    update('skill_nodes', n.id, { name: form.name.trim() || n.name, description: form.description || null, goal: form.goal || null, notes: form.notes || null, target_date: cleanYmd(form.target) });
    setShown(null);
    onClose();
  };
  const addChild = () => {
    if (!childName.trim()) return;
    if (n.collapsed) update('skill_nodes', n.id, { collapsed: false });
    const row = insert('skill_nodes', { parent_id: n.id, name: childName.trim(), sort_order: ch.length, icon: 'leaf' });
    setChildName('');
    onAdded(row.id);
    setShown(null);
  };
  const reorder = (dir: -1 | 1) => {
    const i = siblings.findIndex((x) => x.id === n.id);
    const o = siblings[i + dir];
    if (!o) return;
    siblings.forEach((s, k) => s.sort_order !== k && update('skill_nodes', s.id, { sort_order: k }));
    update('skill_nodes', n.id, { sort_order: i + dir });
    update('skill_nodes', o.id, { sort_order: i });
  };
  const forbidden = new Set([n.id, ...descendants(n.id)]);
  const parents = rows('skill_nodes').filter((x) => !forbidden.has(x.id));
  const st = statusOf(n);

  return (
    <Sheet visible onClose={close} title={isRoot ? 'me' : n.name}>
      <Row>
        <T w="bold" style={{ flex: 1 }}>
          {Math.round(progressOf(n))}% · {statusLabel[st]}
        </T>
        <T size={12} sub>
          {Math.round(hoursOf(n.id) * 10) / 10} ساعة تعلّم
        </T>
      </Row>
      <Row>
        <View style={{ flex: 1 }}>
          <Field placeholder="فرع جديد…" value={childName} onChangeText={setChildName} onSubmitEditing={addChild} />
        </View>
        <Btn small title="أضف فرع" onPress={addChild} />
      </Row>

      {!isRoot && <Field label="الاسم" value={form.name} onChangeText={(name) => setForm({ ...form, name })} />}
      <Field label="الوصف" value={form.description} onChangeText={(description) => setForm({ ...form, description })} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {skillIcons.map((i) => (
          <Pressable key={i} onPress={() => update('skill_nodes', n.id, { icon: i })} style={{ width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: n.icon === i ? c.ink : c.bg }}>
            <Ionicons name={i as any} size={18} color={n.icon === i ? c.onInk : c.text} />
          </Pressable>
        ))}
      </View>

      <T size={13} sub>
        التقدّم
      </T>
      {ch.length > 0 && <Chips value={!!n.aggregate} onChange={(v: boolean) => update('skill_nodes', n.id, { aggregate: v })} options={[{ label: 'يدوي', value: false as any }, { label: 'متوسط الفروع', value: true as any }]} />}
      {!(n.aggregate && ch.length) && (
        <Row>
          {[0, 25, 50, 75, 100].map((p) => (
            <Btn key={p} small kind={Number(n.progress) === p ? 'ink' : 'ghost'} title={`${p}`} onPress={() => update('skill_nodes', n.id, { progress: p })} />
          ))}
        </Row>
      )}
      <T size={13} sub>
        الحالة
      </T>
      <Chips
        value={n.status ?? 'auto'}
        onChange={(v: string) => update('skill_nodes', n.id, { status: v })}
        options={[{ label: 'تلقائي', value: 'auto' }, ...(Object.keys(statusLabel) as Status[]).map((s) => ({ label: statusLabel[s], value: s }))]}
      />
      <Field label="الهدف الشخصي" value={form.goal} onChangeText={(goal) => setForm({ ...form, goal })} />
      <Field label="تاريخ الهدف YYYY-MM-DD" value={form.target} onChangeText={(target) => setForm({ ...form, target })} />
      <Field label="ملاحظات" multiline value={form.notes} onChangeText={(notes) => setForm({ ...form, notes })} />

      <T w="semibold">سجل التعلّم</T>
      <Row>
        <View style={{ flex: 1 }}>
          <Field placeholder="ساعات" keyboardType="decimal-pad" value={hours} onChangeText={setHours} />
        </View>
        <View style={{ flex: 2 }}>
          <Field placeholder="عملت إيه؟" value={logNote} onChangeText={setLogNote} />
        </View>
        <Btn small title="سجّل" onPress={() => Number(hours) > 0 && (insert('skill_logs', { node_id: n.id, hours: Number(hours), note: logNote || null, logged_at: today() }), setHours(''), setLogNote(''))} />
      </Row>
      {logs.slice(0, 8).map((l) => (
        <Row key={l.id}>
          <T size={13} style={{ flex: 1 }}>
            {l.hours} س · {l.note ?? ''}
          </T>
          <T size={11} faint>
            {shortLabel(l.logged_at)}
          </T>
          <IconBtn name="close" size={16} onPress={() => remove('skill_logs', l.id)} />
        </Row>
      ))}

      <T w="semibold">مراحل وإنجازات</T>
      {milestones.map((m) => (
        <Row key={m.id}>
          <Check on={m.done} onPress={() => update('skill_milestones', m.id, { done: !m.done, done_at: m.done ? null : new Date().toISOString() })} />
          <T style={{ flex: 1 }} strike={m.done}>
            {m.text}
          </T>
          <IconBtn name="close" size={16} onPress={() => remove('skill_milestones', m.id)} />
        </Row>
      ))}
      <Row>
        <View style={{ flex: 1 }}>
          <Field placeholder="مرحلة جديدة…" value={ms} onChangeText={setMs} />
        </View>
        <Btn small title="أضف" onPress={() => ms.trim() && (insert('skill_milestones', { node_id: n.id, text: ms.trim(), sort_order: milestones.length }), setMs(''))} />
      </Row>

      {!isRoot && (
        <>
          <Row>
            <Btn style={{ flex: 1 }} kind="ghost" small icon="arrow-forward" title="قدّم" onPress={() => reorder(-1)} />
            <Btn style={{ flex: 1 }} kind="ghost" small icon="arrow-back" title="أخّر" onPress={() => reorder(1)} />
            <Btn style={{ flex: 1 }} kind="ghost" small icon="git-branch-outline" title="نقل" onPress={() => setMoving(!moving)} />
          </Row>
          {moving && (
            <Chips
              value={n.parent_id}
              onChange={(pid: string) => (update('skill_nodes', n.id, { parent_id: pid, sort_order: (kids.get(pid) ?? []).length }), setMoving(false))}
              options={parents.map((p) => ({ label: p.parent_id ? p.name : 'me (الجذر)', value: p.id }))}
            />
          )}
          <Btn
            kind="danger"
            title="حذف"
            onPress={() => {
              const count = descendants(n.id).length;
              const go = () => {
                const ds = descendants(n.id);
                remove('skill_nodes', n.id, [['skill_logs', 'node_id'], ['skill_milestones', 'node_id']]);
                for (const d of ds) remove('skill_nodes', d, [['skill_logs', 'node_id'], ['skill_milestones', 'node_id']]);
                setShown(null);
                onClose();
              };
              count ? confirm(`هيتحذف معاه ${count} عنصر تحته. متأكد؟`, go) : go();
            }}
          />
        </>
      )}
    </Sheet>
  );
}
