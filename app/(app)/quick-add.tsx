import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Btn, Chips, Field, IconBtn, Row, Segmented, T } from '@/components/ui';
import { expenseCategories } from '@/lib/content';
import { addDays, today } from '@/lib/dates';
import { insert, useQuery } from '@/lib/db';
import { useTheme } from '@/lib/theme';

type Kind = 'task' | 'expense' | 'meal' | 'note' | 'card';

/** H-04 / §5 #10: bottom sheet for fast logging (< 5 seconds). */
export default function QuickAdd() {
  const { c } = useTheme();
  const [kind, setKind] = useState<Kind>('task');
  const [text, setText] = useState('');
  const [amount, setAmount] = useState('');
  const [protein, setProtein] = useState('');
  const [back, setBack] = useState('');
  const [category, setCategory] = useState<string>('personal');
  const [due, setDue] = useState<string | null>(today());
  const [expCat, setExpCat] = useState(expenseCategories[0]);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const favorites = useQuery('meals', (m) => m.is_favorite, (a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const subjects = useQuery('subjects', (s) => !s.archived);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  function save() {
    const t = text.trim();
    if (kind === 'task' && t) insert('tasks', { title: t, category, due_date: due });
    if (kind === 'expense' && Number(amount) > 0) insert('transactions', { type: 'expense', amount_sar: Number(amount), category: expCat, note: t || null, date: today() });
    if (kind === 'meal' && t) insert('meals', { name: t, calories: Number(amount) || 0, protein: Number(protein) || 0, date: today() });
    if (kind === 'note' && t) insert('work_inbox', { text: t, kind: /^https?:\/\//i.test(t) ? 'link' : 'note' });
    if (kind === 'card' && t && back.trim() && (subjectId ?? subjects[0]?.id)) insert('flashcards', { subject_id: subjectId ?? subjects[0].id, front: t, back: back.trim() });
    close();
  }

  const uniqueFavs = Array.from(new Map(favorites.map((m) => [m.name, m])).values()).slice(0, 8);

  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }}>
      <Pressable style={{ flex: 1 }} onPress={close} />
      <KeyboardAvoidingView behavior="padding">
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: c.card, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, gap: 14 }}>
          <Row>
            <T size={18} w="bold" style={{ flex: 1 }}>
              إضافة سريعة
            </T>
            <IconBtn name="close" onPress={close} />
          </Row>
          <Segmented
            value={kind}
            onChange={setKind}
            options={[
              { label: 'مهمة', value: 'task' },
              { label: 'مصروف', value: 'expense' },
              { label: 'وجبة', value: 'meal' },
              { label: 'ملاحظة', value: 'note' },
              { label: 'بطاقة', value: 'card' },
            ]}
          />

          {kind === 'task' && (
            <>
              <Field autoFocus placeholder="عنوان المهمة" value={text} onChangeText={setText} onSubmitEditing={save} returnKeyType="done" />
              <Chips
                value={category}
                onChange={setCategory}
                options={[
                  { label: 'شخصي', value: 'personal' },
                  { label: 'شغل', value: 'work' },
                  { label: 'مذاكرة', value: 'study' },
                  { label: 'صحة', value: 'health' },
                ]}
              />
              <Chips
                value={due ?? 'none'}
                onChange={(v: string) => setDue(v === 'none' ? null : v)}
                options={[
                  { label: 'النهارده', value: today() },
                  { label: 'بكرة', value: addDays(today(), 1) },
                  { label: 'بدون موعد', value: 'none' },
                ]}
              />
            </>
          )}

          {kind === 'expense' && (
            <>
              <Field autoFocus placeholder="المبلغ بالريال" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
              <Chips value={expCat} onChange={setExpCat} options={expenseCategories.map((x) => ({ label: x, value: x }))} />
              <Field placeholder="ملاحظة (اختياري)" value={text} onChangeText={setText} />
            </>
          )}

          {kind === 'meal' && (
            <>
              {uniqueFavs.length > 0 && (
                <View style={{ gap: 6 }}>
                  <T size={13} sub>
                    المفضلة — لمسة واحدة
                  </T>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {uniqueFavs.map((m) => (
                      <Btn
                        key={m.id}
                        small
                        kind="soft"
                        title={`${m.name} · ${m.calories}`}
                        onPress={() => {
                          insert('meals', { name: m.name, calories: m.calories, protein: m.protein, date: today() });
                          close();
                        }}
                      />
                    ))}
                  </View>
                </View>
              )}
              <Field autoFocus={!uniqueFavs.length} placeholder="اسم الوجبة" value={text} onChangeText={setText} />
              <Row>
                <View style={{ flex: 1 }}>
                  <Field placeholder="سعرات" keyboardType="number-pad" value={amount} onChangeText={setAmount} />
                </View>
                <View style={{ flex: 1 }}>
                  <Field placeholder="بروتين (جم)" keyboardType="number-pad" value={protein} onChangeText={setProtein} />
                </View>
              </Row>
            </>
          )}

          {kind === 'note' && <Field autoFocus multiline placeholder="فكرة، لينك، ملاحظة… بتروح لوارد الشغل" value={text} onChangeText={setText} />}

          {kind === 'card' &&
            (subjects.length === 0 ? (
              <T sub>ضيف مادة الأول من تبويب المذاكرة.</T>
            ) : (
              <>
                <Chips value={subjectId ?? subjects[0].id} onChange={setSubjectId} options={subjects.map((s) => ({ label: s.name, value: s.id }))} />
                <Field autoFocus placeholder="السؤال / الكلمة" value={text} onChangeText={setText} />
                <Field placeholder="الجواب / المعنى" value={back} onChangeText={setBack} />
              </>
            ))}

          <Btn title="حفظ" onPress={save} />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}
