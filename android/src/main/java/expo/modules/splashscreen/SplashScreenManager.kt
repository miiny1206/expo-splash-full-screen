package expo.modules.splashscreen

// Compatibility shim for expo-dev-launcher.
//
// DevLauncherController.initialize() reflectively looks up
// expo.modules.splashscreen.SplashScreenManager (the official expo-splash-screen module's
// singleton) and calls hide() on it before showing the launcher UI. Apps that install
// expo-splash-full-screen instead of expo-splash-screen don't ship that class, so the lookup
// throws ClassNotFoundException — the catch block logs "Failed to hide splash screen" but the
// launcher then routes through DevLauncherErrorActivity, surfacing a blank Compose error
// screen instead of the dev manager.
//
// hide() is intentionally a no-op: dev-launcher's reflection succeeds (no error, no fallback
// activity), but our Dialog stays up. JS-side SplashScreen.hide() drives the actual fade once
// the bundle loads. In release builds dev-launcher isn't compiled in, so this path never runs.
//
// This squats on expo.modules.splashscreen.* — installing the official expo-splash-screen
// alongside expo-splash-full-screen will cause a gradle "duplicate class" error. That's
// intentional: only one splash module should be active.
object SplashScreenManager {
  fun hide() {}
}
