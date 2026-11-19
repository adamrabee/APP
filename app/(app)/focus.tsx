import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Mistakes } from '@/components/mistakes';
import { Btn, Card, Chips, Field, Ring, Row, Screen, SectionTitle, T } from '@/components/ui';
import { insert, useQuery } from '@/lib/db';
import { cancelNotif, notifyIn } from '@/lib/notify';
import { useTheme } from '@/lib/theme';

const KEY = 'me.focus';
type Saved = { focus: number; brk: number; phase: 'idle' | 'focus' | 'break'; endsAt: number | null; startedAt: number | null; subject: string | null; unit: string | null; notifId: string | null };

/** S-03: Pomodoro with custom durations. The session is logged to the subject/unit. Survives closing the app. */
export default function Focus() {
  const { c } = useTheme();
  const params = useLocalSearchParams<{ subject?: string; unit?: string }>();
  const subjects = useQuery('subjects', (s) => !s.archived);
  const [st, setSt] = useState<Saved>({ focus: 25, brk: 5, phase: 'idle', endsAt: null, startedAt: null, subject: params.subject ?? null, unit: params.unit ?? null, notifId: null });
  const [now, setNow] = useState(Date.now());
  const loaded = useRef(false);
  const units = useQuery('subject_units', (u) => u.subject_id === st.subject && u.status !== 'done', (a, b) => a.sort_order - b.sort_order, [st.subject]);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((raw) => {
      if (raw) {
        const saved = JSON.parse(raw) as Saved;
        setSt((cur) => ({ ...saved, subject: params.subject ?? saved.subject, unit: params.unit ?? saved.unit }));
      }
      loaded.current = true;
    });
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loaded.current) AsyncStorage.setItem(KEY, JSON.stringify(st)).catch(() => {});
  }, [st]);

  // phase finished?
  useEffect(() => {
    if (st.endsAt && now >= st.endsAt) {
      if (st.phase === 'focus') {
        logSession(st.focus);
        setSt((s) => ({ ...s, phase: 'idle', endsAt: null, startedAt: null, notifId: null }));
        startBreak();
      } else {
        setSt((s) => ({ ...s, phase: 'idle', endsAt: null, startedAt: null, notifId: null }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  function logSession(minutes: number) {
    if (!st.subject || minutes < 1) return;
    insert('study_sessions', { subject_id: st.subject, unit_id: st.unit, minutes: Math.round(minutes), started_at: new Date(st.startedAt ?? Date.now()).toISOString() });
  }

  async function start() {
    const end = Date.now() + st.focus * 60000;
    const notifId = await notifyIn(st.focus * 60, 'خلصت جلسة التركيز 👏', `خد راحة ${st.brk} دقايق`);
    setSt((s) => ({ ...s, phase: 'focus', endsAt: end, startedAt: Date.now(), notifId }));
  }
  async function startBreak() {
    const end = Date.now() + st.brk * 60000;
    const notifId = await notifyIn(st.brk * 60, 'الراحة خلصت', 'جاهز للجلسة الجاية؟');
    setSt((s) => ({ ...s, phase: 'break', endsAt: end, startedAt: Date.now(), notifId }));
  }
  async function stop(save: boolean) {
    await cancelNotif(st.notifId);
    if (save && st.phase === 'focus' && st.startedAt) logSession((Date.now() - st.startedAt) / 60000);
    setSt((s) => ({ ...s, phase: 'idle', endsAt: null, startedAt: null, notifId: null }));
  }

  const total = (st.phase === 'break' ? st.brk : st.focus) * 60000;
  const left = st.endsAt ? Math.max(0, st.endsAt - now) : st.focus * 60000;
  const mm = String(Math.floor(left / 60000)).padStart(2, '0');
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0');
  const running = st.phase !== 'idle';
  const subject = subjects.find((s) => s.id === st.subject);

  return (
    <Screen back title="جلسة تركيز">
      <View style={{ alignItems: 'center', paddingVertical: 12 }}>
        <Ring value={running ? 1 - left / total : 0} size={220} stroke={10} color={st.phase === 'break' ? c.primary : c.ink}>
          <T size={46} w="bold">
            {mm}:{ss}
          </T>
          <T sub>{st.phase === 'focus' ? `تركيز${subject ? ` · ${subject.name}` : ''}` : st.phase === 'break' ? 'راحة' : 'جاهز'}</T>
        </Ring>
      </View>
      {running ? (
        <Row>
          <Btn style={{ flex: 1 }} title={st.phase === 'focus' ? 'إنهاء وحفظ' : 'إنهاء الراحة'} onPress={() => stop(true)} />
          <Btn style={{ flex: 1 }} kind="ghost" title="إلغاء" onPress={() => stop(false)} />
        </Row>
      ) : (
        <>
          <Card>
            <T size={13} sub>
              المادة
            </T>
            {subjects.length ? (
              <Chips value={st.subject} onChange={(v: string) => setSt({ ...st, subject: v, unit: null })} options={subjects.map((s) => ({ label: s.name, value: s.id }))} />
            ) : (
              <T sub>ضيف مادة الأول عشان الجلسة تتسجل عليها.</T>
            )}
            {units.length > 0 && (
              <>
                <T size={13} sub>
                  الجزء (اختياري)
                </T>
                <Chips value={st.unit} onChange={(v: string) => setSt({ ...st, unit: st.unit === v ? null : v })} options={units.map((u) => ({ label: u.title, value: u.id }))} />
              </>
            )}
            <Row>
              <View style={{ flex: 1 }}>
                <Field label="تركيز (دقيقة)" keyboardType="number-pad" value={String(st.focus)} onChangeText={(v) => setSt({ ...st, focus: Math.max(1, Number(v) || 1) })} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="راحة (دقيقة)" keyboardType="number-pad" value={String(st.brk)} onChangeText={(v) => setSt({ ...st, brk: Math.max(1, Number(v) || 1) })} />
              </View>
            </Row>
            <Chips
              value={`${st.focus}/${st.brk}`}
              onChange={(v: string) => {
                const [f, b] = v.split('/').map(Number);
                setSt({ ...st, focus: f, brk: b });
              }}
              options={[
                { label: '25/5', value: '25/5' },
                { label: '50/10', value: '50/10' },
                { label: '90/15', value: '90/15' },
              ]}
            />
          </Card>
          <Btn title="ابدأ" icon="play" onPress={start} />
          {/* S-09: mistakes bank shows before the session */}
          {st.subject && (
            <>
              <SectionTitle>بنك الأخطاء قبل ما تبدأ</SectionTitle>
              <Mistakes subjectId={st.subject} compact />
            </>
          )}
        </>
      )}
    </Screen>
  );
}
