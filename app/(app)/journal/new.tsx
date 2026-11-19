import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Mee, type Mood } from '@/components/mee';
import { Btn, Card, Field, Row, Screen, Segmented, T, tap } from '@/components/ui';
import { journalPrompts, moods } from '@/lib/content';
import { parseYmd, today } from '@/lib/dates';
import { insert } from '@/lib/db';
import { useTheme } from '@/lib/theme';

/** M-08 / M-09: pick a mood with MEE, then free writing or the question of the day. */
export default function NewEntry() {
  const { c } = useTheme();
  const [mood, setMood] = useState<string | null>(null);
  const [mode, setMode] = useState<'free' | 'prompt'>('prompt');
  const [pi, setPi] = useState(parseYmd(today()).getDate() % journalPrompts.length);
  const [body, setBody] = useState('');

  const save = () => {
    if (!body.trim()) return;
    insert('journal_entries', { date: today(), mood, prompt: mode === 'prompt' ? journalPrompts[pi] : null, body: body.trim() });
    router.back();
  };

  return (
    <Screen back title="يومية جديدة">
      <T w="semibold">عامل إيه النهارده؟</T>
      <Row style={{ justifyContent: 'space-between' }}>
        {moods.map((m) => (
          <Pressable key={m.value} onPress={() => (tap(), setMood(m.value))} style={{ alignItems: 'center', gap: 4, padding: 8, borderRadius: 18, backgroundColor: mood === m.value ? c.card : 'transparent', borderWidth: mood === m.value ? 1.5 : 0, borderColor: c.ink }}>
            <Mee mood={m.mee as Mood} size={56} />
            <T size={12}>{m.label}</T>
          </Pressable>
        ))}
      </Row>
      {mood && (
        <>
          <Segmented value={mode} onChange={setMode} options={[{ label: 'سؤال اليوم', value: 'prompt' }, { label: 'كتابة حرة', value: 'free' }]} />
          {mode === 'prompt' && (
            <Card tint={c.sec.study}>
              <T w="semibold" size={16}>
                {journalPrompts[pi]}
              </T>
              <Btn small kind="ghost" title="سؤال تاني" icon="refresh" onPress={() => setPi((pi + 1) % journalPrompts.length)} />
            </Card>
          )}
          <Field multiline autoFocus placeholder="اكتب براحتك…" value={body} onChangeText={setBody} style={{ minHeight: 220 }} />
          <Btn title="حفظ" onPress={save} disabled={!body.trim()} />
        </>
      )}
      <View style={{ height: 20 }} />
    </Screen>
  );
}
