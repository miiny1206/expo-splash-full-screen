export interface HideOptions {
  /** Fade out the overlay when hiding. Default `true`. */
  fade?: boolean;
  /** Fade-out duration in milliseconds. Default `300`. */
  duration?: number;
}

export interface SplashScreenNativeModule {
  hide(options: HideOptions): Promise<void>;
  showFullScreen(): Promise<void>;
}
