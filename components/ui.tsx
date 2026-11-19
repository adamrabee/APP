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
import { categoryAccent, font, radius, useTheme, type Accent } from '@/lib/theme';
import { Mee, type Mood } from './mee';

export type IconName = keyof typeof Ionicons.glyphMap;

export const tap = () => {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
};

// ───────── Text ─────────
type TProps = {
  children?: ReactNode;
  size?: number;
  w?: 'light' | 'regular' | 'medium' | 'semibold' | 'bold';
  color?: string;
  sub?: boolean;
  faint?: boolean;
  center?: boolean;
  lines?: number;
  style?: StyleProp<TextStyle>;
  onPress?: () => void;
  strike?: boolean;
  lh?: number;
};
export function T({ children, size = 15, w = 'regular', color, sub, faint, center, lines, style, onPress, strike, lh }: TProps) {
  const { c } = useTheme();
  return (
    <Text
      onPress={onPress}
      numberOfLines={lines}
      style={[
        {
          fontFamily: font[w],
          fontSize: size,
          lineHeight: Math.round(size * (lh ?? 1.5)),
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

// ───────── Page ─────────
/**
 * Design pages have no top bar: an optional "‹ parent" back link in the section colour,
 * then a 26px bold title (+ subtitle) inside the scrolling content.
 */
export function Screen({
  title,
  subtitle,
  back,
  backColor,
  right,
  children,
  scroll = true,
  padded = true,
  bg,
  footer,
}: {
  title?: string;
  subtitle?: string;
  back?: string | boolean;
  backColor?: string;
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  bg?: string;
  footer?: ReactNode;
}) {
  const { c } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const head = (back || title || right) && (
    <View style={{ gap: 4, paddingHorizontal: padded || !scroll ? 0 : 20 }}>
      {back ? <BackLink label={typeof back === 'string' ? back : 'رجوع'} color={backColor} /> : null}
      {(title || right) && (
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 2 }}>
            {title ? (
              <T size={26} w="bold" lh={1.3}>
                {title}
              </T>
            ) : null}
            {subtitle ? <T size={13} sub>{subtitle}</T> : null}
          </View>
          {right}
        </Row>
      )}
    </View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg ?? c.bg }} edges={['top']}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: padded ? 20 : 0, paddingTop: back ? 8 : 20, paddingBottom: 130, gap: 20 }}
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
          {head}
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 16, paddingTop: back ? 8 : 16 }}>{head}</View>
          {children}
        </View>
      )}
      {footer}
    </SafeAreaView>
  );
}

export function BackLink({ label, color }: { label: string; color?: string }) {
  const { c } = useTheme();
  const col = color ?? c.primary;
  return (
    <Pressable
      hitSlop={8}
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, alignSelf: 'flex-start', opacity: pressed ? 0.6 : 1 })}
    >
      <Ionicons name="chevron-forward" size={18} color={col} />
      <T size={14} w="medium" color={col}>
        {label}
      </T>
    </Pressable>
  );
}

export function Card({ children, style, onPress, tint, list }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; tint?: string; list?: boolean }) {
  const { c } = useTheme();
  const s = [{ backgroundColor: tint ?? c.card, borderRadius: radius.lg, paddingHorizontal: 16, paddingVertical: list ? 4 : 16, gap: list ? 0 : 10 }, style];
  if (!onPress) return <View style={s}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s, pressed && { opacity: 0.85 }]}>
      {children}
    </Pressable>
  );
}

/** A row inside a list card: min 56px, divider under it. */
export function ListRow({ children, onPress, last, minHeight = 56, style }: { children: ReactNode; onPress?: () => void; last?: boolean; minHeight?: number; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const s: StyleProp<ViewStyle> = [{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight, paddingVertical: 8, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.line }, style];
  if (!onPress) return <View style={s}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s, pressed && { opacity: 0.6 }]}>
      {children}
    </Pressable>
  );
}

export const Row = ({ children, style, gap = 10 }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>
);

export const Spacer = () => <View style={{ flex: 1 }} />;

/** h2 18/700 with an optional count on the other side or a link. */
export function SectionTitle({ children, action, onAction, note, size = 18, color }: { children: ReactNode; action?: string; onAction?: () => void; note?: string; size?: number; color?: string }) {
  const { c } = useTheme();
  return (
    <Row style={{ alignItems: 'baseline' }}>
      <T size={size} w={size >= 16 ? 'bold' : 'semibold'} style={{ flex: 1 }} color={color}>
        {children}
      </T>
      {note ? <T size={13} sub>{note}</T> : null}
      {action ? (
        <T size={13} color={c.primary} onPress={onAction} w="medium">
          {action}
        </T>
      ) : null}
    </Row>
  );
}

