import ExpoModulesCore

public class SplashScreenModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SplashScreenModule")

    Events("didShow", "didHide", "didFail")

    OnCreate {
      // Bridge module's sendEvent into the overlay singleton, weak so a JS reload that destroys
      // this module doesn't keep it alive via the closure stored on the singleton.
      SplashScreenOverlay.shared.setEventEmitter { [weak self] name, body in
        self?.sendEvent(name, body)
      }
    }

    OnDestroy {
      SplashScreenOverlay.shared.setEventEmitter(nil)
    }

    AsyncFunction("showFullScreen") {
      SplashScreenOverlay.shared.showFullScreen()
    }

    AsyncFunction("hide") { (options: [String: Any]) in
      let fade = (options["fade"] as? Bool) ?? true
      let duration = (options["duration"] as? Double) ?? 300
      // Plugin layer guarantees ms; convert to seconds for UIView.animate.
      SplashScreenOverlay.shared.hide(fade: fade, duration: duration / 1000)
    }
  }
}
