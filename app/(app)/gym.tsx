import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { LineChart } from '@/components/charts';
import { MoreNav } from '@/components/more-nav';
import { Btn, Card, Chips, Empty, Field, IconBtn, ListRow, Row, Screen, Section, Sheet, T, tap } from '@/components/ui';
import { parseYmd, shortLabel, today, weekdayNames } from '@/lib/dates';
import { insert, remove, rows, update, upsertOwn, useOwn, useQuery, useRows } from '@/lib/db';
import { useTheme } from '@/lib/theme';

/** §4.4 gym & food — single page like the design: stats, weight, today's workout, meals. */
export default function Gym() {
  const { c } = useTheme();
  const hc = c.acc.health;
  const d = today();
  const dow = parseYmd(d).getDay();
  const profile = useOwn('profiles');
  const meals = useQuery('meals', (m) => m.date === d, (a, b) => String(a.created_at).localeCompare(String(b.created_at)), [d]);
  const weights = useQuery('body_metrics', undefined, (a, b) => a.date.localeCompare(b.date));
  const plan = useQuery('workout_plan', undefined, (a, b) => a.sort_order - b.sort_order);
  const workouts = useRows('workouts');
  const sets = useRows('workout_sets');
  const [sheet, setSheet] = useState<'weight' | 'meal' | 'plan' | 'set' | 'goals' | null>(null);
  const [setFor, setSetFor] = useState<string>('');

  const calories = meals.reduce((s, m) => s + (m.calories ?? 0), 0);
  const protein = meals.reduce((s, m) => s + Number(m.protein ?? 0), 0);
  const todayW = workouts.find((w) => w.date === d);
  const todaySets = sets.filter((s) => s.workout_id === todayW?.id);
  const todayPlan = plan.filter((p) => p.weekday === dow);
  const adHoc = Array.from(new Set(todaySets.map((s) => s.exercise))).filter((ex) => !todayPlan.some((p) => p.exercise === ex));
  const totalSets = todayPlan.reduce((a, p) => a + p.sets, 0);
  const doneSets = todayPlan.reduce((a, p) => a + Math.min(p.sets, todaySets.filter((s) => s.exercise === p.exercise).length), 0);
  const lastWeight = weights[weights.length - 1];
  const prevWeight = weights[weights.length - 2];

  const best = (ex: string) => {
    const prior = sets.filter((s) => s.exercise === ex && s.workout_id !== todayW?.id);
    if (!prior.length) return null;
    return prior.reduce((b, s) => (s.weight > b.weight || (s.weight === b.weight && s.reps > b.reps) ? s : b));
  };
  const openSet = (ex: string) => {
    setSetFor(ex);
    setSheet('set');
  };

  return (
    <Screen back="me">
      <MoreNav />
      <T size={26} w="bold" lh={1.3}>
        الجيم والأكل
      </T>

      <Row>
        <Pressable onPress={() => setSheet(profile?.calorie_goal ? 'meal' : 'goals')} style={{ flex: 1 }}>
          <StatBar label="السعرات" value={calories.toLocaleString('en')} goal={profile?.calorie_goal} unit="" color={hc.bar} />
        </Pressable>
        <Pressable onPress={() => setSheet(profile?.protein_goal ? 'meal' : 'goals')} style={{ flex: 1 }}>
          <StatBar label="البروتين" value={String(protein)} goal={profile?.protein_goal} unit="جم" color={hc.bar} />
        </Pressable>
      </Row>

      <Pressable onPress={() => setSheet('weight')} style={{ backgroundColor: hc.bg, borderRadius: 20, paddingVertical: 16, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ gap: 2 }}>
          <T size={12} w="medium" color={hc.fg}>
            الوزن الحالي
          </T>
          <T size={26} w="bold" color={hc.dark}>
            {lastWeight ? Number(lastWeight.weight).toFixed(1) : '—'} <T size={13} w="medium" color={hc.dark}>كجم</T>
          </T>
        </View>
        <Row gap={6}>
          {prevWeight && lastWeight ? (
            <T size={13} w="semibold" color={hc.fg}>
              {lastWeight.weight - prevWeight.weight >= 0 ? '↑' : '↓'} {Math.abs(Math.round((lastWeight.weight - prevWeight.weight) * 10) / 10)}
            </T>
          ) : null}
          <Ionicons name="trending-up" size={26} color={hc.fg} />
        </Row>
      </Pressable>

      <Section title={`تمرين اليوم · ${weekdayNames[dow]}`} note={totalSets ? `${doneSets} / ${totalSets}` : undefined} action={totalSets ? undefined : 'الخطة'} onAction={() => setSheet('plan')}>
        <Card list>
          {todayPlan.length === 0 && adHoc.length === 0 && (
            <View style={{ paddingVertical: 8, gap: 8 }}>
              <Empty text="مفيش تمارين في خطة النهارده. حط خطتك الأسبوعية أو سجّل تمرين حر." mood="coffee" />
              <Row>
                <Btn small style={{ flex: 1 }} title="الخطة الأسبوعية" onPress={() => setSheet('plan')} />
                <Btn small style={{ flex: 1 }} kind="ghost" title="تمرين حر" onPress={() => openSet('')} />
              </Row>
            </View>
          )}
          {todayPlan.map((p, i) => {
            const n = todaySets.filter((s) => s.exercise === p.exercise).length;
            const b = best(p.exercise);
            const full = n >= p.sets;
            return (
              <ListRow key={p.id} minHeight={62} last={i === todayPlan.length - 1 && !adHoc.length} onPress={() => openSet(p.exercise)}>
                <View style={{ flex: 1 }}>
                  <T w="semibold">{p.exercise}</T>
                  <T size={12} sub>
                    {p.sets} × {p.reps}
                    {b ? ` · آخر مرة ${b.weight} كجم` : ''}
                  </T>
                </View>
                <Pressable onPress={() => openSet(p.exercise)} style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: full ? c.primary : c.track, backgroundColor: full ? c.primary : c.card, justifyContent: 'center' }}>
                  <T size={13} w="bold" color={full ? '#FFFFFF' : c.text}>
                    {n} / {p.sets}
                  </T>
                </Pressable>
              </ListRow>
            );
          })}
          {adHoc.map((ex, i) => (
            <ListRow key={ex} minHeight={62} last={i === adHoc.length - 1} onPress={() => openSet(ex)}>
              <View style={{ flex: 1 }}>
                <T w="semibold">{ex}</T>
                <T size={12} sub>
                  تمرين حر
                </T>
              </View>
              <T size={13} w="bold">
                {todaySets.filter((s) => s.exercise === ex).length} مجموعات
              </T>
            </ListRow>
          ))}
        </Card>
        {(todayPlan.length > 0 || adHoc.length > 0) && (
          <Row>
            <Btn small kind="link" title="+ تمرين حر" onPress={() => openSet('')} />
            <Btn small kind="link" title="تعديل الخطة" onPress={() => setSheet('plan')} />
          </Row>
        )}
      </Section>

      <Section title="وجبات اليوم" action="+ وجبة" onAction={() => setSheet('meal')}>
        <Card list>
          {meals.length === 0 && <Empty text="ما سجلتش أكل النهارده." mood="coffee" />}
          {meals.map((m, i) => (
            <ListRow key={m.id} minHeight={54} last={i === meals.length - 1}>
              <View style={{ flex: 1 }}>
                <T w="medium">{m.name}</T>
                <T size={12} sub>
                  {m.protein} جم بروتين · {new Date(m.created_at).toLocaleTimeString('ar', { hour: 'numeric', minute: '2-digit' })}
                </T>
              </View>
              <T size={13} color={c.sub2}>
                {m.calories} سعرة
              </T>
              <IconBtn name={m.is_favorite ? 'star' : 'star-outline'} size={18} color={m.is_favorite ? c.warn : c.faint} onPress={() => update('meals', m.id, { is_favorite: !m.is_favorite })} />
              <IconBtn name="close" size={16} color={c.faint} onPress={() => remove('meals', m.id)} />
            </ListRow>
          ))}
        </Card>
      </Section>

      <SetSheet visible={sheet === 'set'} exercise={setFor} onClose={() => setSheet(null)} best={best} todayW={todayW} todaySets={todaySets} />
      <MealSheet visible={sheet === 'meal'} onClose={() => setSheet(null)} />
      <PlanSheet visible={sheet === 'plan'} onClose={() => setSheet(null)} plan={plan} />
      <WeightSheet visible={sheet === 'weight'} onClose={() => setSheet(null)} list={weights} />
      <GoalsSheet visible={sheet === 'goals'} onClose={() => setSheet(null)} profile={profile} />
    </Screen>
  );
}

