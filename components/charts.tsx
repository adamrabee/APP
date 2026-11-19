import { View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { T } from '@/components/ui';
import { font, useTheme } from '@/lib/theme';

/** Minimal line chart. Points are drawn left→right in the order given. */
export function LineChart({
  values,
  labels,
  height = 140,
  max,
  highlight,
  color,
  dark,
}: {
  values: number[];
  labels?: string[];
  height?: number;
  max?: number;
  highlight?: number;
  color?: string;
  dark?: boolean;
}) {
  const { c } = useTheme();
  const W = 320;
  const H = height;
  const pad = 18;
  if (!values.length) return <T sub>لسه مفيش بيانات</T>;
  const hi = max ?? Math.max(...values, 1);
  const lo = Math.min(0, ...values);
  const x = (i: number) => (values.length === 1 ? W / 2 : pad + (i * (W - pad * 2)) / (values.length - 1));
  const y = (v: number) => H - 24 - ((v - lo) / (hi - lo || 1)) * (H - 40);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
  const stroke = color ?? (dark ? '#F2F2EF' : c.ink);
  const sub = dark ? '#9BA19C' : c.sub;
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <Line x1={pad} x2={W - pad} y1={H - 24} y2={H - 24} stroke={dark ? '#2A2E2B' : c.line} />
      <Path d={d} stroke={stroke} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => (
        <Circle key={i} cx={x(i)} cy={y(v)} r={i === highlight ? 6 : 3.5} fill={i === highlight ? (dark ? '#8DB39A' : c.primary) : stroke} />
      ))}
      {labels?.map((l, i) => (
        <SvgText key={i} x={x(i)} y={H - 6} fontSize={10} fill={sub} textAnchor="middle" fontFamily={font.regular}>
          {l}
        </SvgText>
      ))}
    </Svg>
  );
}

/** Horizontal bars, e.g. hours per subject. */
export function Bars({ items, unit = '' }: { items: { label: string; value: number; color?: string; goal?: number }[]; unit?: string }) {
  const { c } = useTheme();
  const max = Math.max(1, ...items.map((i) => Math.max(i.value, i.goal ?? 0)));
  return (
    <View style={{ gap: 10 }}>
      {items.map((i) => (
        <View key={i.label} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T size={13}>{i.label}</T>
            <T size={12} sub>
              {Math.round(i.value * 10) / 10}
              {i.goal ? ` / ${i.goal}` : ''} {unit}
            </T>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: c.line, overflow: 'hidden' }}>
            <View style={{ width: `${(i.value / max) * 100}%`, height: 8, backgroundColor: i.color ?? c.primary }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** GitHub-style heatmap: 7 rows × N weeks. `values` maps YYYY-MM-DD → number. */
export function Heatmap({ dates, values }: { dates: string[]; values: Map<string, number> }) {
  const { c } = useTheme();
  const max = Math.max(1, ...Array.from(values.values()));
  const size = 14;
  const gap = 3;
  const weeks = Math.ceil(dates.length / 7);
  return (
    <Svg width={weeks * (size + gap)} height={7 * (size + gap)}>
      {dates.map((d, i) => {
        const v = values.get(d) ?? 0;
        const col = Math.floor(i / 7);
        const row = i % 7;
        const op = v ? 0.25 + 0.75 * (v / max) : 1;
        return <Rect key={d} x={col * (size + gap)} y={row * (size + gap)} width={size} height={size} rx={3} fill={v ? c.ink : c.line} opacity={op} />;
      })}
    </Svg>
  );
}
