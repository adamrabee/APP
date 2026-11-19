import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { refreshAll } from '@/lib/db';
import { font, radius, useTheme } from '@/lib/theme';
import { Mee, type Mood } from './mee';

export type IconName = keyof typeof Ionicons.glyphMap;

export const tap = () => {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
};

// ───────── Text ─────────
type TProps = {
  children?: ReactNode;
  size?: number;
  w?: 'regular' | 'medium' | 'semibold' | 'bold';
  color?: string;
  sub?: boolean;
  faint?: boolean;
  center?: boolean;
  lines?: number;
  style?: StyleProp<TextStyle>;
  onPress?: () => void;
  strike?: boolean;
};
export function T({ children, size = 15, w = 'regular', color, sub, faint, center, lines, style, onPress, strike }: TProps) {
  const { c } = useTheme();
  return (
    <Text
      onPress={onPress}
      numberOfLines={lines}
      style={[
        {
          fontFamily: font[w],
          fontSize: size,
          lineHeight: Math.round(size * 1.55),
          color: color ?? (faint ? c.faint : sub ? c.sub : c.text),
          textAlign: center ? 'center' : undefined,
          writingDirection: 'rtl',
          textDecorationLine: strike ? 'line-through' : 'none',
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// ───────── Layout ─────────
export function Screen({
  title,
  back,
  right,
  children,
  scroll = true,
  padded = true,
  dark,
}: {
  title?: string;
  back?: boolean;
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  dark?: boolean;
}) {
  const { c } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const bg = dark ? '#0E100F' : c.bg;
  const body = (
    <View style={{ paddingHorizontal: padded ? 18 : 0, paddingBottom: 120, gap: 14 }}>{children}</View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={['top']}>
      {(title || back) && (
        <View style={styles.header}>
          {back ? (
            <IconBtn name="chevron-forward" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} color={dark ? '#F2F2EF' : undefined} />
          ) : (
            <View style={{ width: 8 }} />
          )}
          <T size={20} w="bold" style={{ flex: 1 }} color={dark ? '#F2F2EF' : undefined} lines={1}>
            {title}
          </T>
          {right}
        </View>
      )}
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: title || back ? 4 : 12 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await refreshAll().catch(() => {});
                setRefreshing(false);
              }}
            />
          }
        >
          {body}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: padded ? 18 : 0 }}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({
  children,
  style,
  onPress,
  tint,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  tint?: string;
}) {
  const { c } = useTheme();
  const s = [{ backgroundColor: tint ?? c.card, borderRadius: radius.lg, padding: 16, gap: 10 }, style];
  if (!onPress) return <View style={s}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s, pressed && { opacity: 0.8 }]}>
      {children}
    </Pressable>
  );
}

export const Row = ({ children, style, gap = 10 }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>
);

export const Spacer = () => <View style={{ flex: 1 }} />;

export function SectionTitle({ children, action, onAction }: { children: ReactNode; action?: string; onAction?: () => void }) {
  const { c } = useTheme();
  return (
    <Row style={{ marginTop: 6 }}>
      <T size={16} w="semibold" style={{ flex: 1 }}>
        {children}
      </T>
      {action && (
        <T size={13} color={c.primary} onPress={onAction} w="medium">
          {action}
        </T>
      )}
    </Row>
  );
}

// ───────── Controls ─────────
export function IconBtn({ name, onPress, color, size = 22, bg }: { name: IconName; onPress?: () => void; color?: string; size?: number; bg?: string }) {
  const { c } = useTheme();
  return (
    <Pressable
      hitSlop={8}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => [{ padding: 6, borderRadius: radius.pill, backgroundColor: bg, opacity: pressed ? 0.6 : 1 }]}
    >
      <Ionicons name={name} size={size} color={color ?? c.text} />
    </Pressable>
  );
}

export function Btn({
  title,
  onPress,
  kind = 'ink',
  icon,
  small,
  disabled,
  style,
}: {
  title: string;
  onPress?: () => void;
  kind?: 'ink' | 'soft' | 'ghost' | 'danger';
  icon?: IconName;
  small?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const bg = kind === 'ink' ? c.ink : kind === 'soft' ? c.primarySoft : 'transparent';
  const fg = kind === 'ink' ? c.onInk : kind === 'danger' ? c.danger : kind === 'soft' ? c.primary : c.text;
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: radius.pill,
          paddingVertical: small ? 7 : 12,
          paddingHorizontal: small ? 14 : 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          borderWidth: kind === 'ghost' || kind === 'danger' ? 1 : 0,
          borderColor: kind === 'danger' ? c.danger : c.line,
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      {icon && <Ionicons name={icon} size={small ? 15 : 18} color={fg} />}
      <T size={small ? 13 : 15} w="semibold" color={fg}>
        {title}
      </T>
    </Pressable>
  );
}