function StatBar({ label, value, goal, unit, color }: { label: string; value: string; goal?: number | null; unit: string; color: string }) {
  const { c } = useTheme();
  const v = Number(value.replace(/,/g, ''));
  return (
    <View style={{ backgroundColor: c.card, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 16, gap: 8 }}>
      <T size={12} w="medium" sub>
        {label}
      </T>
      <T size={22} w="bold">
        {value} <T size={12} w="medium" sub>{goal ? `/ ${Number(goal).toLocaleString('en')} ${unit}` : unit || 'حدد هدف'}</T>
      </T>
      <View style={{ height: 8, borderRadius: 999, backgroundColor: c.line, overflow: 'hidden' }}>
        <View style={{ height: 8, borderRadius: 999, backgroundColor: color, width: `${goal ? Math.min(100, (v / goal) * 100) : 0}%` }} />
      </View>
    </View>
  );
}

function SetSheet({ visible, exercise, onClose, best, todayW, todaySets }: { visible: boolean; exercise: string; onClose: () => void; best: (ex: string) => any; todayW: any; todaySets: any[] }) {
  const { c } = useTheme();
  const [ex, setEx] = useState(exercise);
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [shown, setShown] = useState<string | null>(null);
  if (visible && shown !== exercise) {
    setShown(exercise);
    setEx(exercise);
    const b = exercise ? best(exercise) : null;
    setReps(b ? String(b.reps) : '');
    setWeight(b ? String(b.weight) : '');
  }
  if (!visible) return null;
  const b = ex.trim() ? best(ex.trim()) : null;
  const mine = todaySets.filter((s) => s.exercise === ex.trim());
  const log = () => {
    if (!ex.trim() || !Number(reps)) return;
    let wid = todayW?.id;
    if (!wid) wid = insert('workouts', { date: today(), name: weekdayNames[parseYmd(today()).getDay()] }).id;
    insert('workout_sets', { workout_id: wid, exercise: ex.trim(), set_no: mine.length + 1, reps: Number(reps), weight: Number(weight) || 0 });
    tap();
  };
  return (
    <Sheet visible onClose={() => (setShown(null), onClose())} title={ex || 'تمرين حر'}>
      {!exercise && <Field placeholder="اسم التمرين" value={ex} onChangeText={setEx} />}
      {b && (
        <T size={13} color={c.primary}>
          أفضل أداء سابق: {b.weight} كجم × {b.reps}
        </T>
      )}
      <Row>
        <View style={{ flex: 1 }}>
          <Field label="عدّات" keyboardType="number-pad" value={reps} onChangeText={setReps} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="وزن (كجم)" keyboardType="decimal-pad" value={weight} onChangeText={setWeight} />
        </View>
      </Row>
      <Btn title="سجّل مجموعة" onPress={log} />
      {mine.map((s: any) => (
        <Row key={s.id}>
          <T style={{ flex: 1 }}>
            مجموعة {s.set_no}: {s.reps} × {s.weight} كجم
          </T>
          <IconBtn name="close" size={16} onPress={() => remove('workout_sets', s.id)} />
        </Row>
      ))}
    </Sheet>
  );
}

function MealSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const favs = useQuery('meals', (m) => m.is_favorite);
  const unique = Array.from(new Map(favs.map((m) => [m.name, m])).values());
  const [name, setName] = useState('');
  const [cal, setCal] = useState('');
  const [pro, setPro] = useState('');
  const d = today();
  const add = () => {
    if (!name.trim()) return;
    insert('meals', { date: d, name: name.trim(), calories: Number(cal) || 0, protein: Number(pro) || 0 });
    setName('');
    setCal('');
    setPro('');
    onClose();
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="وجبة">
      {unique.length > 0 && (
        <View style={{ gap: 6 }}>
          <T size={12} sub>
            المفضلة — لمسة واحدة
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {unique.map((m) => (
              <Btn key={m.id} small kind="soft" title={`${m.name} · ${m.calories}`} onPress={() => (insert('meals', { date: d, name: m.name, calories: m.calories, protein: m.protein }), onClose())} />
            ))}
          </View>
        </View>
      )}
      <Field placeholder="اسم الوجبة" value={name} onChangeText={setName} />
      <Row>
        <View style={{ flex: 1 }}>
          <Field placeholder="سعرات" keyboardType="number-pad" value={cal} onChangeText={setCal} />
        </View>
        <View style={{ flex: 1 }}>
          <Field placeholder="بروتين (جم)" keyboardType="number-pad" value={pro} onChangeText={setPro} />
        </View>
      </Row>
      <Btn title="أضف" onPress={add} />
    </Sheet>
  );
}

