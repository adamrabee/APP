import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logo, Mee } from '@/components/mee';
import { Btn, Card, Field, Segmented, T } from '@/components/ui';
import { signIn, signUp } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

export default function SignIn() {
  const { c } = useTheme();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);

  async function submit() {
    if (!email.includes('@') || password.length < 6) {
      setMsg({ text: 'اكتب إيميل صحيح وكلمة مرور 6 أحرف على الأقل.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    const { data, error } = mode === 'in' ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);
    if (error) {
      setMsg({ text: error.message === 'Invalid login credentials' ? 'الإيميل أو كلمة المرور غلط.' : error.message });
      return;
    }
    if (mode === 'up' && !data.session) {
      setMsg({ text: 'تم إنشاء الحساب. افتح الإيميل وأكّد الحساب، ثم سجّل الدخول.', ok: true });
      setMode('in');
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center', padding: 22, gap: 18 }}>
        <View style={{ alignItems: 'center', gap: 10 }}>
          <Logo size={56} />
          <Mee mood="happy" size={90} />
          <T size={24} w="bold">
            أهلاً في me
          </T>
          <T sub center>
            يومك كله في مكان واحد هادي.
          </T>
        </View>
        <Card style={{ gap: 14 }}>
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { label: 'تسجيل الدخول', value: 'in' },
              { label: 'حساب جديد', value: 'up' },
            ]}
          />
          <Field label="الإيميل" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="name@example.com" style={{ textAlign: 'left', writingDirection: 'ltr' }} />
          <Field label="كلمة المرور" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••" style={{ textAlign: 'left', writingDirection: 'ltr' }} onSubmitEditing={submit} />
          {msg && (
            <T size={13} color={msg.ok ? c.primary : c.danger}>
              {msg.text}
            </T>
          )}
          <Btn title={busy ? '...' : mode === 'in' ? 'دخول' : 'إنشاء حساب'} onPress={submit} disabled={busy} />
        </Card>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
