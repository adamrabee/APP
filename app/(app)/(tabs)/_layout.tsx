import { Ionicons } from '@expo/vector-icons';
import { router, Tabs, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, tap } from '@/components/ui';
import { useRows } from '@/lib/db';
import { rescheduleAll } from '@/lib/notify';
import { useTheme } from '@/lib/theme';

// 3D tab icons from the design: soft white when idle, black tile when active.
const tabs = [
  { name: 'index', title: 'اليوم', icon: require('@/assets/design/tab-today.png'), on: require('@/assets/design/tab-today-on.png') },
  { name: 'tasks', title: 'المهام', icon: require('@/assets/design/tab-tasks.png'), on: require('@/assets/design/tab-tasks-on.png') },
  { name: 'work', title: 'الشغل', icon: require('@/assets/design/tab-work.png'), on: require('@/assets/design/tab-work-on.png') },
  { name: 'study', title: 'المذاكرة', icon: require('@/assets/design/tab-study.png'), on: require('@/assets/design/tab-study-on.png') },
  { name: 'me', title: 'me', icon: require('@/assets/design/tab-me.png'), on: require('@/assets/design/tab-me-on.png') },
];

export default function TabsLayout() {
  useNotificationsSync();
  return (
    <View style={{ flex: 1 }}>
      <Tabs screenOptions={{ headerShown: false }} tabBar={(p: any) => <TabBar {...p} />}>
        {tabs.map((t) => (
          <Tabs.Screen key={t.name} name={t.name} options={{ title: t.title }} />
        ))}
      </Tabs>
      <Fab />
    </View>
  );
}

// Tab bar props here don't include `navigation`, so tabs navigate through the router.
const tabHref: Record<string, '/' | '/tasks' | '/work' | '/study' | '/me'> = { index: '/', tasks: '/tasks', work: '/work', study: '/study', me: '/me' };

function TabBar({ state }: { state: any }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-around',
          alignItems: 'flex-start',
          backgroundColor: c.card,
          borderTopWidth: 1,
          borderTopColor: c.border,
          paddingTop: 6,
          height: 70 + insets.bottom,
        }}
      >
        {state.routes.map((route: any, i: number) => {
          const t = tabs.find((x) => x.name === route.name);
          if (!t) return null;
          const focused = state.index === i;
          return (
            <Pressable
              key={route.key}
              onPress={() => {
                tap();
                if (!focused) router.navigate(tabHref[route.name] ?? '/');
              }}
              style={{ width: 64, minHeight: 48, alignItems: 'center', gap: 3 }}
            >
              <Image source={focused ? t.on : t.icon} style={{ width: 32, height: 32 }} resizeMode="contain" />
              <T size={11} w={focused ? 'bold' : 'medium'} color={focused ? c.text : c.sub} lh={1.2}>
                {t.title}
              </T>
              <View style={{ width: 18, height: 3, borderRadius: 2, backgroundColor: focused ? c.text : 'transparent' }} />
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

function Fab() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const onWork = usePathname().startsWith('/work');
  // H-04 quick add — green rounded square; black on the Work tab (as in the design)
  return (
    <Pressable
      accessibilityLabel="إضافة سريعة"
      onPress={() => {
        tap();
        router.push('/quick-add');
      }}
      style={({ pressed }) => ({
        position: 'absolute',
        left: onWork ? 18 : 20,
        bottom: 86 + insets.bottom,
        width: onWork ? 58 : 56,
        height: onWork ? 58 : 56,
        borderRadius: onWork ? 20 : 18,
        backgroundColor: onWork ? '#1F1F1F' : c.primary,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.85 : 1,
        shadowColor: onWork ? '#000' : c.primary,
        shadowOpacity: onWork ? 0.24 : 0.28,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
        zIndex: 10,
      })}
    >
      <Ionicons name="add" size={26} color="#FFFFFF" />
    </Pressable>
  );
}

/** Keep local notifications in step with the data they depend on. */
function useNotificationsSync() {
  const settings = useRows('notification_settings');
  const habits = useRows('habits');
  const tasks = useRows('tasks');
  const subjects = useRows('subjects');
  const slots = useRows('study_slots');
  const products = useRows('products');
  const profile = useRows('profiles');
  useEffect(() => {
    const t = setTimeout(() => rescheduleAll().catch(() => {}), 1500);
    return () => clearTimeout(t);
  }, [settings, habits, tasks, subjects, slots, products, profile]);
}
