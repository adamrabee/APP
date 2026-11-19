import { View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/lib/theme';

export type Mood = 'happy' | 'stars' | 'sad' | 'sleep' | 'coffee' | 'calm';

/** MEE — the app's soft white character (BRD §4.10). Drawn in SVG, no assets. */
export function Mee({ mood = 'calm', size = 80 }: { mood?: Mood; size?: number }) {
  const { mode } = useTheme();
  const stroke = '#1B1E1C';
  const body = '#FFFFFF';
  const shade = mode === 'dark' ? '#3A3F3B' : '#E6E8E1';
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Ellipse cx="50" cy="92" rx="26" ry="4" fill={shade} />
      {/* body: soft blob */}
      <Path
        d="M50 12 C74 12 86 32 86 56 C86 78 72 88 50 88 C28 88 14 78 14 56 C14 32 26 12 50 12 Z"
        fill={body}
        stroke={stroke}
        strokeWidth="2.2"
      />
      {/* cheeks */}
      {(mood === 'happy' || mood === 'stars') && (
        <G>
          <Ellipse cx="31" cy="60" rx="5" ry="3" fill="#F2C9C2" />
          <Ellipse cx="69" cy="60" rx="5" ry="3" fill="#F2C9C2" />
        </G>
      )}
      {/* eyes */}
      {mood === 'stars' ? (
        <G fill={stroke}>
          <Path d="M38 40 l2.4 5 5.4.6-4 3.6 1.1 5.3-4.9-2.7-4.9 2.7 1.1-5.3-4-3.6 5.4-.6z" />
          <Path d="M62 40 l2.4 5 5.4.6-4 3.6 1.1 5.3-4.9-2.7-4.9 2.7 1.1-5.3-4-3.6 5.4-.6z" />
        </G>
      ) : mood === 'sleep' ? (
        <G stroke={stroke} strokeWidth="2.4" strokeLinecap="round" fill="none">
          <Path d="M32 50 q6 4 12 0" />
          <Path d="M56 50 q6 4 12 0" />
          <SvgText x="72" y="26" fontSize="12" fill={stroke} stroke="none" fontWeight="bold">
            z
          </SvgText>
          <SvgText x="80" y="18" fontSize="9" fill={stroke} stroke="none" fontWeight="bold">
            z
          </SvgText>
        </G>
      ) : mood === 'happy' ? (
        <G stroke={stroke} strokeWidth="2.6" strokeLinecap="round" fill="none">
          <Path d="M32 50 q6 -7 12 0" />
          <Path d="M56 50 q6 -7 12 0" />
        </G>
      ) : (
        <G fill={stroke}>
          <Circle cx="38" cy="48" r="3.6" />
          <Circle cx="62" cy="48" r="3.6" />
          {mood === 'sad' && (
            <G stroke={stroke} strokeWidth="2" strokeLinecap="round">
              <Path d="M32 40 l9 -3" />
              <Path d="M68 40 l-9 -3" />
            </G>
          )}
        </G>
      )}
      {/* mouth */}
      {mood === 'sad' ? (
        <Path d="M42 68 q8 -6 16 0" stroke={stroke} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      ) : mood === 'sleep' ? (
        <Ellipse cx="50" cy="66" rx="3" ry="2.4" fill={stroke} />
      ) : mood === 'calm' ? (
        <Path d="M44 64 q6 4 12 0" stroke={stroke} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      ) : (
        <Path d="M41 62 q9 10 18 0 z" fill={stroke} />
      )}
      {/* coffee cup */}
      {mood === 'coffee' && (
        <G>
          <Rect x="60" y="66" width="18" height="16" rx="3" fill="#FFFFFF" stroke={stroke} strokeWidth="2" />
          <Path d="M78 70 q6 0 6 5 t-6 5" stroke={stroke} strokeWidth="2" fill="none" />
          <Path d="M65 60 q-2 -3 0 -6 M71 60 q-2 -3 0 -6" stroke={stroke} strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </G>
      )}
    </Svg>
  );
}

/** App logo: white "m" with a dot inside a black rounded square (BRD §5). */
export function Logo({ size = 34 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Rect x="0" y="0" width="100" height="100" rx="24" fill="#111111" />
        <Path
          d="M24 70 V40 q0 -8 8 -8 q8 0 8 8 V70 M40 40 q0 -8 8 -8 q8 0 8 8 V70"
          stroke="#FFFFFF"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx="72" cy="66" r="6" fill="#FFFFFF" />
      </Svg>
    </View>
  );
}

/** Skincare section logo: cream jar with two stars and a dot, black, no frame. */
export function JarLogo({ size = 34, color = '#111111' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Rect x="22" y="46" width="56" height="38" rx="10" fill={color} />
      <Rect x="18" y="34" width="64" height="14" rx="6" fill={color} />
      <Path d="M66 10 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill={color} />
      <Path d="M84 24 l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2z" fill={color} />
      <Circle cx="48" cy="20" r="3.5" fill={color} />
    </Svg>
  );
}
