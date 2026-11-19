import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Btn, Card, Chips, confirm, Field, ListRow, Row, Screen, Section, T, Toggle } from '@/components/ui';
import { signOut, useAuth } from '@/lib/auth';
import { JOURNAL_LOCK_KEY, sectionLabels } from '@/lib/content';
import { insert, rows, update, upsertOwn, useOwn, useRows, useSync } from '@/lib/db';
import { globalSettings, NOTIF_META, rescheduleAll, settingFor } from '@/lib/notify';
import { refreshLocation } from '@/lib/prayer';
import { palettes, useTheme, type Mode } from '@/lib/theme';

const groupColor = (c: any, g: string) => (g === 'المذاكرة' ? c.acc.study.fg : g === 'العبادات' ? c.acc.worship.fg : g === 'me' ? c.acc.me.fg : c.text);
const t12 = (hm?: string) => {
  if (!hm) return '';
  const [h, m] = hm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'ص' : 'م'}`;
};

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
  const [editing, setEditing] = useState<string | null>(null);
  const [timeInput, setTimeInput] = useState('');
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
    <Screen back="me" title="الإعدادات">
      <Section title="المظهر" titleSize={14}>
        <View style={{ backgroundColor: c.card, borderRadius: 20, padding: 8, flexDirection: 'row', gap: 8 }}>
          {(['light', 'dark'] as Mode[]).map((m) => {
            const p = palettes[m];
            const on = mode === m;
            return (
              <Pressable key={m} onPress={() => (setMode(m), upsertOwn('profiles', { theme: m }))} style={{ flex: 1, borderWidth: 2, borderColor: on ? c.text : 'transparent', borderRadius: 16, paddingTop: 8, paddingBottom: 10, paddingHorizontal: 6, gap: 8, alignItems: 'center' }}>
                <View style={{ width: '100%', height: 64, borderRadius: 12, backgroundColor: p.bg, borderWidth: 1, borderColor: c.line, padding: 8, gap: 5 }}>
                  <View style={{ height: 8, width: '60%', borderRadius: 4, backgroundColor: m === 'light' ? '#D9D9D4' : '#3A3F3B' }} />
                  <View style={{ height: 18, borderRadius: 6, backgroundColor: p.card }} />
                  <View style={{ height: 10, width: '40%', borderRadius: 4, backgroundColor: m === 'light' ? '#E4ECE6' : '#243029' }} />
                </View>
                <T size={13} w="bold">
                  {m === 'light' ? 'فاتح' : 'داكن'}
                </T>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <T size={18} w="bold">
        الإشعارات
      </T>
      {groups.map((grp) => {
        const items = NOTIF_META.filter((m) => m.group === grp);
        return (
          <Section key={grp} title={grp} titleSize={14} titleColor={groupColor(c, grp)}>
            <Card list>
              {items.map((m, i) => {
                const s = settingFor(m.type);
                return (
                  <View key={m.type}>
                    <ListRow minHeight={60} last={i === items.length - 1 && editing !== m.type}>
                      <Pressable style={{ flex: 1 }} onPress={() => m.time && (setEditing(editing === m.type ? null : m.type), setTimeInput(s.time ?? m.time))}>
                        <T w="medium">{m.label}</T>
                        <T size={12} sub>
                          {m.time ? `كل يوم ${t12(s.time)}` : m.hint ?? ''}
                        </T>
                      </Pressable>
                      <Toggle on={s.enabled} onChange={(enabled) => setNotif(m.type, { enabled })} />
                    </ListRow>
                    {editing === m.type && (
                      <Row style={{ paddingBottom: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Field value={timeInput} onChangeText={setTimeInput} placeholder="HH:MM" style={{ textAlign: 'center' }} />
                        </View>
                        <Btn small title="حفظ الوقت" onPress={() => /^\d{1,2}:\d{2}$/.test(timeInput) && (setNotif(m.type, { time: timeInput }), setEditing(null))} />
                      </Row>
                    )}
                  </View>
                );
              })}
            </Card>
          </Section>
        );
      })}

      <Section title="ساعات الهدوء والحد اليومي" titleSize={14}>
        <Card>
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
      </Section>

      <Section title="المدينة والصلاة" titleSize={14}>
        <Card>
          <Row>
            <T style={{ flex: 1 }}>{city || profile?.city || 'حسب موقعك'}</T>
            <Btn
              small
              kind="ghost"
              title="تحديث الموقع"
              onPress={async () => {
                const co = await refreshLocation();
                setCity(co.city ?? '');
                upsertOwn('profiles', { city: co.city ?? null, latitude: co.latitude, longitude: co.longitude });
              }}
            />
          </Row>
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
      </Section>

      <Section title="الأهداف اليومية" titleSize={14}>
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
      </Section>

      <Section title="أوزان سكور اليوم" titleSize={14}>
        <Card list>
          {(['tasks', 'habits', 'prayers', 'study', 'routine'] as const).map((k, i, a) => (
            <ListRow key={k} last={i === a.length - 1}>
              <T style={{ flex: 1 }}>{sectionLabels[k]}</T>
              <Chips value={Number(weights[k] ?? 1)} onChange={(v: number) => upsertOwn('profiles', { score_weights: { ...weights, [k]: v } })} options={[0, 1, 2, 3].map((v) => ({ label: String(v), value: v }))} />
            </ListRow>
          ))}
        </Card>
      </Section>

      <Section title="الخصوصية والحساب" titleSize={14}>
        <Card list>
          <ListRow>
            <T style={{ flex: 1 }}>قفل اليوميات ببصمة الوجه أو الإصبع</T>
            <Toggle
              on={lock}
              onChange={(v) => {
                if (Platform.OS === 'web') return;
                setLock(v);
                AsyncStorage.setItem(JOURNAL_LOCK_KEY, v ? '1' : '0').catch(() => {});
              }}
            />
          </ListRow>
          <ListRow>
            <View style={{ flex: 1 }}>
              <T>{session?.user.email}</T>
              <T size={12} sub>
                {sync.pending ? `${sync.pending} تعديل مستني يتزامن ${sync.online ? '' : '(محفوظ على الجهاز)'}` : 'كل البيانات متزامنة مع السحابة ✓'}
              </T>
            </View>
          </ListRow>
          <ListRow last onPress={() => confirm('تسجّل خروج؟', signOut)}>
            <T color={c.danger} w="medium">
              تسجيل خروج
            </T>
          </ListRow>
        </Card>
      </Section>
    </Screen>
  );
}
