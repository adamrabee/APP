import { Image } from 'react-native';

export type Mood = 'happy' | 'stars' | 'sad' | 'sleep' | 'coffee' | 'calm';

/** MEE — the app's character. Always the 3D MEE from the design (`mood` kept for call sites). */
export function Mee({ size = 80 }: { mood?: Mood; size?: number }) {
  return <Image source={require('@/assets/design/mee-wave.png')} style={{ width: size, height: size }} resizeMode="contain" />;
}

/** App logo from the design (white m + dot in a black rounded square). */
export function Logo({ size = 44 }: { size?: number }) {
  return <Image source={require('@/assets/design/logo.png')} style={{ width: size, height: size }} />;
}

/** Design illustrations. */
export const art = {
  mee: require('@/assets/design/mee-wave.png'),
  worship: require('@/assets/design/worship.png'),
  skillTree: require('@/assets/design/skill-tree.png'),
  work: require('@/assets/design/work.png'),
  skincare: require('@/assets/design/skincare.png'),
};

/** The 3D MEE from the design (waving / happy). */
export function MeeArt({ size = 56 }: { size?: number }) {
  return <Image source={art.mee} style={{ width: size, height: size }} resizeMode="contain" />;
}

/** Skincare section logo: cream jar with two stars and a dot, black, no frame. */
export function JarLogo({ size = 34 }: { size?: number; color?: string }) {
  return <Image source={art.skincare} style={{ width: size, height: size * 0.85 }} resizeMode="contain" />;
}
