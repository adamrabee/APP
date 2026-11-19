import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Platform, Switch, View } from 'react-native';
import { Btn, Card, Chips, confirm, Field, Row, Screen, SectionTitle, Segmented, T } from '@/components/ui';
import { signOut, useAuth } from '@/lib/auth';
import { JOURNAL_LOCK_KEY, sectionLabels } from '@/lib/content';
import { insert, rows, update, upsertOwn, useOwn, useRows, useSync } from '@/lib/db';
import { globalSettings, NOTIF_META, rescheduleAll, settingFor } from '@/lib/notify';
import { refreshLocation } from '@/lib/prayer';
import { useTheme } from '@/lib/theme';

/** X-03 settings, X-06 appearance, N-01/N-07 notifications, score weights. */
export default function Settings() {
  const { c, mode, setMode } = useTheme();
  const { session } = useAuth();
  const profile = useOwn('profiles');
  useRows('notification_settings');
  const sync = useSync();
  const [city, setCity] = useState<string>('');
  const [goals, setGoals] = useState({ cal: '', pro: '', quran: '' });
  const [lock, setLock] = useState(false);
  const g = globalSettings();
  const [quiet, setQuiet] = useState({ from: g.quiet_from, to: g.quiet_to, cap: String(g.daily_cap) });

  useEffect(() => {
    setGoals({ cal: String(profile?.calorie_goal ?? ''), pro: String(profile?.protein_goal ?? ''), quran: String(profile?.quran_daily_pages ?? '') });
  }, [profile?.calorie_goal, profile?.protein_goal, profile?.quran_daily_pages]);
  useEffect(() => {
    AsyncStorage.getItem(JOURNAL_LOCK_KEY).then((v) => setLock(v === '1')).catch(() => {});
  }, []);

  const setNotif = (type: string, patch: Record<string, any>) => {
    const r = rows('notification_settings').find((x) => x.type === type);
    if (r) update('notification_settings', r.id, patch);
    else insert('notification_settings', { type, enabled: settingFor(type).enabled, time: settingFor(type).time, ...patch });
  };
  const weights = (profile?.score_weights as Record<string, number>) ?? {};
  const groups = Array.from(new Set(NOTIF_META.map((m) => m.group)));

  return (
    <Screen back title="الإعدادات">
      <SectionTitle>المظهر</SectionTitle>
      <Segmented
        value={mode}
        onChange={(m) => (setMode(m), upsertOwn('profiles', { theme: m }))}
        options={[
          { label: 'فاتح', value: 'light' },
          { label: 'داكن', value: 'dark' },
        ]}
      />

      <SectionTitle>الحساب والمزامنة</SectionTitle>
      <Card>
        <T size={13} sub>
          {session?.user.email}
        </T>
        <T size={13}>
          {sync.pending ? `${sync.pending} تعديل مستني يتزامن ${sync.online ? '' : '(بدون نت — محفوظ على الجهاز)'}` : 'كل البيانات متزامنة مع السحابة ✓'}
        </T>
        <Btn kind="ghost" small title="تسجيل خروج" onPress={() => confirm('تسجّل خروج؟', signOut)} />
      </Card>

      <SectionTitle>المدينة والصلاة</SectionTitle>
      <Card>
        <Row>
          <T style={{ flex: 1 }}>{city || profile?.city || 'حسب موقعك'}</T>
          <Btn
            small
            kind="soft"
            title="تحديث الموقع"
            onPress={async () => {
              const co = await refreshLocation();
              setCity(co.city ?? '');
              upsertOwn('profiles', { city: co.city ?? null, latitude: co.latitude, longitude: co.longitude });
            }}
          />
        </Row>
        <T size={13} sub>
          طريقة الحساب
        </T>
        <Chips
          value={profile?.prayer_method ?? 'umm_al_qura'}
          onChange={(v: string) => upsertOwn('profiles', { prayer_method: v })}
          options={[
            { label: 'أم القرى', value: 'umm_al_qura' },
            { label: 'المصرية', value: 'egyptian' },
            { label: 'رابطة العالم الإسلامي', value: 'mwl' },
            { label: 'دبي', value: 'dubai' },
            { label: 'كراتشي', value: 'karachi' },
          ]}
        />
      </Card>

      <SectionTitle>الأهداف اليومية</SectionTitle>
      <Card>
        <Row>
          <View style={{ flex: 1 }}>
            <Field label="سعرات" keyboardType="number-pad" value={goals.cal} onChangeText={(cal) => setGoals({ ...goals, cal })} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="بروتين (جم)" keyboardType="number-pad" value={goals.pro} onChangeText={(pro) => setGoals({ ...goals, pro })} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="ورد (صفحات)" keyboardType="decimal-pad" value={goals.quran} onChangeText={(quran) => setGoals({ ...goals, quran })} />
          </View>
        </Row>
        <Btn small title="حفظ الأهداف" onPress={() => upsertOwn('profiles', { calorie_goal: Number(goals.cal) || null, protein_goal: Number(goals.pro) || null, quran_daily_pages: Number(goals.quran) || null })} />
        <T size={12} sub>
          العملة: ريال سعودي · اللغة: عربي
        </T>
      </Card>

      <SectionTitle>أوزان سكور اليوم</SectionTitle>
      <Card>
        {(['tasks', 'habits', 'prayers', 'study', 'routine'] as const).map((k) => (
          <Row key={k}>
            <T style={{ flex: 1 }}>{sectionLabels[k]}</T>
            <Chips value={Number(weights[k] ?? 1)} onChange={(v: number) => upsertOwn('profiles', { score_weights: { ...weights, [k]: v } })} options={[0, 1, 2, 3].map((v) => ({ label: String(v), value: v }))} />
          </Row>
        ))}
        <T size={11} faint>
          0 = القسم مش داخل في السكور
        </T>
      </Card>

      <SectionTitle>الخصوصية</SectionTitle>
      <Card>
        <Row>
          <T style={{ flex: 1 }}>قفل اليوميات ببصمة الوجه أو الإصبع</T>
          <Switch
            value={lock}
            disabled={Platform.OS === 'web'}
            onValueChange={(v) => {
              setLock(v);
              AsyncStorage.setItem(JOURNAL_LOCK_KEY, v ? '1' : '0').catch(() => {});
            }}
          />
        </Row>
      </Card>

      <SectionTitle>الإشعارات</SectionTitle>
      <Card>
        <T w="semibold">ساعات الهدوء والحد اليومي</T>
        <Row>
          <View style={{ flex: 1 }}>
            <Field label="من" value={quiet.from} onChangeText={(from) => setQuiet({ ...quiet, from })} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="إلى" value={quiet.to} onChangeText={(to) => setQuiet({ ...quiet, to })} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="أقصى عدد/يوم" keyboardType="number-pad" value={quiet.cap} onChangeText={(cap) => setQuiet({ ...quiet, cap })} />
          </View>
        </Row>
        <Btn
          small
          title="حفظ"
          onPress={() => {
            const ok = (t: string) => /^\d{1,2}:\d{2}$/.test(t);
            if (!ok(quiet.from) || !ok(quiet.to)) return;
            setNotif('global', { quiet_from: quiet.from, quiet_to: quiet.to, daily_cap: Math.max(1, Number(quiet.cap) || 12) });
            rescheduleAll().catch(() => {});
          }}
        />
        <T size={11} faint>
          الإشعارات بتتكتم تلقائياً وقت الصلاة.
        </T>
      </Card>
      {groups.map((grp) => (
        <Card key={grp} style={{ gap: 6 }}>
          <T w="semibold">{grp}</T>
          {NOTIF_META.filter((m) => m.group === grp).map((m) => {
            const s = settingFor(m.type);
            return (
              <View key={m.type} style={{ gap: 4, paddingVertical: 4 }}>
                <Row>
                  <View style={{ flex: 1 }}>
                    <T>{m.label}</T>
                    {m.hint ? (
                      <T size={11} sub>
                        {m.hint}
                      </T>
                    ) : null}
                  </View>
                  {m.time && <TimeInput value={s.time ?? m.time} onSave={(time) => setNotif(m.type, { time })} />}
                  <Switch value={s.enabled} onValueChange={(enabled) => setNotif(m.type, { enabled })} trackColor={{ true: c.primary }} />
                </Row>
              </View>
            );
          })}
        </Card>
      ))}
    </Screen>
  );
}

function TimeInput({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <View style={{ width: 76 }}>
      <Field value={v} onChangeText={setV} onBlur={() => /^\d{1,2}:\d{2}$/.test(v) && v !== value && onSave(v)} style={{ paddingVertical: 6, textAlign: 'center' }} />
    </View>
  );
}
