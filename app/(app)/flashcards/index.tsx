import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Btn, Card, Empty, Row, Screen, T } from '@/components/ui';
import { today } from '@/lib/dates';
import { get, rows, update, useRows } from '@/lib/db';
import { gradeCard } from '@/lib/logic';
import { useTheme } from '@/lib/theme';

/** S-06: review due cards — easy / medium / hard. */
export default function Flashcards() {
  const { subject } = useLocalSearchParams<{ subject?: string }>();
  const { c } = useTheme();
  useRows('flashcards');
  useRows('subjects');
  // freeze the queue at session start so graded cards don't reshuffle
  const queue = useMemo(
    () => rows('flashcards').filter((f) => f.due_date <= today() && (!subject || f.subject_id === subject)).map((f) => f.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subject],
  );
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = get('flashcards', queue[i]);

  if (!card) {
    return (
      <Screen back="المذاكرة" backColor={c.acc.study.fg} title="البطاقات">
        <Card>
          <Empty text={queue.length ? `خلصت ${queue.length} بطاقة 👏` : 'مفيش بطاقات مستحقة دلوقتي.'} mood={queue.length ? 'stars' : 'happy'} />
        </Card>
      </Screen>
    );
  }
  const grade = (g: 'easy' | 'medium' | 'hard') => {
    update('flashcards', card.id, gradeCard(card, g));
    setFlipped(false);
    setI(i + 1);
  };
  return (
    <Screen back="المذاكرة" backColor={c.acc.study.fg} title={`البطاقات ${i + 1}/${queue.length}`}>
      <T sub center>
        {get('subjects', card.subject_id)?.name}
      </T>
      <Pressable onPress={() => setFlipped(!flipped)}>
        <Card style={{ minHeight: 260, alignItems: 'center', justifyContent: 'center' }}>
          <T size={22} w="bold" center>
            {flipped ? card.back : card.front}
          </T>
          {!flipped && (
            <T size={12} faint>
              اضغط عشان تشوف الجواب
            </T>
          )}
        </Card>
      </Pressable>
      {flipped ? (
        <Row>
          <Btn style={{ flex: 1 }} kind="danger" title="صعب" onPress={() => grade('hard')} />
          <Btn style={{ flex: 1 }} kind="ghost" title="متوسط" onPress={() => grade('medium')} />
          <Btn style={{ flex: 1 }} title="سهل" onPress={() => grade('easy')} />
        </Row>
      ) : (
        <Btn title="اقلب البطاقة" onPress={() => setFlipped(true)} />
      )}
      <View style={{ height: 1, backgroundColor: c.line }} />
    </Screen>
  );
}
