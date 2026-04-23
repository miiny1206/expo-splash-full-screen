import ExpoModulesCore
import UIKit

public class SplashScreenAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil,
  ) -> Bool {
    SplashScreenOverlay.shared.showOnAppLaunch()
    return true
  }
}
