import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { Mee, type Mood } from '@/components/mee';
import { Btn, Card, confirm, Empty, Field, IconBtn, Row, Screen, Stat, T } from '@/components/ui';
import { JOURNAL_LOCK_KEY as LOCK_KEY, moods } from '@/lib/content';
import { gregorianLabel } from '@/lib/dates';
import { remove, useQuery } from '@/lib/db';
import { streak } from '@/lib/logic';



/** M-10 archive + search + streak, M-11 biometric lock. */
export default function Journal() {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [q, setQ] = useState('');
  const entries = useQuery('journal_entries', (e) => !q || `${e.body} ${e.prompt ?? ''}`.includes(q), (a, b) => b.date.localeCompare(a.date) || String(b.created_at).localeCompare(String(a.created_at)), [q]);
  const all = useQuery('journal_entries');
  const st = streak(all.map((e) => e.date));

  useEffect(() => {
    (async () => {
      const locked = (await AsyncStorage.getItem(LOCK_KEY).catch(() => null)) === '1';
      if (!locked || Platform.OS === 'web') return setUnlocked(true);
      const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'افتح يومياتك', cancelLabel: 'إلغاء' });
      setUnlocked(res.success);
    })();
  }, []);

  if (unlocked === null) return <Screen back title="يومياتي">{null}</Screen>;
  if (!unlocked) {
    return (
      <Screen back title="يومياتي">
        <Card>
          <Empty text="اليوميات مقفولة." mood="sleep" />
          <Btn title="حاول تاني" onPress={() => router.replace('/journal')} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen back title="يومياتي">
      <Btn title="اكتب النهارده" icon="create-outline" onPress={() => router.push('/journal/new')} />
      <Row>
        <Stat label="سلسلة الكتابة" value={`🔥 ${st.current}`} sub={`الأطول ${st.longest}`} />
        <Stat label="كل اليوميات" value={all.length} />
      </Row>
      <Field placeholder="ابحث في يومياتك…" value={q} onChangeText={setQ} />
      {entries.length === 0 && <Empty text={q ? 'مفيش نتائج.' : 'لسه ما كتبتش. ابدأ بسطر واحد.'} mood="calm" />}
      {entries.map((e) => {
        const m = moods.find((x) => x.value === e.mood);
        return (
          <Card key={e.id} style={{ gap: 6 }}>
            <Row>
              {m && <Mee mood={m.mee as Mood} size={34} />}
              <View style={{ flex: 1 }}>
                <T w="semibold">{gregorianLabel(e.date)}</T>
                {m && (
                  <T size={12} sub>
                    {m.label}
                  </T>
                )}
              </View>
              <IconBtn name="trash-outline" size={18} onPress={() => confirm('تحذف اليومية دي؟', () => remove('journal_entries', e.id))} />
            </Row>
            {e.prompt ? (
              <T size={13} sub>
                {e.prompt}
              </T>
            ) : null}
            <T>{e.body}</T>
          </Card>
        );
      })}
    </Screen>
  );
}
