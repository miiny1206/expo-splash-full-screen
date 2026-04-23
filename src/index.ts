import SplashScreenModule from './SplashScreenModule';
import type { HideOptions } from './SplashScreen.types';

const SplashScreen = {
  /** Hide the splash overlay. Default fades out over 300ms. */
  hide(options: HideOptions = {}): Promise<void> {
    return SplashScreenModule.hide(options);
  },

  /** Manually trigger the cross-fade to the full-screen image. Normally automatic. */
  showFullScreen(): Promise<void> {
    return SplashScreenModule.showFullScreen();
  },
};

export default SplashScreen;
export type { HideOptions } from './SplashScreen.types';
