import { useState } from 'react';
import { View } from 'react-native';
import { LineChart } from '@/components/charts';
import { Bar, Btn, Card, Chips, Empty, Field, IconBtn, Row, Screen, SectionTitle, Segmented, Stat, T } from '@/components/ui';
import { parseYmd, shortLabel, today, weekdayNames } from '@/lib/dates';
import { insert, remove, rows, update, upsertOwn, useOwn, useQuery, useRows } from '@/lib/db';
import { useTheme } from '@/lib/theme';

/** §4.4 gym & food: plan + session log (G-01), best previous (G-02), weight (G-03), meals vs goal (G-04), favorites (G-05). */
export default function Gym() {
  const [tab, setTab] = useState<'workout' | 'food' | 'weight'>('workout');
  return (
    <Screen back="me" title="الجيم والأكل">
      <Segmented value={tab} onChange={setTab} options={[{ label: 'التمرين', value: 'workout' }, { label: 'الأكل', value: 'food' }, { label: 'الوزن', value: 'weight' }]} />
      {tab === 'workout' && <Workout />}
      {tab === 'food' && <Food />}
      {tab === 'weight' && <Weight />}
    </Screen>
  );
}

function Workout() {
  const { c } = useTheme();
  const d = today();
  const dow = parseYmd(d).getDay();
  const [planDay, setPlanDay] = useState(dow);
  const plan = useQuery('workout_plan', undefined, (a, b) => a.sort_order - b.sort_order);
  const workouts = useRows('workouts');
  const sets = useRows('workout_sets');
  const todayW = workouts.find((w) => w.date === d);
  const todaySets = sets.filter((s) => s.workout_id === todayW?.id).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const [exercise, setExercise] = useState('');
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [newEx, setNewEx] = useState('');

  const best = (ex: string) => {
    const prior = sets.filter((s) => s.exercise === ex && s.workout_id !== todayW?.id);
    if (!prior.length) return null;
    return prior.reduce((b, s) => (s.weight > b.weight || (s.weight === b.weight && s.reps > b.reps) ? s : b));
  };
  const logSet = (ex = exercise) => {
    if (!ex.trim() || !Number(reps)) return;
    let wid = todayW?.id;
    if (!wid) wid = insert('workouts', { date: d, name: weekdayNames[dow] }).id;
    const n = todaySets.filter((s) => s.exercise === ex.trim()).length + 1;
    insert('workout_sets', { workout_id: wid, exercise: ex.trim(), set_no: n, reps: Number(reps), weight: Number(weight) || 0 });
  };
  const todayPlan = plan.filter((p) => p.weekday === dow);
  const bestOf = exercise.trim() ? best(exercise.trim()) : null;

  return (
    <>
      <SectionTitle>جلسة النهارده</SectionTitle>
      {todayPlan.length > 0 && (
        <Chips value={exercise} onChange={setExercise} options={todayPlan.map((p) => ({ label: `${p.exercise} ${p.sets}×${p.reps}`, value: p.exercise }))} />
      )}
      <Card>
        <Field placeholder="التمرين" value={exercise} onChangeText={setExercise} />
        {bestOf && (
          <T size={12} color={c.primary}>
            أفضل أداء سابق: {bestOf.weight} كجم × {bestOf.reps}
          </T>
        )}
        <Row>
          <View style={{ flex: 1 }}>
            <Field placeholder="عدّات" keyboardType="number-pad" value={reps} onChangeText={setReps} />
          </View>
          <View style={{ flex: 1 }}>
            <Field placeholder="وزن كجم" keyboardType="decimal-pad" value={weight} onChangeText={setWeight} />
          </View>
          <Btn small title="سجّل مجموعة" onPress={() => logSet()} />
        </Row>
      </Card>
      {todaySets.length > 0 && (
        <Card style={{ gap: 4 }}>
          {Array.from(new Set(todaySets.map((s) => s.exercise))).map((ex) => (
            <View key={ex} style={{ gap: 2 }}>
              <T w="semibold">{ex}</T>
              {todaySets
                .filter((s) => s.exercise === ex)
                .map((s) => (
                  <Row key={s.id}>
                    <T size={13} sub style={{ flex: 1 }}>
                      مجموعة {s.set_no}: {s.reps} × {s.weight} كجم
                    </T>
                    <IconBtn name="close" size={16} onPress={() => remove('workout_sets', s.id)} />
                  </Row>
                ))}
            </View>
          ))}
        </Card>
      )}

      <SectionTitle>الخطة الأسبوعية</SectionTitle>
      <Chips value={planDay} onChange={setPlanDay} options={weekdayNames.map((label, value) => ({ label, value }))} />
      <Card style={{ gap: 4 }}>
        {plan.filter((p) => p.weekday === planDay).length === 0 && <T sub>يوم راحة (أو ضيف تمارين).</T>}
        {plan
          .filter((p) => p.weekday === planDay)
          .map((p) => (
            <Row key={p.id}>
              <T style={{ flex: 1 }}>{p.exercise}</T>
              <T size={12} sub>
                {p.sets}×{p.reps}
              </T>
              <IconBtn name="remove-circle-outline" size={18} onPress={() => update('workout_plan', p.id, { sets: Math.max(1, p.sets - 1) })} />
              <IconBtn name="add-circle-outline" size={18} onPress={() => update('workout_plan', p.id, { sets: p.sets + 1 })} />
              <IconBtn name="close" size={18} onPress={() => remove('workout_plan', p.id)} />
            </Row>
          ))}
        <Row>
          <View style={{ flex: 1 }}>
            <Field placeholder="تمرين للخطة" value={newEx} onChangeText={setNewEx} />
          </View>
          <Btn small title="أضف" onPress={() => newEx.trim() && (insert('workout_plan', { weekday: planDay, exercise: newEx.trim(), sort_order: rows('workout_plan').length }), setNewEx(''))} />
        </Row>
      </Card>
      {workouts.length > 0 && (
        <T size={12} faint center>
          {workouts.length} جلسة متسجلة
        </T>
      )}
    </>
  );
}

