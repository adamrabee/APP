import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { HabitEditor } from '@/components/habit-editor';
import { JarLogo, Logo, Mee } from '@/components/mee';
import { Btn, Card, Empty, ListItem, Row, Screen, SectionTitle, Sheet, T } from '@/components/ui';
import { bumpHabit } from '@/lib/actions';
import { today } from '@/lib/dates';
import { useQuery, useRows } from '@/lib/db';
import { habitDueOn, habitStreak } from '@/lib/logic';
import { useTheme } from '@/lib/theme';

/** §4.7 me: self-care hub + links to the other sections (M-06). */
export default function Me() {
  const { c } = useTheme();
  const d = today();
  const [adding, setAdding] = useState(false);
  const habits = useQuery('habits', (h) => !h.archived && h.group === 'me', (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const logs = useRows('habit_logs');
  const journal = useQuery('journal_entries', (j) => j.date === d, undefined, [d]);
  const nodes = useRows('skill_nodes');

  return (
    <Screen>
      <Row>
        <Logo size={36} />
        <T size={22} w="bold" style={{ flex: 1 }}>
          me
        </T>
        <Pressable onPress={() => router.push('/settings')} hitSlop={10}>
          <Ionicons name="settings-outline" size={22} color={c.text} />
        </Pressable>
      </Row>

      <Row>
        <Card onPress={() => router.push('/skincare')} tint={c.sec.me} style={{ flex: 1, alignItems: 'flex-start' }}>
          <JarLogo size={36} color={c.ink} />
          <T w="bold">السكن كير</T>
          <T size={12} sub>
            الروتين ورف المنتجات
          </T>
        </Card>
        <Card onPress={() => router.push('/journal')} tint={c.sec.study} style={{ flex: 1, alignItems: 'flex-start' }}>
          <Mee mood={journal.length ? 'happy' : 'calm'} size={40} />
          <T w="bold">يومياتي</T>
          <T size={12} sub>
            {journal.length ? 'كتبت النهارده ✓' : 'Self talk'}
          </T>
        </Card>
      </Row>

      <Card onPress={() => router.push('/skills')} style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="git-network-outline" size={26} color={c.text} />
        <View style={{ flex: 1 }}>
          <T w="bold">شجرة المهارات</T>
          <T size={12} sub>
            {nodes.length > 1 ? `${nodes.length - 1} عنصر` : 'ابنِ خريطة تعلّمك من الصفر'}
          </T>
        </View>
        <Ionicons name="chevron-back" size={18} color={c.faint} />
      </Card>

      <SectionTitle action="+ عادة" onAction={() => setAdding(true)}>
        for me
      </SectionTitle>
      <Card style={{ gap: 0 }}>
        {habits.length === 0 && <Empty text="قراءة للمتعة، مشي، قص شعر كل 3 أسابيع، يوم راحة…" mood="coffee" />}
        {habits.map((h) => {
          const due = habitDueOn(h, d, logs);
          const done = logs.some((l) => l.habit_id === h.id && l.date === d);
          const s = habitStreak(h, logs);
          return (
            <ListItem
              key={h.id}
              icon={(h.icon as any) || 'heart'}
              title={h.name}
              subtitle={`${due ? (done ? 'اتعملت النهارده ✓' : 'مطلوبة النهارده') : 'مش النهارده'} · 🔥 ${s.current}`}
              onPress={() => router.push({ pathname: '/habit/[id]', params: { id: h.id } })}
              right={<Btn small kind={done ? 'ink' : 'ghost'} title={done ? '✓' : 'تم'} onPress={() => bumpHabit(h)} />}
            />
          );
        })}
      </Card>

      <SectionTitle>الأقسام</SectionTitle>
      <Card style={{ gap: 0 }}>
        <ListItem icon="moon-outline" title="العبادات" subtitle="الصلاة، الورد، جدول الحفظ" onPress={() => router.push('/worship')} />
        <ListItem icon="barbell-outline" title="الجيم والأكل" subtitle="التمارين، الوزن، السعرات والبروتين" onPress={() => router.push('/gym')} />
        <ListItem icon="wallet-outline" title="الفلوس" subtitle="المصاريف، الدخل، الميزانية" onPress={() => router.push('/money')} />
        <ListItem icon="stats-chart-outline" title="مراجعة الأسبوع" subtitle="MEE وسكور الأسبوع" onPress={() => router.push('/weekly-review')} />
        <ListItem icon="search-outline" title="بحث" subtitle="في المهام والملاحظات والمصاريف" onPress={() => router.push('/search')} />
        <ListItem icon="settings-outline" title="الإعدادات" subtitle="المظهر، الإشعارات، الأهداف" onPress={() => router.push('/settings')} />
      </Card>

      <Sheet visible={adding} onClose={() => setAdding(false)} title="عادة for me">
        <HabitEditor group="me" onDone={() => setAdding(false)} />
      </Sheet>
    </Screen>
  );
}
