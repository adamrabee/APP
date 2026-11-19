import { useState } from 'react';
import { View } from 'react-native';
import { Bar, Btn, Card, Chips, Empty, Field, IconBtn, Row, Screen, SectionTitle, Segmented, Stat, T } from '@/components/ui';
import { expenseCategories } from '@/lib/content';
import { cleanYmd, monthStart, parseYmd, shortLabel, today, ymd } from '@/lib/dates';
import { insert, remove, update, useQuery } from '@/lib/db';
import { useTheme } from '@/lib/theme';

const sources = [
  { label: 'أفلييت', value: 'affiliate' },
  { label: 'تدريس', value: 'teaching' },
  { label: 'أخرى', value: 'other' },
];

/** §4.5 money: expenses (F-01), income by source (F-02), monthly budgets (F-03), monthly summary (F-04). */
export default function Money() {
  const { c } = useTheme();
  const [month, setMonth] = useState(monthStart());
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState(expenseCategories[0]);
  const [source, setSource] = useState('affiliate');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(today());
  const [budgetCat, setBudgetCat] = useState(expenseCategories[0]);
  const [budgetAmt, setBudgetAmt] = useState('');
  const next = ymd(new Date(parseYmd(month).getFullYear(), parseYmd(month).getMonth() + 1, 1));
  const tx = useQuery('transactions', (t) => t.date >= month && t.date < next, (a, b) => b.date.localeCompare(a.date) || String(b.created_at).localeCompare(String(a.created_at)), [month]);
  const budgets = useQuery('budgets', (b) => b.month === month, undefined, [month]);
  const income = tx.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount_sar), 0);
  const expense = tx.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount_sar), 0);
  const spentBy = (category: string) => tx.filter((t) => t.type === 'expense' && t.category === category).reduce((s, t) => s + Number(t.amount_sar), 0);

  const add = () => {
    if (!(Number(amount) > 0)) return;
    insert('transactions', {
      type: kind,
      amount_sar: Number(amount),
      category: kind === 'expense' ? cat : null,
      source: kind === 'income' ? source : null,
      note: note.trim() || null,
      date: cleanYmd(date) ?? today(),
    });
    setAmount('');
    setNote('');
  };
  const shift = (n: number) => {
    const d = parseYmd(month);
    setMonth(ymd(new Date(d.getFullYear(), d.getMonth() + n, 1)));
  };

  return (
    <Screen back="me" title="الفلوس">
      <Row>
        <IconBtn name="chevron-forward" onPress={() => shift(-1)} />
        <T w="bold" center style={{ flex: 1 }}>
          {parseYmd(month).toLocaleDateString('ar', { month: 'long', year: 'numeric' })}
        </T>
        <IconBtn name="chevron-back" onPress={() => shift(1)} />
      </Row>
      <Row>
        <Stat label="الدخل" value={`${income}`} sub="ر.س" />
        <Stat label="المصاريف" value={`${expense}`} sub="ر.س" />
        <Stat label="الصافي" value={`${income - expense}`} sub="ر.س" />
      </Row>

      <Card>
        <Segmented value={kind} onChange={setKind} options={[{ label: 'مصروف', value: 'expense' }, { label: 'دخل', value: 'income' }]} />
        <Field placeholder="المبلغ بالريال" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
        {kind === 'expense' ? (
          <Chips value={cat} onChange={setCat} options={expenseCategories.map((x) => ({ label: x, value: x }))} />
        ) : (
          <Chips value={source} onChange={setSource} options={sources} />
        )}
        <Row>
          <View style={{ flex: 2 }}>
            <Field placeholder="ملاحظة" value={note} onChangeText={setNote} />
          </View>
          <View style={{ flex: 1.3 }}>
            <Field value={date} onChangeText={setDate} />
          </View>
        </Row>
        <Btn title="سجّل" onPress={add} />
      </Card>

      <SectionTitle>الميزانية</SectionTitle>
      <Card>
        {budgets.length === 0 && <T sub>حدد ميزانية شهرية لكل فئة.</T>}
        {budgets.map((b) => {
          const spent = spentBy(b.category);
          const left = Number(b.limit_sar) - spent;
          return (
            <View key={b.id} style={{ gap: 4 }}>
              <Row>
                <T w="medium" style={{ flex: 1 }}>
                  {b.category}
                </T>
                <T size={12} color={left < 0 ? c.danger : c.sub}>
                  {left < 0 ? `زيادة ${-left}` : `فاضل ${left}`} من {b.limit_sar}
                </T>
                <IconBtn name="close" size={16} onPress={() => remove('budgets', b.id)} />
              </Row>
              <Bar value={spent / Number(b.limit_sar)} color={left < 0 ? c.danger : c.primary} />
            </View>
          );
        })}
        <Chips value={budgetCat} onChange={setBudgetCat} options={expenseCategories.map((x) => ({ label: x, value: x }))} />
        <Row>
          <View style={{ flex: 1 }}>
            <Field placeholder="الحد الشهري" keyboardType="decimal-pad" value={budgetAmt} onChangeText={setBudgetAmt} />
          </View>
          <Btn
            small
            title="حفظ"
            onPress={() => {
              if (!(Number(budgetAmt) > 0)) return;
              const ex = budgets.find((b) => b.category === budgetCat);
              if (ex) update('budgets', ex.id, { limit_sar: Number(budgetAmt) });
              else insert('budgets', { month, category: budgetCat, limit_sar: Number(budgetAmt) });
              setBudgetAmt('');
            }}
          />
        </Row>
      </Card>

      <SectionTitle>آخر العمليات</SectionTitle>
      {tx.length === 0 && <Empty text="مفيش عمليات الشهر ده." mood="calm" />}
      {tx.map((t) => (
        <Card key={t.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <T w="medium">{t.type === 'expense' ? t.category ?? 'مصروف' : sources.find((s) => s.value === t.source)?.label ?? 'دخل'}</T>
            <T size={12} sub>
              {shortLabel(t.date)}
              {t.note ? ` · ${t.note}` : ''}
            </T>
          </View>
          <T w="bold" color={t.type === 'income' ? c.primary : c.text}>
            {t.type === 'income' ? '+' : '−'}
            {Number(t.amount_sar)}
          </T>
          <IconBtn name="close" size={16} onPress={() => remove('transactions', t.id)} />
        </Card>
      ))}
    </Screen>
  );
}
