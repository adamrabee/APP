import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Btn, Chips, Field, Row, T } from '@/components/ui';
import { weekdayShort } from '@/lib/dates';
import { insert, rows, update, type Row as DbRow } from '@/lib/db';
import { useTheme } from '@/lib/theme';

const ICONS = ['water', 'medkit', 'moon', 'walk', 'book', 'barbell', 'leaf', 'cafe', 'sunny', 'heart', 'cut', 'bed', 'musical-notes', 'pencil', 'phone-portrait', 'happy'] as const;

/** Create or edit a habit (T-04, M-04 flexible repeat). */
export function HabitEditor({ habit, group = 'general', onDone }: { habit?: DbRow; group?: 'general' | 'me'; onDone: () => void }) {
  const { c } = useTheme();
  const s = (habit?.schedule ?? {}) as { days?: number[]; every_days?: number };
  const [name, setName] = useState(habit?.name ?? '');
  const [icon, setIcon] = useState<string>(habit?.icon ?? 'water');
  const [period, setPeriod] = useState<'daily' | 'weekly'>(habit?.period ?? 'daily');
  const [target, setTarget] = useState(String(habit?.target_per_day ?? 1));
  const [mode, setMode] = useState<'every' | 'days' | 'interval'>(s.days?.length ? 'days' : s.every_days ? 'interval' : 'every');
  const [days, setDays] = useState<number[]>(s.days ?? []);
  const [interval, setInterval] = useState(String(s.every_days ?? 21));
  const [remind, setRemind] = useState(habit?.remind_at?.slice(0, 5) ?? '');
  const [grp, setGrp] = useState<'general' | 'me'>(habit?.group ?? group);

  function save() {
    if (!name.trim()) return;
    const schedule = mode === 'days' && days.length ? { days } : mode === 'interval' ? { every_days: Math.max(1, Number(interval) || 1) } : null;
    const values = {
      name: name.trim(),
      icon,
      period,
      target_per_day: Math.max(1, Number(target) || 1),
      schedule,
      remind_at: /^\d{1,2}:\d{2}$/.test(remind) ? remind : null,
      group: grp,
    };
    if (habit) update('habits', habit.id, values);
    else insert('habits', { ...values, sort_order: rows('habits').length });
    onDone();
  }

  return (
    <View style={{ gap: 14 }}>
      <Field label="الاسم" placeholder="شرب مياه، فيتامينات، نوم بدري…" value={name} onChangeText={setName} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {ICONS.map((i) => (
          <Pressable key={i} onPress={() => setIcon(i)} style={{ width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: icon === i ? c.ink : c.bg }}>
            <Ionicons name={i as any} size={20} color={icon === i ? c.onInk : c.text} />
          </Pressable>
        ))}
      </View>
      <Chips value={grp} onChange={setGrp} options={[{ label: 'عادة عامة', value: 'general' }, { label: 'for me', value: 'me' }]} />
      <Chips value={period} onChange={setPeriod} options={[{ label: 'هدف يومي', value: 'daily' }, { label: 'هدف أسبوعي', value: 'weekly' }]} />
      <Field label={period === 'daily' ? 'كام مرة في اليوم؟' : 'كام مرة في الأسبوع؟'} keyboardType="number-pad" value={target} onChangeText={setTarget} />
      <T size={13} sub>
        التكرار
      </T>
      <Chips
        value={mode}
        onChange={setMode}
        options={[
          { label: 'كل يوم', value: 'every' },
          { label: 'أيام محددة', value: 'days' },
          { label: 'كل كام يوم', value: 'interval' },
        ]}
      />
      {mode === 'days' && <Chips multi value={days} onChange={setDays} options={weekdayShort.map((label, value) => ({ label, value }))} />}
      {mode === 'interval' && <Field label="كل كام يوم؟ (مثلاً قص شعر كل 21 يوم)" keyboardType="number-pad" value={interval} onChangeText={setInterval} />}
      <Field label="وقت التذكير (اختياري) مثل 21:00" value={remind} onChangeText={setRemind} placeholder="HH:MM" />
      <Row>
        <Btn title="حفظ" onPress={save} style={{ flex: 1 }} />
      </Row>
    </View>
  );
}
