package expo.modules.splashfullscreen

import android.app.Activity
import android.os.Bundle
import expo.modules.core.interfaces.ReactActivityLifecycleListener

class SplashScreenActivityLifecycleListener : ReactActivityLifecycleListener {
  override fun onCreate(activity: Activity, savedInstanceState: Bundle?) {
    SplashScreenOverlay.showOnActivityCreate(activity)
  }

  override fun onDestroy(activity: Activity) {
    SplashScreenOverlay.onActivityDestroyed(activity)
  }
}
