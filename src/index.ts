import SplashScreenModule from './SplashScreenModule';
import type { EventSubscription, HideOptions, SplashEventsMap } from './SplashScreen.types';

const SplashScreen = {
  /** Hide the splash overlay. Default fades out over 300ms. */
  hide(options: HideOptions = {}): Promise<void> {
    return SplashScreenModule.hide(options);
  },

  /** Manually trigger the cross-fade to the full-screen image. Normally automatic. */
  showFullScreen(): Promise<void> {
    return SplashScreenModule.showFullScreen();
  },

  /**
   * Subscribe to overlay lifecycle events. Returns a subscription with `.remove()`.
   *
   * Events fire on the JS thread:
   * - `didShow` — overlay first painted on screen.
   * - `didHide` — overlay torn down (post fade-out).
   * - `didFail` — overlay failed to mount; splash will not show.
   */
  addListener<E extends keyof SplashEventsMap>(
    eventName: E,
    listener: SplashEventsMap[E],
  ): EventSubscription {
    return SplashScreenModule.addListener(eventName, listener);
  },
};

export default SplashScreen;
export type {
  EventSubscription,
  HideOptions,
  SplashEventName,
  SplashEventsMap,
  SplashFailEvent,
} from './SplashScreen.types';
