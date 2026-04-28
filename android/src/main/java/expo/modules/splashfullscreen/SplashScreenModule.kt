package expo.modules.splashfullscreen

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.lang.ref.WeakReference

class SplashScreenModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SplashScreenModule")

    Events("didShow", "didHide", "didFail")

    OnCreate {
      // Hold the module weakly so an RN reload that destroys this module doesn't leak via the
      // closure stored on the overlay singleton (which is app-scoped).
      val weakSelf = WeakReference(this@SplashScreenModule)
      SplashScreenOverlay.setEventEmitter { name, body ->
        weakSelf.get()?.sendEvent(name, body)
      }
    }

    OnDestroy {
      SplashScreenOverlay.setEventEmitter(null)
    }

    AsyncFunction("showFullScreen") {
      SplashScreenOverlay.showFullScreen()
    }

    AsyncFunction("hide") { options: Map<String, Any?> ->
      val fade = options["fade"] as? Boolean ?: true
      val duration = when (val d = options["duration"]) {
        is Number -> d.toLong()
        else -> 300L
      }
      SplashScreenOverlay.hide(fade, duration)
    }
  }
}
