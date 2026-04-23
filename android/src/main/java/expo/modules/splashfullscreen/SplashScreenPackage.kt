package expo.modules.splashfullscreen

import android.content.Context
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener

class SplashScreenPackage : Package {
  override fun createReactActivityLifecycleListeners(
    activityContext: Context,
  ): List<ReactActivityLifecycleListener> {
    return listOf(SplashScreenActivityLifecycleListener())
  }
}
