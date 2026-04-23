import { requireNativeModule } from 'expo-modules-core';

import type { SplashScreenNativeModule } from './SplashScreen.types';

export default requireNativeModule<SplashScreenNativeModule>('SplashScreenModule');