function PlanSheet({ visible, onClose, plan }: { visible: boolean; onClose: () => void; plan: any[] }) {
  const [day, setDay] = useState(parseYmd(today()).getDay());
  const [ex, setEx] = useState('');
  const [sr, setSr] = useState({ sets: '3', reps: '10' });
  const list = plan.filter((p) => p.weekday === day);
  return (
    <Sheet visible={visible} onClose={onClose} title="الخطة الأسبوعية">
      <Chips value={day} onChange={setDay} options={weekdayNames.map((label, value) => ({ label, value }))} />
      {list.length === 0 && <T sub>يوم راحة (أو ضيف تمارين).</T>}
      {list.map((p) => (
        <Row key={p.id}>
          <T style={{ flex: 1 }} w="medium">
            {p.exercise}
          </T>
          <T size={12} sub>
            {p.sets}×{p.reps}
          </T>
          <IconBtn name="remove-circle-outline" size={18} onPress={() => update('workout_plan', p.id, { sets: Math.max(1, p.sets - 1) })} />
          <IconBtn name="add-circle-outline" size={18} onPress={() => update('workout_plan', p.id, { sets: p.sets + 1 })} />
          <IconBtn name="close" size={18} onPress={() => remove('workout_plan', p.id)} />
        </Row>
      ))}
      <Field placeholder="تمرين جديد (بنش بريس…)" value={ex} onChangeText={setEx} />
      <Row>
        <View style={{ flex: 1 }}>
          <Field label="مجموعات" keyboardType="number-pad" value={sr.sets} onChangeText={(sets) => setSr({ ...sr, sets })} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="عدّات" keyboardType="number-pad" value={sr.reps} onChangeText={(reps) => setSr({ ...sr, reps })} />
        </View>
      </Row>
      <Btn title="أضف للخطة" onPress={() => ex.trim() && (insert('workout_plan', { weekday: day, exercise: ex.trim(), sets: Number(sr.sets) || 3, reps: Number(sr.reps) || 10, sort_order: rows('workout_plan').length }), setEx(''))} />
    </Sheet>
  );
}

function WeightSheet({ visible, onClose, list }: { visible: boolean; onClose: () => void; list: any[] }) {
  const [w, setW] = useState('');
  const d = today();
  const last = list.slice(-12);
  const save = () => {
    if (!Number(w)) return;
    const ex = list.find((x) => x.date === d);
    if (ex) update('body_metrics', ex.id, { weight: Number(w) });
    else insert('body_metrics', { date: d, weight: Number(w) });
    setW('');
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="الوزن">
      <Card>
        <LineChart values={last.map((x) => Number(x.weight))} labels={last.map((x) => shortLabel(x.date).split(' ')[0])} max={Math.max(...last.map((x) => Number(x.weight)), 1) + 2} />
      </Card>
      <Row>
        <View style={{ flex: 1 }}>
          <Field placeholder="وزنك النهارده (كجم)" keyboardType="decimal-pad" value={w} onChangeText={setW} />
        </View>
        <Btn small title="سجّل" onPress={save} />
      </Row>
      {list
        .slice()
        .reverse()
        .slice(0, 10)
        .map((x) => (
          <Row key={x.id}>
            <T style={{ flex: 1 }}>{shortLabel(x.date)}</T>
            <T w="semibold">{x.weight} كجم</T>
            <IconBtn name="close" size={16} onPress={() => remove('body_metrics', x.id)} />
          </Row>
        ))}
    </Sheet>
  );
}

function GoalsSheet({ visible, onClose, profile }: { visible: boolean; onClose: () => void; profile: any }) {
  const [cal, setCal] = useState(String(profile?.calorie_goal ?? ''));
  const [pro, setPro] = useState(String(profile?.protein_goal ?? ''));
  return (
    <Sheet visible={visible} onClose={onClose} title="أهداف التضخيم اليومية">
      <Row>
        <View style={{ flex: 1 }}>
          <Field label="سعرات" placeholder="2800" keyboardType="number-pad" value={cal} onChangeText={setCal} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="بروتين (جم)" placeholder="120" keyboardType="number-pad" value={pro} onChangeText={setPro} />
        </View>
      </Row>
      <Btn title="حفظ" onPress={() => (upsertOwn('profiles', { calorie_goal: Number(cal) || null, protein_goal: Number(pro) || null }), onClose())} />
    </Sheet>
  );
}
