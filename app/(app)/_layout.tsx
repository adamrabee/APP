import { Stack } from 'expo-router';
import { useTheme } from '@/lib/theme';

export default function AppLayout() {
  const { c } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="quick-add" options={{ presentation: 'transparentModal', animation: 'fade' }} />
    </Stack>
  );
}
