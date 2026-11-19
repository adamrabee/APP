import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Btn, Card, Empty, Field, IconBtn, Pill, Row, T } from '@/components/ui';
import { insert, remove, update, useQuery } from '@/lib/db';

/** S-09: mistakes bank per subject. */
export function Mistakes({ subjectId, compact }: { subjectId: string; compact?: boolean }) {
  const list = useQuery('mistakes', (m) => m.subject_id === subjectId, (a, b) => a.times_seen - b.times_seen, [subjectId]);
  const [text, setText] = useState('');
  const add = () => text.trim() && (insert('mistakes', { subject_id: subjectId, text: text.trim() }), setText(''));
  return (
    <>
      {!compact && (
        <Row>
          <View style={{ flex: 1 }}>
            <Field placeholder="غلطة عايز تفتكرها…" value={text} onChangeText={setText} onSubmitEditing={add} />
          </View>
          <Btn small title="أضف" onPress={add} />
        </Row>
      )}
      {list.length === 0 && <Empty text="بنك الأخطاء فاضي." mood="happy" />}
      {list.map((m) => (
        <Card key={m.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <T style={{ flex: 1 }}>{m.text}</T>
          <Pressable onPress={() => update('mistakes', m.id, { times_seen: m.times_seen + 1 })}>
            <Pill text={`شُفتها ${m.times_seen}`} />
          </Pressable>
          {!compact && <IconBtn name="checkmark-done-outline" size={18} onPress={() => remove('mistakes', m.id)} />}
        </Card>
      ))}
    </>
  );
}

