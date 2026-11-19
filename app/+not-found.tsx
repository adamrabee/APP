import { router } from 'expo-router';
import { View } from 'react-native';
import { Mee } from '@/components/mee';
import { Btn, T } from '@/components/ui';
import { useTheme } from '@/lib/theme';

export default function NotFound() {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: c.bg }}>
      <Mee mood="sad" size={90} />
      <T w="semibold">الصفحة دي مش موجودة</T>
      <Btn title="رجوع لليوم" onPress={() => router.replace('/')} />
    </View>
  );
}
