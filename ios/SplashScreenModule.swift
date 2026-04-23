import ExpoModulesCore

public class SplashScreenModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SplashScreenModule")

    AsyncFunction("showFullScreen") {
      SplashScreenOverlay.shared.showFullScreen()
    }

    AsyncFunction("hide") { (options: [String: Any]) in
      let fade = (options["fade"] as? Bool) ?? true
      let duration = (options["duration"] as? Double) ?? 300
      let durationSec = duration > 10 ? duration / 1000 : duration
      SplashScreenOverlay.shared.hide(fade: fade, duration: durationSec)
    }
  }
}
