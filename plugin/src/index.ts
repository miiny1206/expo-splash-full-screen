import type { ConfigPlugin } from '@expo/config-plugins';

import { withAndroid } from './android';
import { withIos } from './ios';
import type { SplashScreenPluginProps } from './types';
import { normalize } from './utils';

const withSplashScreen: ConfigPlugin<SplashScreenPluginProps> = (config, rawProps) => {
  const props = normalize(rawProps);
  config = withAndroid(config, props);
  config = withIos(config, props);
  return config;
};

export default withSplashScreen;
export type { SplashScreenPluginProps, IconSplashProps, ResizeMode } from './types';
