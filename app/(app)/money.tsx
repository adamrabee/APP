import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { MoreNav } from '@/components/more-nav';
import { Btn, Card, Chips, Empty, Field, IconBtn, ListRow, Row, Screen, Section, Segmented, Sheet, T } from '@/components/ui';
import { expenseCategories } from '@/lib/content';
import { addDays, cleanYmd, monthStart, parseYmd, shortLabel, today, ymd } from '@/lib/dates';
import { insert, remove, update, useQuery } from '@/lib/db';
import { useTheme } from '@/lib/theme';

const sources = [
  { label: 'أفلييت', value: 'affiliate' },
  { label: 'تدريس', value: 'teaching' },
  { label: 'أخرى', value: 'other' },
];
const fmt = (n: number) => Math.round(n).toLocaleString('en');

/** §4.5 money (F-01…F-04), laid out like the design. */
export default function Money() {
  const { c } = useTheme();
  const green = c.acc.green;
  const hc = c.acc.health;
  const [month, setMonth] = useState(monthStart());
  const [sheet, setSheet] = useState<'tx' | 'budget' | null>(null);
  const next = ymd(new Date(parseYmd(month).getFullYear(), parseYmd(month).getMonth() + 1, 1));
  const tx = useQuery('transactions', (t) => t.date >= month && t.date < next, (a, b) => b.date.localeCompare(a.date) || String(b.created_at).localeCompare(String(a.created_at)), [month]);
  const budgets = useQuery('budgets', (b) => b.month === month, undefined, [month]);
  const income = tx.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount_sar), 0);
  const expense = tx.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount_sar), 0);
  const net = income - expense;
  const spentBy = (category: string) => tx.filter((t) => t.type === 'expense' && t.category === category).reduce((s, t) => s + Number(t.amount_sar), 0);
  const topSource = sources.map((s) => ({ ...s, v: tx.filter((t) => t.type === 'income' && t.source === s.value).reduce((a, t) => a + Number(t.amount_sar), 0) })).sort((a, b) => b.v - a.v)[0];
  const topCat = expenseCategories.map((x) => ({ x, v: spentBy(x) })).sort((a, b) => b.v - a.v)[0];
  const monthName = parseYmd(month).toLocaleDateString('ar', { month: 'long' });
  const dayLabel = (d: string) => (d === today() ? 'اليوم' : d === addDays(today(), -1) ? 'أمس' : shortLabel(d));
  const shift = (n: number) => {
    const d = parseYmd(month);
    setMonth(ymd(new Date(d.getFullYear(), d.getMonth() + n, 1)));
  };

  return (
    <Screen back="me">
      <MoreNav />
      <Row style={{ justifyContent: 'space-between' }}>
        <View>
          <T size={26} w="bold" lh={1.3}>
            الفلوس والشغل
          </T>
          <Row gap={4}>
            <IconBtn name="chevron-forward" size={16} color={c.sub} onPress={() => shift(-1)} />
            <T size={13} sub>
              {monthName}
            </T>
            {month < monthStart() && <IconBtn name="chevron-back" size={16} color={c.sub} onPress={() => shift(1)} />}
          </Row>
        </View>
        <Btn small title="+ عملية" onPress={() => setSheet('tx')} />
      </Row>

      <Card style={{ padding: 18, gap: 14, borderRadius: 24 }}>
        <View style={{ gap: 2 }}>
          <T size={12} w="medium" sub>
            صافي الشهر
          </T>
          <T size={32} w="bold" color={net >= 0 ? green.fg : hc.fg} lh={1.3}>
            {net >= 0 ? '+ ' : '− '}
            {fmt(Math.abs(net))} <T size={14} w="medium" color={net >= 0 ? green.fg : hc.fg}>ر.س</T>
          </T>
        </View>
        <Row gap={10}>
          <View style={{ flex: 1, backgroundColor: green.bg, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, gap: 2 }}>
            <T size={12} w="medium" color={green.fg}>
              الدخل
            </T>
            <T size={18} w="bold">
              {fmt(income)} ر.س
            </T>
            <T size={11} color={green.fg}>
              {topSource?.v ? `أغلبه ${topSource.label}` : '—'}
            </T>
          </View>
          <View style={{ flex: 1, backgroundColor: hc.bg, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, gap: 2 }}>
            <T size={12} w="medium" color={hc.fg}>
              المصاريف
            </T>
            <T size={18} w="bold">
              {fmt(expense)} ر.س
            </T>
            <T size={11} color={hc.fg}>
              {topCat?.v ? `أكتر حاجة ${topCat.x}` : '—'}
            </T>
          </View>
        </Row>
      </Card>

      <Section title="الميزانية" action="+ ميزانية" onAction={() => setSheet('budget')}>
        <Card style={{ gap: 14 }}>
          {budgets.length === 0 && (
            <T size={13} sub>
              حدد ميزانية شهرية لكل فئة عشان تشوف الفاضل.
            </T>
          )}
          {budgets.map((b) => {
            const spent = spentBy(b.category);
            const ratio = spent / Number(b.limit_sar);
            const hot = ratio >= 0.85;
            return (
              <Pressable key={b.id} onLongPress={() => remove('budgets', b.id)} style={{ gap: 6 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T size={14} w="medium">
                    {b.category}
                  </T>
                  <T size={13} color={hot ? hc.fg : c.sub}>
                    {fmt(spent)} / {fmt(Number(b.limit_sar))} ر.س
                  </T>
                </Row>
                <View style={{ height: 8, borderRadius: 999, backgroundColor: c.line, overflow: 'hidden' }}>
                  <View style={{ height: 8, borderRadius: 999, backgroundColor: hot ? hc.bar : c.primary, width: `${Math.min(100, ratio * 100)}%` }} />
                </View>
              </Pressable>
            );
          })}
        </Card>
      </Section>

      <Section title="آخر العمليات">
        <Card list>
          {tx.length === 0 && <Empty text="مفيش عمليات الشهر ده." mood="calm" />}
          {tx.map((t, i) => (
            <ListRow key={t.id} last={i === tx.length - 1}>
              <View style={{ flex: 1 }}>
                <T w="medium">{t.note || (t.type === 'expense' ? t.category ?? 'مصروف' : sources.find((s) => s.value === t.source)?.label ?? 'دخل')}</T>
                <T size={12} sub>
                  {t.type === 'expense' ? t.category : sources.find((s) => s.value === t.source)?.label} · {dayLabel(t.date)}
                </T>
              </View>
              <T size={15} w="bold" color={t.type === 'income' ? green.fg : hc.fg}>
                {t.type === 'income' ? '+' : '−'}
                {fmt(Number(t.amount_sar))}
              </T>
              <IconBtn name="close" size={16} color={c.faint} onPress={() => remove('transactions', t.id)} />
            </ListRow>
          ))}
        </Card>
      </Section>

      <TxSheet visible={sheet === 'tx'} onClose={() => setSheet(null)} />
      <BudgetSheet visible={sheet === 'budget'} onClose={() => setSheet(null)} month={month} budgets={budgets} />
    </Screen>
  );
}

function TxSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState(expenseCategories[0]);
  const [source, setSource] = useState('affiliate');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(today());
  const add = () => {
    if (!(Number(amount) > 0)) return;
    insert('transactions', { type: kind, amount_sar: Number(amount), category: kind === 'expense' ? cat : null, source: kind === 'income' ? source : null, note: note.trim() || null, date: cleanYmd(date) ?? today() });
    setAmount('');
    setNote('');
    onClose();
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="عملية جديدة">
      <Segmented value={kind} onChange={setKind} options={[{ label: 'مصروف', value: 'expense' }, { label: 'دخل', value: 'income' }]} />
      <Field placeholder="المبلغ بالريال" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
      {kind === 'expense' ? <Chips value={cat} onChange={setCat} options={expenseCategories.map((x) => ({ label: x, value: x }))} /> : <Chips value={source} onChange={setSource} options={sources} />}
      <Field placeholder="وصف (غداء، عمولة Amazon…)" value={note} onChangeText={setNote} />
      <Field label="التاريخ" value={date} onChangeText={setDate} />
      <Btn title="سجّل" onPress={add} />
    </Sheet>
  );
}

function BudgetSheet({ visible, onClose, month, budgets }: { visible: boolean; onClose: () => void; month: string; budgets: any[] }) {
  const [cat, setCat] = useState(expenseCategories[0]);
  const [amt, setAmt] = useState('');
  return (
    <Sheet visible={visible} onClose={onClose} title="ميزانية الشهر">
      <Chips value={cat} onChange={setCat} options={expenseCategories.map((x) => ({ label: x, value: x }))} />
      <Field placeholder="الحد الشهري بالريال" keyboardType="decimal-pad" value={amt} onChangeText={setAmt} />
      <Btn
        title="حفظ"
        onPress={() => {
          if (!(Number(amt) > 0)) return;
          const ex = budgets.find((b) => b.category === cat);
          if (ex) update('budgets', ex.id, { limit_sar: Number(amt) });
          else insert('budgets', { month, category: cat, limit_sar: Number(amt) });
          setAmt('');
          onClose();
        }}
      />
      <T size={11} faint>
        اضغط مطوّل على أي ميزانية عشان تحذفها.
      </T>
    </Sheet>
  );
}
