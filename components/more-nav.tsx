import { router, usePathname } from 'expo-router';
import { Pressable, ScrollView } from 'react-native';
import { T } from '@/components/ui';
import { useTheme } from '@/lib/theme';

/** Pill switcher shown on top of Gym / Money (design). */
export function MoreNav() {
  const { c } = useTheme();
  const path = usePathname();
  const items = [
    { href: '/gym', label: 'الجيم والأكل' },
    { href: '/money', label: 'الفلوس' },
    { href: '/work', label: 'الشغل' },
  ] as const;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {items.map((i) => {
        const on = path.startsWith(i.href);
        return (
          <Pressable key={i.href} onPress={() => (on ? null : router.replace(i.href))} style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: on ? c.ink : c.card }}>
            <T size={13} w={on ? 'semibold' : 'medium'} color={on ? c.onInk : c.text}>
              {i.label}
            </T>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
