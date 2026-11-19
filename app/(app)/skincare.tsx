import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { JarLogo } from '@/components/mee';
import { Bar, Btn, Card, Check, Chips, confirm, Empty, Field, IconBtn, Pill, Row, Screen, SectionTitle, Segmented, Sheet, T } from '@/components/ui';
import { defaultSkincare } from '@/lib/content';
import { addDays, cleanYmd, parseYmd, shortLabel, today, weekdayShort } from '@/lib/dates';
import { insert, remove, update, useQuery, useRows, type Row as DbRow } from '@/lib/db';
import { streak } from '@/lib/logic';
import { addMonths } from '@/lib/notify';
import { useTheme } from '@/lib/theme';

/** §4.7 skincare: AM/PM routines (M-01), weekly treatments (M-02), product shelf (M-03). */
export default function Skincare() {
  const { c } = useTheme();
  const [tab, setTab] = useState<'routine' | 'shelf'>('routine');
  return (
    <Screen back title="السكن كير" right={<JarLogo size={30} color={c.ink} />}>
      <Segmented value={tab} onChange={setTab} options={[{ label: 'الروتين', value: 'routine' }, { label: 'رف المنتجات', value: 'shelf' }]} />
      {tab === 'routine' ? <Routines /> : <Shelf />}
    </Screen>
  );
}

function Routines() {
  const { c } = useTheme();
  const d = today();
  const dow = parseYmd(d).getDay();
  const steps = useQuery('skincare_steps', undefined, (a, b) => a.sort_order - b.sort_order);
  const logs = useRows('routine_logs');
  const products = useRows('products');
  const [editing, setEditing] = useState<'AM' | 'PM' | null>(null);

  const toggle = (routine: 'AM' | 'PM', stepId: string) => {
    const log = logs.find((l) => l.routine === routine && l.date === d);
    if (!log) insert('routine_logs', { routine, date: d, completed_steps: [stepId] });
    else {
      const has = log.completed_steps.includes(stepId);
      update('routine_logs', log.id, { completed_steps: has ? log.completed_steps.filter((x: string) => x !== stepId) : [...log.completed_steps, stepId] });
    }
  };

  if (steps.length === 0) {
    return (
      <Card>
        <Empty text="ابدأ روتينك: ضيف الخطوات بنفسك أو ابدأ باقتراح بسيط." mood="calm" />
        <Btn
          kind="soft"
          title="ابدأ بخطوات مقترحة"
          onPress={() => {
            defaultSkincare.AM.forEach((name, i) => insert('skincare_steps', { routine: 'AM', name, sort_order: i }));
            defaultSkincare.PM.forEach((name, i) => insert('skincare_steps', { routine: 'PM', name, sort_order: i }));
          }}
        />
        <Row>
          <Btn style={{ flex: 1 }} kind="ghost" title="روتين الصباح" onPress={() => setEditing('AM')} />
          <Btn style={{ flex: 1 }} kind="ghost" title="روتين المساء" onPress={() => setEditing('PM')} />
        </Row>
        <StepsSheet routine={editing} steps={steps} products={products} onClose={() => setEditing(null)} />
      </Card>
    );
  }

  return (
    <>
      {(['AM', 'PM'] as const).map((r) => {
        const list = steps.filter((s) => s.routine === r && (!s.days_of_week?.length || s.days_of_week.includes(dow)));
        const log = logs.find((l) => l.routine === r && l.date === d);
        const doneCount = list.filter((s) => log?.completed_steps?.includes(s.id)).length;
        const doneDates = logs
          .filter((l) => l.routine === r)
          .filter((l) => {
            const dw = parseYmd(l.date).getDay();
            const due = steps.filter((s) => s.routine === r && (!s.days_of_week?.length || s.days_of_week.includes(dw)));
            return due.length > 0 && due.every((s) => l.completed_steps.includes(s.id));
          })
          .map((l) => l.date);
        const st = streak(doneDates);
        return (
          <View key={r} style={{ gap: 8 }}>
            <SectionTitle action="تعديل" onAction={() => setEditing(r)}>
              {r === 'AM' ? 'روتين الصباح ☀️' : 'روتين المساء 🌙'} · 🔥 {st.current}
            </SectionTitle>
            <Card style={{ gap: 2 }}>
              <Bar value={list.length ? doneCount / list.length : 0} />
              {list.length === 0 && <T sub>مفيش خطوات النهارده.</T>}
              {list.map((s, i) => {
                const on = !!log?.completed_steps?.includes(s.id);
                const prod = products.find((p) => p.id === s.product_id);
                return (
                  <Pressable key={s.id} onPress={() => toggle(r, s.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 }}>
                    <T size={12} faint style={{ width: 16 }}>
                      {i + 1}
                    </T>
                    <View style={{ flex: 1 }}>
                      <T w="medium" strike={on}>
                        {s.name}
                      </T>
                      {(prod || s.days_of_week?.length) && (
                        <T size={12} sub>
                          {[prod?.name, s.days_of_week?.length ? 'علاج الأسبوع' : null].filter(Boolean).join(' · ')}
                        </T>
                      )}
                    </View>
                    <Check on={on} onPress={() => toggle(r, s.id)} />
                  </Pressable>
                );
              })}
            </Card>
          </View>
        );
      })}
      <StepsSheet routine={editing} steps={steps} products={products} onClose={() => setEditing(null)} />
    </>
  );
}