/** A section: title + content, 10px apart. */
export function Section({ title, note, action, onAction, children, titleSize, titleColor }: { title?: string; note?: string; action?: string; onAction?: () => void; children: ReactNode; titleSize?: number; titleColor?: string }) {
  return (
    <View style={{ gap: 10 }}>
      {title ? (
        <SectionTitle note={note} action={action} onAction={onAction} size={titleSize} color={titleColor}>
          {title}
        </SectionTitle>
      ) : null}
      {children}
    </View>
  );
}

// ───────── Controls ─────────
export function IconBtn({ name, onPress, color, size = 22, bg, box }: { name: IconName; onPress?: () => void; color?: string; size?: number; bg?: string; box?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable
      hitSlop={8}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        box
          ? { width: 44, height: 44, borderRadius: 14, backgroundColor: bg ?? c.card, alignItems: 'center', justifyContent: 'center' }
          : { padding: 6, borderRadius: radius.pill, backgroundColor: bg },
        { opacity: pressed ? 0.6 : 1 },
      ]}
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
  color,
}: {
  title: string;
  onPress?: () => void;
  kind?: 'ink' | 'soft' | 'ghost' | 'danger' | 'primary' | 'link';
  icon?: IconName;
  small?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  color?: string;
}) {
  const { c } = useTheme();
  const bg =
    kind === 'ink' ? color ?? c.ink : kind === 'primary' ? color ?? c.primary : kind === 'soft' ? c.primarySoft : kind === 'ghost' ? c.card : 'transparent';
  const fg = kind === 'ink' || kind === 'primary' ? c.onInk : kind === 'danger' ? c.danger : kind === 'soft' ? c.primaryDark : kind === 'link' ? color ?? c.primary : c.text;
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          backgroundColor: disabled && (kind === 'ink' || kind === 'primary') ? '#9A9A9A' : bg,
          borderRadius: 14,
          minHeight: small ? 38 : 50,
          paddingHorizontal: small ? 14 : 18,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          borderWidth: kind === 'ghost' || kind === 'danger' ? 1 : 0,
          borderColor: kind === 'danger' ? c.danger : c.border,
          opacity: pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {icon && <Ionicons name={icon} size={small ? 16 : 18} color={fg} />}
      <T size={small ? 13 : 15} w="bold" color={fg}>
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
        <T size={12} sub>
          {label}
        </T>
      )}
      <TextInput
        placeholderTextColor={c.faint}
        {...p}
        style={[
          {
            backgroundColor: c.input,
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: p.multiline ? 12 : 11,
            fontFamily: font.regular,
            fontSize: 15,
            color: c.text,
            textAlign: 'right',
            writingDirection: 'rtl',
            minHeight: p.multiline ? 100 : 46,
            textAlignVertical: p.multiline ? 'top' : 'center',
            borderWidth: 1,
            borderColor: c.border,
          },
          style,
        ]}
      />
    </View>
  );
}

/** Filter chips: active = dark pill, inactive = white pill. */
export function Chips<V extends string | number | boolean>({
  options,
  value,
  onChange,
  multi,
  dot,
}: {
  options: { label: string; value: V; dot?: string }[];
  value: V | V[] | null;
  onChange: (v: any) => void;
  multi?: boolean;
  dot?: boolean;
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
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: radius.pill,
              backgroundColor: on ? c.ink : c.card,
              borderWidth: 1,
              borderColor: on ? c.ink : c.card,
            }}
          >
            {o.dot ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: o.dot }} /> : null}
            <T size={13} w={on ? 'semibold' : 'medium'} color={on ? c.onInk : c.text}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Segmented control: grey track, white active pill. */
export function Segmented<V extends string>({ options, value, onChange }: { options: { label: string; value: V }[]; value: V; onChange: (v: V) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.seg, borderRadius: 14, padding: 4 }}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          onPress={() => (tap(), onChange(o.value))}
          style={{ flex: 1, minHeight: 40, borderRadius: 11, backgroundColor: value === o.value ? c.card : 'transparent', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}
        >
          <T size={13} w="semibold" lines={1}>
            {o.label}
          </T>
        </Pressable>
      ))}
    </View>
  );
}