function Food() {
  const { c } = useTheme();
  const d = today();
  const profile = useOwn('profiles');
  const meals = useQuery('meals', (m) => m.date === d, (a, b) => String(a.created_at).localeCompare(String(b.created_at)), [d]);
  const favs = useQuery('meals', (m) => m.is_favorite);
  const uniqueFavs = Array.from(new Map(favs.map((m) => [m.name, m])).values());
  const [name, setName] = useState('');
  const [cal, setCal] = useState('');
  const [pro, setPro] = useState('');
  const [goals, setGoals] = useState({ cal: String(profile?.calorie_goal ?? ''), pro: String(profile?.protein_goal ?? '') });
  const calories = meals.reduce((s, m) => s + (m.calories ?? 0), 0);
  const protein = meals.reduce((s, m) => s + Number(m.protein ?? 0), 0);
  const add = () => name.trim() && (insert('meals', { date: d, name: name.trim(), calories: Number(cal) || 0, protein: Number(pro) || 0 }), setName(''), setCal(''), setPro(''));
  return (
    <>
      <Row>
        <Stat label="السعرات" value={calories} sub={profile?.calorie_goal ? `من ${profile.calorie_goal}` : 'حدد هدف'} />
        <Stat label="البروتين" value={`${protein} جم`} sub={profile?.protein_goal ? `من ${profile.protein_goal}` : 'حدد هدف'} />
      </Row>
      {profile?.calorie_goal ? <Bar value={calories / profile.calorie_goal} color={c.ink} /> : null}
      {profile?.protein_goal ? <Bar value={protein / profile.protein_goal} /> : null}
      {(!profile?.calorie_goal || !profile?.protein_goal) && (
        <Card>
          <T size={13} sub>
            أهداف التضخيم اليومية
          </T>
          <Row>
            <View style={{ flex: 1 }}>
              <Field placeholder="سعرات (مثلاً 3000)" keyboardType="number-pad" value={goals.cal} onChangeText={(v) => setGoals({ ...goals, cal: v })} />
            </View>
            <View style={{ flex: 1 }}>
              <Field placeholder="بروتين جم (مثلاً 150)" keyboardType="number-pad" value={goals.pro} onChangeText={(v) => setGoals({ ...goals, pro: v })} />
            </View>
            <Btn small title="حفظ" onPress={() => upsertOwn('profiles', { calorie_goal: Number(goals.cal) || null, protein_goal: Number(goals.pro) || null })} />
          </Row>
        </Card>
      )}
      {uniqueFavs.length > 0 && (
        <>
          <SectionTitle>المفضلة — لمسة واحدة</SectionTitle>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {uniqueFavs.map((m) => (
              <Btn key={m.id} small kind="soft" title={`${m.name} · ${m.calories}`} onPress={() => insert('meals', { date: d, name: m.name, calories: m.calories, protein: m.protein })} />
            ))}
          </View>
        </>
      )}
      <Card>
        <Field placeholder="الوجبة" value={name} onChangeText={setName} />
        <Row>
          <View style={{ flex: 1 }}>
            <Field placeholder="سعرات" keyboardType="number-pad" value={cal} onChangeText={setCal} />
          </View>
          <View style={{ flex: 1 }}>
            <Field placeholder="بروتين" keyboardType="number-pad" value={pro} onChangeText={setPro} />
          </View>
          <Btn small title="أضف" onPress={add} />
        </Row>
      </Card>
      {meals.length === 0 && <Empty text="ما سجلتش أكل النهارده." mood="coffee" />}
      {meals.map((m) => (
        <Card key={m.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <T w="medium">{m.name}</T>
            <T size={12} sub>
              {m.calories} سعرة · {m.protein} جم بروتين
            </T>
          </View>
          <IconBtn name={m.is_favorite ? 'star' : 'star-outline'} size={20} onPress={() => update('meals', m.id, { is_favorite: !m.is_favorite })} />
          <IconBtn name="close" size={18} onPress={() => remove('meals', m.id)} />
        </Card>
      ))}
      {profile?.calorie_goal ? (
        <T size={11} faint onPress={() => upsertOwn('profiles', { calorie_goal: null, protein_goal: null })}>
          تغيير الأهداف
        </T>
      ) : null}
    </>
  );
}

function Weight() {
  const list = useQuery('body_metrics', undefined, (a, b) => a.date.localeCompare(b.date));
  const [w, setW] = useState('');
  const d = today();
  const save = () => {
    if (!Number(w)) return;
    const ex = list.find((x) => x.date === d);
    if (ex) update('body_metrics', ex.id, { weight: Number(w) });
    else insert('body_metrics', { date: d, weight: Number(w) });
    setW('');
  };
  const last = list.slice(-12);
  const change = list.length > 1 ? Math.round((list[list.length - 1].weight - list[0].weight) * 10) / 10 : 0;
  return (
    <>
      <Row>
        <Stat label="الحالي" value={list.length ? `${list[list.length - 1].weight} كجم` : '—'} />
        <Stat label="التغيّر" value={`${change > 0 ? '+' : ''}${change} كجم`} sub="من أول تسجيل" />
      </Row>
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
    </>
  );
}
