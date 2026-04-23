package expo.modules.splashfullscreen

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SplashScreenModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SplashScreenModule")

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
