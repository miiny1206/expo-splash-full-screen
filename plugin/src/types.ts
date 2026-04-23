export type ResizeMode = 'cover' | 'contain';

export interface IconSplashProps {
  image: string;
  imageWidth?: number;
  android?: boolean;
  ios?: boolean;
}

export interface SplashScreenPluginProps {
  image: string;
  backgroundColor?: string;
  resizeMode?: ResizeMode;
  fadeIn?: number;
  fadeOut?: number;
  iconDisplayMs?: number;
  crossfadeMs?: number;
  fullscreenHoldMs?: number;
  baseWidth?: number;
  baseHeight?: number;
  iconSplash?: IconSplashProps;
}

export interface NormalizedProps {
  image: string;
  backgroundColor: string;
  resizeMode: ResizeMode;
  fadeIn: number;
  fadeOut: number;
  iconDisplayMs: number;
  crossfadeMs: number;
  fullscreenHoldMs: number;
  baseWidth: number;
  baseHeight: number;
  iconSplash: Required<IconSplashProps> | null;
}