/** Pill tabs (subject page, gym/money switcher). */
export function PillTabs<V extends string>({ options, value, onChange }: { options: { label: string; value: V }[]; value: V; onChange: (v: V) => void }) {
  const { c } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => (tap(), onChange(o.value))} style={{ minHeight: 38, paddingHorizontal: 14, borderRadius: 999, backgroundColor: on ? c.ink : c.card, justifyContent: 'center' }}>
            <T size={13} w="semibold" color={on ? c.onInk : c.text}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Square checkbox like the design's native inputs (22px, green when checked). */
export function Check({ on, onPress, size = 22, color, round }: { on: boolean; onPress?: () => void; size?: number; color?: string; round?: boolean }) {
  const { c } = useTheme();
  const col = color ?? c.primary;
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
        borderRadius: round ? size / 2 : 6,
        borderWidth: on ? 0 : 1.5,
        borderColor: c.faint,
        backgroundColor: on ? col : c.card,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {on && <Ionicons name="checkmark" size={size * 0.72} color="#FFFFFF" />}
    </Pressable>
  );
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={() => (tap(), onChange(!on))} style={{ width: 50, height: 30, borderRadius: 999, padding: 3, backgroundColor: on ? c.primary : c.track, alignItems: on ? 'flex-start' : 'flex-end' }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 }} />
    </Pressable>
  );
}

export function Bar({ value, color, height = 8 }: { value: number; color?: string; height?: number }) {
  const { c } = useTheme();
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <View style={{ height, borderRadius: 999, backgroundColor: c.line, overflow: 'hidden' }}>
      <View style={{ width: `${v * 100}%`, height, backgroundColor: color ?? c.primary, borderRadius: 999 }} />
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
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track ?? c.line} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color ?? c.primary} strokeWidth={stroke} fill="none" strokeDasharray={`${len} ${len}`} strokeDashoffset={len * (1 - v)} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      {children}
    </View>
  );
}

/** Coloured tag (11/600, 3×10 padding). Pass an accent or a task category. */
export function Tag({ text, accent, category }: { text: string; accent?: Accent; category?: string }) {
  const { c } = useTheme();
  const a = c.acc[accent ?? categoryAccent[category ?? ''] ?? 'neutral'];
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: a.bg }}>
      <T size={11} w="semibold" color={a.fg}>
        {text}
      </T>
    </View>
  );
}

/** Kept for older call sites: a soft pill. */
export function Pill({ text, color, bg }: { text: string; color?: string; bg?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: bg ?? c.primarySoft }}>
      <T size={11} w="semibold" color={color ?? c.primaryDark}>
        {text}
      </T>
    </View>
  );
}

/** Summary card: small label, 24px value, optional unit. */
export function Stat({ label, value, unit, sub, onPress, children }: { label: string; value: string | number; unit?: string; sub?: string; onPress?: () => void; children?: ReactNode }) {
  return (
    <Card onPress={onPress} style={{ flex: 1, gap: 4, paddingVertical: 14 }}>
      <T size={12} sub w="medium">
        {label}
      </T>
      <T size={22} w="bold">
        {value}
        {unit ? <T size={12} sub w="medium">{` ${unit}`}</T> : null}
      </T>
      {sub ? <T size={11} sub>{sub}</T> : null}
      {children}
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
        <View style={{ backgroundColor: c.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 34, gap: 14, maxHeight: '90%' }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.track }} />
          {title && (
            <Row>
              <T size={18} w="bold" style={{ flex: 1 }}>
                {title}
              </T>
              <IconBtn name="close" onPress={onClose} box />
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

export function ListItem({ title, subtitle, icon, onPress, right, last }: { title: string; subtitle?: string; icon?: IconName; onPress?: () => void; right?: ReactNode; last?: boolean }) {
  const { c } = useTheme();
  return (
    <ListRow onPress={onPress} last={last}>
      {icon && (
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={20} color={c.text} />
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
    </ListRow>
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

/** Empty state: optional illustration, bold title, soft text. */
export function Empty({ text, title, mood = 'sleep', image, dashed }: { text: string; title?: string; mood?: Mood; image?: number; dashed?: boolean }) {
  const { c } = useTheme();
  const { Image } = require('react-native');
  return (
    <View style={[{ alignItems: 'center', paddingVertical: 18, paddingHorizontal: 12, gap: 8 }, dashed && { borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.track, borderRadius: 20 }]}>
      {image ? <Image source={image} style={{ width: 150, height: 120 }} resizeMode="contain" /> : <Mee mood={mood} size={60} />}
      {title ? (
        <T size={16} w="bold" center>
          {title}
        </T>
      ) : null}
      <T sub center size={13} lh={1.7}>
        {text}
      </T>
    </View>
  );
}
