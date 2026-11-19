import { Ionicons } from '@expo/vector-icons';
import { router, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tap, type IconName } from '@/components/ui';
import { useRows } from '@/lib/db';
import { rescheduleAll } from '@/lib/notify';
import { font, useTheme } from '@/lib/theme';

const tabs: { name: string; title: string; icon: IconName; iconOn: IconName }[] = [
  { name: 'index', title: 'اليوم', icon: 'sunny-outline', iconOn: 'sunny' },
  { name: 'tasks', title: 'المهام', icon: 'checkbox-outline', iconOn: 'checkbox' },
  { name: 'work', title: 'الشغل', icon: 'briefcase-outline', iconOn: 'briefcase' },
  { name: 'study', title: 'المذاكرة', icon: 'book-outline', iconOn: 'book' },
  { name: 'me', title: 'me', icon: 'person-circle-outline', iconOn: 'person-circle' },
];

export default function TabsLayout() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  useNotificationsSync();
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: c.ink,
          tabBarInactiveTintColor: c.faint,
          tabBarStyle: { backgroundColor: c.card, borderTopColor: c.line, height: 60 + insets.bottom, paddingTop: 6 },
          tabBarLabelStyle: { fontFamily: font.medium, fontSize: 11 },
        }}
      >
        {tabs.map((t) => (
          <Tabs.Screen
            key={t.name}
            name={t.name}
            options={{
              title: t.title,
              tabBarIcon: ({ focused, color }) => <Ionicons name={focused ? t.iconOn : t.icon} size={23} color={color as string} />,
            }}
          />
        ))}
      </Tabs>
      {/* H-04: floating quick add, reachable from every tab */}
      <Pressable
        onPress={() => {
          tap();
          router.push('/quick-add');
        }}
        style={({ pressed }) => ({
          position: 'absolute',
          left: 20,
          bottom: 74 + insets.bottom,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: c.ink,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.85 : 1,
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        })}
      >
        <Ionicons name="add" size={30} color={c.onInk} />
      </Pressable>
    </View>
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
