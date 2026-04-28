import type { EventSubscription } from 'expo-modules-core';

export interface HideOptions {
  /** Fade out the overlay when hiding. Default `true`. */
  fade?: boolean;
  /** Fade-out duration in milliseconds. Default `300`. */
  duration?: number;
}

/** Payload emitted with the `didFail` event. `reason` is a short human-readable message. */
export interface SplashFailEvent {
  reason: string;
}

/** Map of event name → listener signature for the splash overlay lifecycle. */
export type SplashEventsMap = {
  /** Fired once the overlay is first visible on screen. */
  didShow: () => void;
  /** Fired after the overlay has been torn down (post fade-out). */
  didHide: () => void;
  /** Fired if the overlay failed to mount. The splash will not show. */
  didFail: (event: SplashFailEvent) => void;
};

export type SplashEventName = keyof SplashEventsMap;

export type { EventSubscription };

export interface SplashScreenNativeModule {
  hide(options: HideOptions): Promise<void>;
  showFullScreen(): Promise<void>;
  addListener<E extends keyof SplashEventsMap>(
    eventName: E,
    listener: SplashEventsMap[E],
  ): EventSubscription;
}
