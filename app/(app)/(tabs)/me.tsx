import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Image, Pressable, TextInput, View } from 'react-native';
import { HabitEditor } from '@/components/habit-editor';
import { art, Logo, Mee, type Mood } from '@/components/mee';
import { Card, Check, Empty, IconBtn, ListRow, Row, Screen, Section, Sheet, T, tap } from '@/components/ui';
import { bumpHabit } from '@/lib/actions';
import { journalPrompts, moods } from '@/lib/content';
import { parseYmd, shortLabel, today, weekStart } from '@/lib/dates';
import { insert, useNow, useOwn, useQuery, useRows } from '@/lib/db';
import { habitDueOn, streak } from '@/lib/logic';
import { nextPrayer, prayerName, useCoords } from '@/lib/prayer';
import { font, useTheme } from '@/lib/theme';

/** §4.7 me — design: big illustrated cards, inline journal, for-me habits, other sections. */
export default function Me() {
  const { c } = useTheme();
  const plum = c.acc.me;
  const d = today();
  const now = useNow();
  const coords = useCoords();
  const profile = useOwn('profiles');
  const np = nextPrayer(coords, now, profile?.prayer_method);
  const quran = useQuery('quran_logs', (q) => q.date === d, undefined, [d])[0];
  const nodes = useRows('skill_nodes');
  const workTasks = useQuery('work_tasks', (t) => !t.done);
  const inbox = useQuery('work_inbox', (i) => !i.archived);
  const steps = useRows('skincare_steps');
  const [adding, setAdding] = useState(false);

  // journal (M-08…M-10)
  const entries = useQuery('journal_entries', undefined, (a, b) => b.date.localeCompare(a.date) || String(b.created_at).localeCompare(String(a.created_at)));
  const st = streak(entries.map((e) => e.date));
  const [mood, setMood] = useState<string | null>(null);
  const [pi, setPi] = useState(parseYmd(d).getDate() % journalPrompts.length);
  const [free, setFree] = useState(false);
  const [body, setBody] = useState('');
  const saveEntry = () => {
    if (!body.trim()) return;
    insert('journal_entries', { date: d, mood, prompt: free ? null : journalPrompts[pi], body: body.trim() });
    setBody('');
    setMood(null);
  };

  const habits = useQuery('habits', (h) => !h.archived && h.group === 'me', (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const logs = useRows('habit_logs');
  const ws = weekStart(d);

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={12}>
          <Logo size={48} />
          <View style={{ gap: 2 }}>
            <T size={26} w="bold" lh={1.2}>
              me
            </T>
            <T size={13} sub>
              حاجات بتعملها عشان نفسك
            </T>
          </View>
        </Row>
        <IconBtn box name="settings-outline" onPress={() => router.push('/settings')} />
      </Row>

      <ArtCard image={art.worship} width={72} ratio={350 / 420} title="العبادات" text="الصلوات، ورد القرآن، والأذكار" onPress={() => router.push('/worship')}>
        <Row gap={8}>
          <View style={{ flex: 1, backgroundColor: c.acc.worship.bg, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, gap: 2 }}>
            <T size={11} color={c.acc.worship.fg}>
              الصلاة الجاية
            </T>
            <T size={15} w="bold">
              {prayerName[np.prayer]} · {np.at.getHours() % 12 || 12}:{String(np.at.getMinutes()).padStart(2, '0')}
            </T>
          </View>
          <View style={{ flex: 1, backgroundColor: c.bg, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, gap: 2 }}>
            <T size={11} sub>
              ورد اليوم
            </T>
            <T size={15} w="bold">
              {Number(quran?.pages_read ?? 0)}
              {profile?.quran_daily_pages ? ` / ${profile.quran_daily_pages}` : ''} صفحات
            </T>
          </View>
        </Row>
      </ArtCard>
      <ArtCard image={art.skillTree} width={60} ratio={426 / 360} title="شجرة المهارات" text={nodes.length > 1 ? `${nodes.length - 1} عنصر في شجرتك` : 'خريطة تعلّمك ونموّك، بالشكل اللي تختاره'} onPress={() => router.push('/skills')} />
      <ArtCard image={art.work} width={74} ratio={208 / 440} title="الشغل" text={workTasks.length || inbox.length ? `${workTasks.length} مهمة · ${inbox.length} في الوارد` : 'الوارد، المهام، المشاريع، والملاحظات'} onPress={() => router.push('/work')} />
      <ArtCard image={art.skincare} width={54} ratio={256 / 300} title="السكن كير" text={steps.length ? 'روتين الصباح والمساء ورف المنتجات' : 'ابنِ روتينك ورف منتجاتك'} onPress={() => router.push('/skincare')} />

      {/* M-08 journal */}
      <Card style={{ padding: 18, gap: 14 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T size={18} w="bold">
            يومياتي · Self talk
          </T>
          <Pressable onPress={() => router.push('/journal')}>
            <Row gap={4}>
              <Ionicons name="lock-closed-outline" size={12} color={c.sub} />
              <T size={11} sub>
                ليك إنت بس
              </T>
            </Row>
          </Pressable>
        </Row>
        <View style={{ gap: 8 }}>
          <T size={13} sub>
            حاسس بإيه النهارده؟
          </T>
          <Row gap={8}>
            {moods.map((m) => (
              <Pressable key={m.value} onPress={() => (tap(), setMood(m.value))} style={{ flex: 1, borderWidth: 2, borderColor: mood === m.value ? plum.fg : c.line, borderRadius: 16, backgroundColor: c.card, paddingTop: 4, paddingBottom: 6, alignItems: 'center', gap: 2 }}>
                <Mee mood={m.mee as Mood} size={52} />
                <T size={11} w="semibold">
                  {m.label}
                </T>
              </Pressable>
            ))}
          </Row>
        </View>
        {!free && (
          <View style={{ backgroundColor: plum.bg, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <T size={14} w="semibold" color={plum.dark} style={{ flex: 1 }}>
              {journalPrompts[pi]}
            </T>
            <Pressable onPress={() => setPi((pi + 1) % journalPrompts.length)} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="refresh" size={18} color={plum.fg} />
            </Pressable>
          </View>
        )}
        <View style={{ gap: 6 }}>
          <T size={12} sub>
            اكتب لنفسك، من غير ما حد يقرا
          </T>
          <TextInput
            multiline
            value={body}
            onChangeText={setBody}
            placeholderTextColor={c.faint}
            style={{ minHeight: 110, fontFamily: font.regular, fontSize: 15, lineHeight: 25, color: c.text, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 12, backgroundColor: c.input, textAlign: 'right', textAlignVertical: 'top', writingDirection: 'rtl' }}
          />
        </View>
        <Row gap={8}>
          <Pressable onPress={saveEntry} style={{ flex: 1, minHeight: 46, borderRadius: 14, backgroundColor: plum.fg, alignItems: 'center', justifyContent: 'center', opacity: body.trim() ? 1 : 0.5 }}>
            <T size={15} w="bold" color="#FFFFFF">
              احفظ
            </T>
          </Pressable>
          <Pressable onPress={() => setFree(!free)} style={{ minHeight: 46, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
            <T size={14} w="semibold">
              {free ? 'سؤال اليوم' : 'كتابة حرة'}
            </T>
          </Pressable>
        </Row>
        {entries.length > 0 && (
          <View style={{ gap: 10, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 12 }}>
            <T size={12} w="semibold" sub onPress={() => router.push('/journal')}>
              آخر ما كتبت · {st.current} أيام متتالية ‹
            </T>
            {entries.slice(0, 2).map((e) => {
              const m = moods.find((x) => x.value === e.mood);
              return (
                <Row key={e.id} gap={10} style={{ alignItems: 'flex-start' }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
                    <Mee mood={(m?.mee as Mood) ?? 'calm'} size={32} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T size={12} sub>
                      {e.date === d ? 'النهارده' : shortLabel(e.date)} · {new Date(e.created_at).toLocaleTimeString('ar', { hour: 'numeric', minute: '2-digit' })}
                    </T>
                    <T size={14} lh={1.6} lines={3}>
                      {e.body}
                    </T>
                  </View>
                </Row>
              );
            })}
          </View>
        )}
      </Card>

      <Section title="عادات for me" action="+ عادة" onAction={() => setAdding(true)}>
        <Card list>
          {habits.length === 0 && <Empty text="قراءة للمتعة، مشي، قص شعر كل 3 أسابيع، يوم راحة…" mood="coffee" />}
          {habits.map((h, i) => {
            const due = habitDueOn(h, d, logs);
            const done = logs.some((l) => l.habit_id === h.id && l.date === d);
            const weekCount = logs.filter((l) => l.habit_id === h.id && l.date >= ws).length;
            const s = h.schedule as { days?: number[]; every_days?: number } | null;
            const freq = h.period === 'weekly' ? `${h.target_per_day} مرات في الأسبوع` : s?.every_days ? `كل ${s.every_days} يوم` : s?.days?.length ? `${s.days.length} أيام في الأسبوع` : 'يومياً';
            return (
              <ListRow key={h.id} last={i === habits.length - 1} onPress={() => router.push({ pathname: '/habit/[id]', params: { id: h.id } })}>
                <Check on={done} onPress={() => bumpHabit(h)} />
                <View style={{ flex: 1 }}>
                  <T w="medium">{h.name}</T>
                  <T size={12} sub>
                    {freq}
                  </T>
                </View>
                <T size={12} w="medium" sub>
                  {h.period === 'weekly' ? `${weekCount} / ${h.target_per_day}` : due ? 'اليوم' : '—'}
                </T>
              </ListRow>
            );
          })}
        </Card>
      </Section>

      <Section title="أقسام تانية">
        <Row>
          <Tile icon="barbell-outline" label="الجيم والأكل" onPress={() => router.push('/gym')} />
          <Tile icon="wallet-outline" label="الفلوس" onPress={() => router.push('/money')} />
          <Tile icon="stats-chart-outline" label="مراجعة الأسبوع" onPress={() => router.push('/weekly-review')} />
        </Row>
      </Section>

      <Sheet visible={adding} onClose={() => setAdding(false)} title="عادة for me">
        <HabitEditor group="me" onDone={() => setAdding(false)} />
      </Sheet>
    </Screen>
  );
}

function ArtCard({ image, width, ratio, title, text, onPress, children }: { image: number; width: number; ratio: number; title: string; text: string; onPress: () => void; children?: ReactNode }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ backgroundColor: c.card, borderRadius: 24, padding: 16, gap: 14, opacity: pressed ? 0.9 : 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 2 })}
    >
      <Row gap={14}>
        <Image source={image} style={{ width, height: width * ratio }} resizeMode="contain" />
        <View style={{ flex: 1, gap: 2 }}>
          <T size={17} w="bold">
            {title}
          </T>
          <T size={12} sub>
            {text}
          </T>
        </View>
        <Ionicons name="chevron-back" size={18} color={c.faint} />
      </Row>
      {children}
    </Pressable>
  );
}

function Tile({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ flex: 1, backgroundColor: c.card, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 12, gap: 8, minHeight: 88 }}>
      <Ionicons name={icon} size={22} color={c.text} />
      <T size={13} w="semibold">
        {label}
      </T>
    </Pressable>
  );
}