export function Field({ label, style, ...p }: TextInputProps & { label?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label && (
        <T size={13} sub>
          {label}
        </T>
      )}
      <TextInput
        placeholderTextColor={c.faint}
        {...p}
        style={[
          {
            backgroundColor: c.bg,
            borderRadius: radius.md,
            paddingHorizontal: 14,
            paddingVertical: p.multiline ? 12 : 10,
            fontFamily: font.regular,
            fontSize: 15,
            color: c.text,
            textAlign: 'right',
            writingDirection: 'rtl',
            minHeight: p.multiline ? 90 : undefined,
            textAlignVertical: p.multiline ? 'top' : 'center',
            borderWidth: 1,
            borderColor: c.line,
          },
          style,
        ]}
      />
    </View>
  );
}

export function Chips<V extends string | number>({
  options,
  value,
  onChange,
  multi,
}: {
  options: { label: string; value: V }[];
  value: V | V[] | null;
  onChange: (v: any) => void;
  multi?: boolean;
}) {
  const { c } = useTheme();
  const isOn = (v: V) => (Array.isArray(value) ? value.includes(v) : value === v);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => {
        const on = isOn(o.value);
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => {
              tap();
              if (multi) {
                const arr = (Array.isArray(value) ? value : []) as V[];
                onChange(on ? arr.filter((x) => x !== o.value) : [...arr, o.value]);
              } else onChange(o.value);
            }}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: radius.pill,
              backgroundColor: on ? c.ink : c.bg,
              borderWidth: 1,
              borderColor: on ? c.ink : c.line,
            }}
          >
            <T size={13} w="medium" color={on ? c.onInk : c.text}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Segmented<V extends string>({ options, value, onChange }: { options: { label: string; value: V }[]; value: V; onChange: (v: V) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.card, borderRadius: radius.pill, padding: 4 }}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          onPress={() => (tap(), onChange(o.value))}
          style={{ flex: 1, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: value === o.value ? c.ink : 'transparent', alignItems: 'center' }}
        >
          <T size={13} w="semibold" color={value === o.value ? c.onInk : c.sub}>
            {o.label}
          </T>
        </Pressable>
      ))}
    </View>
  );
}

export function Check({ on, onPress, size = 24, color }: { on: boolean; onPress?: () => void; size?: number; color?: string }) {
  const { c } = useTheme();
  const col = color ?? c.ink;
  return (
    <Pressable
      hitSlop={10}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.6,
        borderColor: on ? col : c.faint,
        backgroundColor: on ? col : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {on && <Ionicons name="checkmark" size={size * 0.65} color={c.onInk} />}
    </Pressable>
  );
}

export function Bar({ value, color, height = 6 }: { value: number; color?: string; height?: number }) {
  const { c } = useTheme();
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: c.line, overflow: 'hidden' }}>
      <View style={{ width: `${v * 100}%`, height, backgroundColor: color ?? c.primary, borderRadius: height }} />
    </View>
  );
}

export function Ring({ value, size = 44, stroke = 4, color, track, children }: { value: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode }) {
  const { c } = useTheme();
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track ?? c.line} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color ?? c.primary}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${len} ${len}`}
          strokeDashoffset={len * (1 - v)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

export function Pill({ text, color, bg }: { text: string; color?: string; bg?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: bg ?? c.primarySoft }}>
      <T size={11} w="medium" color={color ?? c.primary}>
        {text}
      </T>
    </View>
  );
}

export function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card style={{ flex: 1, gap: 2, padding: 14 }}>
      <T size={12} sub>
        {label}
      </T>
      <T size={20} w="bold">
        {value}
      </T>
      {sub ? (
        <T size={11} faint>
          {sub}
        </T>
      ) : null}
    </Card>
  );
}

// ───────── Bottom sheet ─────────
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ backgroundColor: c.card, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 34, gap: 14, maxHeight: '88%' }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.line }} />
          {title && (
            <Row>
              <T size={18} w="bold" style={{ flex: 1 }}>
                {title}
              </T>
              <IconBtn name="close" onPress={onClose} />
            </Row>
          )}
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14 }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function ListItem({
  title,
  subtitle,
  icon,
  onPress,
  right,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  onPress?: () => void;
  right?: ReactNode;
}) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, opacity: pressed ? 0.6 : 1 }]}>
      {icon && (
        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={19} color={c.text} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <T w="medium">{title}</T>
        {subtitle ? (
          <T size={12} sub>
            {subtitle}
          </T>
        ) : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-back" size={18} color={c.faint} /> : null)}
    </Pressable>
  );
}

export const Divider = () => {
  const { c } = useTheme();
  return <View style={{ height: 1, backgroundColor: c.line }} />;
};

/** Confirm dialog that works on native and web. */
export function confirm(message: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (globalThis.confirm?.(message)) onYes();
    return;
  }
  const { Alert } = require('react-native');
  Alert.alert('تأكيد', message, [
    { text: 'إلغاء', style: 'cancel' },
    { text: 'نعم', style: 'destructive', onPress: onYes },
  ]);
}

export function Empty({ text, mood = 'sleep' }: { text: string; mood?: Mood }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 18, gap: 8 }}>
      <Mee mood={mood} size={64} />
      <T sub center size={13}>
        {text}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 8 },
});