function StepsSheet({ routine, steps, products, onClose }: { routine: 'AM' | 'PM' | null; steps: DbRow[]; products: DbRow[]; onClose: () => void }) {
  const [name, setName] = useState('');
  const [weekly, setWeekly] = useState<number[]>([]);
  if (!routine) return null;
  const list = steps.filter((s) => s.routine === routine);
  const add = () => {
    if (!name.trim()) return;
    insert('skincare_steps', { routine, name: name.trim(), sort_order: list.length, days_of_week: weekly.length ? weekly : null });
    setName('');
    setWeekly([]);
  };
  const move = (s: DbRow, dir: -1 | 1) => {
    const i = list.findIndex((x) => x.id === s.id);
    const o = list[i + dir];
    if (!o) return;
    update('skincare_steps', s.id, { sort_order: i + dir });
    update('skincare_steps', o.id, { sort_order: i });
  };
  return (
    <Sheet visible onClose={onClose} title={routine === 'AM' ? 'خطوات الصباح' : 'خطوات المساء'}>
      {list.map((s) => (
        <View key={s.id} style={{ gap: 6 }}>
          <Row>
            <T style={{ flex: 1 }} w="medium">
              {s.name}
              {s.days_of_week?.length ? ` · ${s.days_of_week.map((x: number) => weekdayShort[x]).join('، ')}` : ''}
            </T>
            <IconBtn name="arrow-up" size={18} onPress={() => move(s, -1)} />
            <IconBtn name="arrow-down" size={18} onPress={() => move(s, 1)} />
            <IconBtn name="trash-outline" size={18} onPress={() => remove('skincare_steps', s.id)} />
          </Row>
          {products.length > 0 && <Chips value={s.product_id} onChange={(v: string) => update('skincare_steps', s.id, { product_id: s.product_id === v ? null : v })} options={products.map((p) => ({ label: p.name, value: p.id }))} />}
        </View>
      ))}
      <Field label="خطوة جديدة" placeholder="غسول، سيروم، ماسك…" value={name} onChangeText={setName} />
      <T size={12} sub>
        علاج أسبوعي؟ اختار أيامه (أو سيبها فاضية = كل يوم)
      </T>
      <Chips multi value={weekly} onChange={setWeekly} options={weekdayShort.map((label, value) => ({ label, value }))} />
      <Btn title="أضف الخطوة" onPress={add} />
    </Sheet>
  );
}

