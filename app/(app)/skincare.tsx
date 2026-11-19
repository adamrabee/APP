import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { art } from '@/components/mee';
import { Btn, Card, Chips, confirm, Empty, Field, IconBtn, Row, Screen, Section, Sheet, T, tap } from '@/components/ui';
import { defaultSkincare } from '@/lib/content';
import { addDays, cleanYmd, parseYmd, shortLabel, today, weekdayShort } from '@/lib/dates';
import { insert, remove, update, useQuery, useRows, type Row as DbRow } from '@/lib/db';
import { streak } from '@/lib/logic';
import { addMonths } from '@/lib/notify';
import { useTheme } from '@/lib/theme';

/** §4.7 skincare: AM/PM routines (M-01), weekly treatments (M-02), product shelf (M-03). */
export default function Skincare() {
  const { c } = useTheme();
  const plum = c.acc.me;
  const d = today();
  const dow = parseYmd(d).getDay();
  const [routine, setRoutine] = useState<'AM' | 'PM'>(new Date().getHours() < 15 ? 'AM' : 'PM');
  const [editing, setEditing] = useState<'AM' | 'PM' | null>(null);
  const [product, setProduct] = useState<DbRow | 'new' | null>(null);
  const steps = useQuery('skincare_steps', undefined, (a, b) => a.sort_order - b.sort_order);
  const logs = useRows('routine_logs');
  const products = useQuery('products', undefined, (a, b) => String(a.name).localeCompare(String(b.name)));

  const list = steps.filter((s) => s.routine === routine && (!s.days_of_week?.length || s.days_of_week.includes(dow)));
  const log = logs.find((l) => l.routine === routine && l.date === d);
  const doneCount = list.filter((s) => log?.completed_steps?.includes(s.id)).length;
  const fullDays = (['AM', 'PM'] as const).flatMap((r) =>
    logs
      .filter((l) => l.routine === r)
      .filter((l) => {
        const dw = parseYmd(l.date).getDay();
        const due = steps.filter((s) => s.routine === r && (!s.days_of_week?.length || s.days_of_week.includes(dw)));
        return due.length > 0 && due.every((s) => l.completed_steps.includes(s.id));
      })
      .map((l) => l.date),
  );
  const st = streak(fullDays);

  const toggle = (stepId: string) => {
    tap();
    if (!log) insert('routine_logs', { routine, date: d, completed_steps: [stepId] });
    else {
      const has = log.completed_steps.includes(stepId);
      update('routine_logs', log.id, { completed_steps: has ? log.completed_steps.filter((x: string) => x !== stepId) : [...log.completed_steps, stepId] });
    }
  };

  return (
    <Screen back="me" backColor={plum.fg}>
      <Row gap={14}>
        <Image source={art.skincare} style={{ width: 64, height: 55 }} resizeMode="contain" />
        <View style={{ flex: 1, gap: 2 }}>
          <T size={26} w="bold" lh={1.3}>
            السكن كير
          </T>
          <T size={13} sub>
            روتينك ومنتجاتك في مكان واحد
          </T>
        </View>
      </Row>

      <Card style={{ padding: 18, gap: 14, borderRadius: 24 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T size={18} w="bold" onPress={() => setEditing(routine)}>
            روتين السكن كير
          </T>
          <View style={{ backgroundColor: plum.bg, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 }}>
            <T size={12} w="semibold" color={plum.fg}>
              {st.current} أيام متتالية
            </T>
          </View>
        </Row>
        <View style={{ flexDirection: 'row', backgroundColor: c.seg, borderRadius: 14, padding: 4 }}>
          {(['AM', 'PM'] as const).map((r) => (
            <Pressable key={r} onPress={() => setRoutine(r)} style={{ flex: 1, minHeight: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: routine === r ? c.card : 'transparent' }}>
              <T size={14} w="semibold">
                {r === 'AM' ? 'الصباح' : 'المساء'}
              </T>
            </Pressable>
          ))}
        </View>
        {steps.length === 0 ? (
          <View style={{ gap: 10 }}>
            <Empty text="ابدأ روتينك: ضيف الخطوات بنفسك أو ابدأ باقتراح بسيط." mood="calm" />
            <Btn
              kind="ghost"
              title="ابدأ بخطوات مقترحة"
              onPress={() => {
                defaultSkincare.AM.forEach((name, i) => insert('skincare_steps', { routine: 'AM', name, sort_order: i }));
                defaultSkincare.PM.forEach((name, i) => insert('skincare_steps', { routine: 'PM', name, sort_order: i }));
              }}
            />
          </View>
        ) : (
          <View>
            {list.length === 0 && <T sub>مفيش خطوات النهارده.</T>}
            {list.map((s) => {
              const on = !!log?.completed_steps?.includes(s.id);
              const prod = products.find((p) => p.id === s.product_id);
              return (
                <Pressable key={s.id} onPress={() => toggle(s.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 }}>
                  <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: on ? plum.fg : c.track, backgroundColor: on ? plum.fg : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {on && (
                      <T size={12} w="bold" color="#FFFFFF">
                        ✓
                      </T>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <T w="semibold" strike={on}>
                      {s.name}
                    </T>
                    {prod || s.days_of_week?.length ? (
                      <T size={12} sub>
                        {[prod?.name, s.days_of_week?.length ? 'علاج الأسبوع' : null].filter(Boolean).join(' · ')}
                      </T>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
            <Row style={{ justifyContent: 'space-between' }}>
              <T size={13} sub>
                {doneCount} من {list.length} خطوات
              </T>
              <T size={13} w="semibold" color={plum.fg} onPress={() => setEditing(routine)}>
                تعديل الخطوات
              </T>
            </Row>
          </View>
        )}
      </Card>

      <Section title="رف المنتجات" action="+ منتج" onAction={() => setProduct('new')}>
        {products.length === 0 && (
          <Card>
            <Empty text="الرف فاضي. ضيف منتجاتك وتاريخ فتحها." mood="sleep" />
          </Card>
        )}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {products.map((p) => {
            const expiry = p.opened_at && p.pao_months ? addMonths(p.opened_at, p.pao_months) : null;
            const expired = !!expiry && expiry < d;
            const soon = !!expiry && !expired && expiry <= addDays(d, 14);
            const warn = p.running_low || expired || soon;
            return (
              <Pressable
                key={p.id}
                onPress={() => setProduct(p)}
                style={{ width: '48.5%', backgroundColor: c.card, borderRadius: 18, padding: 14, gap: 6, borderWidth: 1, borderColor: warn ? '#EFD3C8' : c.card }}
              >
                <T size={11} w="medium" sub>
                  {p.step || 'منتج'}
                </T>
                <T size={14} w="semibold" lh={1.4}>
                  {p.name}
                </T>
                <T size={11} sub>
                  {p.opened_at ? `اتفتح ${shortLabel(p.opened_at)}` : 'لسه ما اتفتحش'}
                </T>
                {warn ? (
                  <T size={11} w="semibold" color={c.acc.health.fg}>
                    {expired ? 'انتهت صلاحيته' : soon ? `صالح لحد ${shortLabel(expiry!)}` : 'قرب يخلص'}
                  </T>
                ) : expiry ? (
                  <T size={11} sub>
                    صالح لحد {shortLabel(expiry)}
                  </T>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Section>

      <StepsSheet routine={editing} steps={steps} products={products} onClose={() => setEditing(null)} />
      <ProductSheet product={product} onClose={() => setProduct(null)} />
    </Screen>
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
      <Chips value={v.low} onChange={(low: boolean) => setV({ ...v, low })} options={[{ label: 'لسه كتير', value: false }, { label: 'قرب يخلص', value: true }]} />
      <Btn title="حفظ" onPress={save} />
      {product !== 'new' && <Btn kind="danger" title="حذف" onPress={() => confirm('تحذف المنتج؟', () => (remove('products', product.id), close()))} />}
    </Sheet>
  );
}