function Shelf() {
  const { c } = useTheme();
  const products = useQuery('products', undefined, (a, b) => String(a.name).localeCompare(String(b.name)));
  const [edit, setEdit] = useState<DbRow | 'new' | null>(null);
  return (
    <>
      <Btn kind="soft" icon="add" title="منتج جديد" onPress={() => setEdit('new')} />
      {products.length === 0 && <Empty text="الرف فاضي." mood="sleep" />}
      {products.map((p) => {
        const expiry = p.opened_at && p.pao_months ? addMonths(p.opened_at, p.pao_months) : null;
        const expired = expiry && expiry < today();
        const soon = expiry && !expired && expiry <= addDays(today(), 14);
        return (
          <Card key={p.id} onPress={() => setEdit(p)} style={{ gap: 4 }}>
            <Row>
              <T w="semibold" style={{ flex: 1 }}>
                {p.name}
              </T>
              {p.running_low && <Pill text="قرب يخلص" color={c.warn} bg={c.sec.money} />}
              {expired && <Pill text="انتهت صلاحيته" color={c.danger} bg={c.sec.me} />}
              {soon && <Pill text="الصلاحية قربت" color={c.warn} bg={c.sec.money} />}
            </Row>
            <T size={12} sub>
              {[p.step, p.opened_at ? `اتفتح ${shortLabel(p.opened_at)}` : null, expiry ? `صالح لحد ${shortLabel(expiry)}` : null].filter(Boolean).join(' · ')}
            </T>
          </Card>
        );
      })}
      <ProductSheet product={edit} onClose={() => setEdit(null)} />
    </>
  );
}

function ProductSheet({ product, onClose }: { product: DbRow | 'new' | null; onClose: () => void }) {
  const [v, setV] = useState({ name: '', step: '', opened: '', pao: '', low: false });
  const [shown, setShown] = useState<string | null>(null);
  const key = product === 'new' ? 'new' : product?.id ?? null;
  if (product && shown !== key) {
    setShown(key);
    setV(product === 'new' ? { name: '', step: '', opened: today(), pao: '12', low: false } : { name: product.name, step: product.step ?? '', opened: product.opened_at ?? '', pao: String(product.pao_months ?? ''), low: product.running_low });
  }
  if (!product) return null;
  const close = () => (onClose(), setShown(null));
  const save = () => {
    if (!v.name.trim()) return;
    const vals = { name: v.name.trim(), step: v.step.trim() || null, opened_at: cleanYmd(v.opened), pao_months: Number(v.pao) || null, running_low: v.low };
    if (product === 'new') insert('products', vals);
    else update('products', product.id, vals);
    close();
  };
  return (
    <Sheet visible onClose={close} title={product === 'new' ? 'منتج جديد' : 'المنتج'}>
      <Field label="الاسم" value={v.name} onChangeText={(name) => setV({ ...v, name })} />
      <Field label="الخطوة" placeholder="غسول، سيروم…" value={v.step} onChangeText={(step) => setV({ ...v, step })} />
      <Row>
        <View style={{ flex: 1 }}>
          <Field label="تاريخ الفتح" value={v.opened} onChangeText={(opened) => setV({ ...v, opened })} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="الصلاحية بعد الفتح (شهور)" keyboardType="number-pad" value={v.pao} onChangeText={(pao) => setV({ ...v, pao })} />
        </View>
      </Row>
      <Chips value={v.low} onChange={(low: boolean) => setV({ ...v, low })} options={[{ label: 'لسه كتير', value: false as any }, { label: 'قرب يخلص', value: true as any }]} />
      <Btn title="حفظ" onPress={save} />
      {product !== 'new' && <Btn kind="danger" title="حذف" onPress={() => confirm('تحذف المنتج؟', () => (remove('products', product.id), close()))} />}
    </Sheet>
  );
}
