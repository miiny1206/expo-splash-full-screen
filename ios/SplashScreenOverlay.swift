import UIKit

final class SplashScreenOverlay: NSObject {
  static let shared = SplashScreenOverlay()

  private var overlayWindow: UIWindow?
  private var iconView: UIImageView?
  private var fullscreenView: UIImageView?
  private var hasShown = false
  private var hasMounted = false
  private var scheduledWorkItem: DispatchWorkItem?
  private var scheduledHide: DispatchWorkItem?
  private var pendingHide: (fade: Bool, duration: TimeInterval)?
  private var sceneObserver: NSObjectProtocol?
  private var jsFailObserver: NSObjectProtocol?
  private var devContentObserver: NSObjectProtocol?
  private var launchTime: CFAbsoluteTime = 0
  private var minVisible: TimeInterval = 0

  private struct Config {
    let iconEnabled: Bool
    let iconImageName: String
    let iconWidth: CGFloat
    let fullscreenImageName: String
    let backgroundColor: UIColor
    let fadeIn: TimeInterval
    let fadeOut: TimeInterval
    let iconDisplay: TimeInterval
    let crossfade: TimeInterval
    let fullscreenHold: TimeInterval
  }

  override private init() { super.init() }

  #if DEBUG
    @objc fileprivate func devTapDismiss() {
      forceHide(fade: true, duration: 0.2)
    }
  #endif

  func showOnAppLaunch() {
    if hasShown { return }
    hasShown = true

    // Auto-dismiss if the JS bundle fails to load — otherwise our elevated-windowLevel overlay
    // would cover RN's red-box error screen in dev mode (Metro down, syntax error, etc.) and the
    // user would be stuck on the splash with no visible failure. Subscribe by string so we don't
    // need to import React headers from the Expo module.
    jsFailObserver = NotificationCenter.default.addObserver(
      forName: NSNotification.Name("RCTJavaScriptDidFailToLoadNotification"),
      object: nil,
      queue: .main,
    ) { [weak self] _ in
      self?.forceHide(fade: true, duration: 0.2)
    }

    #if DEBUG
      // In dev builds, also dismiss as soon as RN renders any content — this lets the
      // expo-dev-client launcher screen, Metro bundle-progress UI, and red-box errors all
      // surface above us. Production builds skip this so the brand splash plays its full
      // timeline regardless of when the first RN frame is composited.
      devContentObserver = NotificationCenter.default.addObserver(
        forName: NSNotification.Name("RCTContentDidAppearNotification"),
        object: nil,
        queue: .main,
      ) { [weak self] _ in
        self?.forceHide(fade: true, duration: 0.2)
      }
    #endif

    // Subscriber typically fires before any UIWindowScene connects. Wait for the first scene to
    // activate, then create our own UIWindow tied to that scene at an elevated windowLevel — this
    // is how Android's Dialog works (separate window above the activity), and it makes z-order
    // independent of RN's view hierarchy. addSubview on the RN window does not work reliably
    // because RN may attach RCTRootContentView (or replace rootViewController) after we mount,
    // pushing our overlay underneath in release builds.
    if let scene = Self.activeWindowScene() {
      present(in: scene)
    } else {
      sceneObserver = NotificationCenter.default.addObserver(
        forName: UIScene.didActivateNotification,
        object: nil,
        queue: .main,
      ) { [weak self] note in
        guard let self = self else { return }
        guard let scene = note.object as? UIWindowScene else { return }
        self.removeSceneObserver()
        if !self.hasMounted { self.present(in: scene) }
        if let pending = self.pendingHide {
          self.pendingHide = nil
          self.hide(fade: pending.fade, duration: pending.duration)
        }
      }
    }
  }

  private func removeSceneObserver() {
    if let observer = sceneObserver {
      NotificationCenter.default.removeObserver(observer)
      sceneObserver = nil
    }
  }

  private func removeJsFailObserver() {
    if let observer = jsFailObserver {
      NotificationCenter.default.removeObserver(observer)
      jsFailObserver = nil
    }
  }

  private func removeDevContentObserver() {
    if let observer = devContentObserver {
      NotificationCenter.default.removeObserver(observer)
      devContentObserver = nil
    }
  }

  private func forceHide(fade: Bool, duration: TimeInterval) {
    DispatchQueue.main.async {
      self.scheduledHide?.cancel()
      self.scheduledHide = nil
      self.scheduledWorkItem?.cancel()
      self.scheduledWorkItem = nil
      guard let window = self.overlayWindow else {
        self.pendingHide = nil
        return
      }
      self.fadeOut(window: window, fade: fade, duration: duration)
    }
  }

  func showFullScreen() {
    DispatchQueue.main.async {
      self.scheduledWorkItem?.cancel()
      self.scheduledWorkItem = nil
      self.crossfadeToFullScreen(duration: self.currentConfig().crossfade)
    }
  }

  func hide(fade: Bool, duration: TimeInterval) {
    DispatchQueue.main.async {
      self.scheduledHide?.cancel()
      self.scheduledHide = nil

      // If the overlay window hasn't mounted yet (no scene activated when showOnAppLaunch fired),
      // queue this hide and let the scene activation path replay it once present() runs.
      guard let window = self.overlayWindow else {
        if !self.hasMounted { self.pendingHide = (fade, duration) }
        return
      }

      let elapsed = CFAbsoluteTimeGetCurrent() - self.launchTime
      let remaining = self.minVisible - elapsed

      if remaining > 0 {
        let work = DispatchWorkItem { [weak self] in
          self?.fadeOut(window: window, fade: fade, duration: duration)
        }
        self.scheduledHide = work
        DispatchQueue.main.asyncAfter(deadline: .now() + remaining, execute: work)
        return
      }

      self.fadeOut(window: window, fade: fade, duration: duration)
    }
  }

  private func fadeOut(window: UIWindow, fade: Bool, duration: TimeInterval) {
    guard fade, let container = window.rootViewController?.view,
      let snapshot = container.snapshotView(afterScreenUpdates: false)
    else {
      tearDown(window: window)
      return
    }

    // Animating UIWindow.alpha (or the rootVC.view alpha while subviews are still mid-crossfade)
    // drops frames on launch because the compositor re-blends multiple animating layers each
    // frame *and* RN is rendering its first frame in parallel. Snapshotting captures the current
    // visible state to a single static layer; we hide the live tree and fade the snapshot — one
    // bitmap, one opacity tween, no compositing thrash.
    container.addSubview(snapshot)
    iconView?.isHidden = true
    fullscreenView?.isHidden = true
    // Drop the solid window/container bg so the fading snapshot reveals RN's window beneath
    // instead of the splash bg color (which would block the fade and require an extra teardown
    // frame).
    window.backgroundColor = .clear
    container.backgroundColor = .clear
    window.isOpaque = false
    UIView.animate(
      withDuration: duration,
      delay: 0,
      options: [.curveEaseIn],
      animations: { snapshot.alpha = 0 },
      completion: { _ in self.tearDown(window: window) },
    )
  }

  private func tearDown(window: UIWindow) {
    window.isHidden = true
    reset()
  }

  private func present(in scene: UIWindowScene) {
    hasMounted = true
    let cfg = currentConfig()

    // Paint the RN window's bg to the splash bg before mounting our overlay. There's an
    // unavoidable gap between the storyboard fading out (when the scene activates) and our
    // overlay window appearing — without this, that one-frame window would show RN's default
    // black bg, producing a black flash. Especially visible when iconSplash is disabled because
    // there's no icon overlay to mask it.
    for existing in scene.windows {
      existing.backgroundColor = cfg.backgroundColor
      existing.rootViewController?.view.backgroundColor = cfg.backgroundColor
    }

    let window = UIWindow(windowScene: scene)
    // .alert (2000) sits above .normal (0) and .statusBar (1000) — guarantees the overlay paints
    // above the RN window regardless of when RN attaches its content.
    window.windowLevel = .alert + 1
    window.backgroundColor = cfg.backgroundColor

    let vc = UIViewController()
    vc.view.backgroundColor = cfg.backgroundColor
    window.rootViewController = vc

    #if DEBUG
      // In dev builds expo-dev-client owns a native launcher controller (QR scan / scheme picker)
      // that we have no notification hook for, so the elevated-windowLevel overlay can swallow it.
      // Add a tap gesture as a manual escape hatch and a hard 2.5s auto-hide so the user always
      // gets back to the launcher / Metro progress UI even if no RN content ever loads.
      window.isUserInteractionEnabled = true
      vc.view.isUserInteractionEnabled = true
      let tap = UITapGestureRecognizer(target: self, action: #selector(self.devTapDismiss))
      vc.view.addGestureRecognizer(tap)
      DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) { [weak self] in
        self?.forceHide(fade: true, duration: 0.2)
      }
    #else
      window.isUserInteractionEnabled = false
      vc.view.isUserInteractionEnabled = false
    #endif

    launchTime = CFAbsoluteTimeGetCurrent()
    let hasIcon = cfg.iconEnabled && UIImage(named: cfg.iconImageName) != nil
    minVisible =
      hasIcon
        ? (cfg.fadeIn + cfg.iconDisplay + cfg.crossfade + cfg.fullscreenHold)
        : (cfg.fadeIn + cfg.fullscreenHold)

    let container: UIView = vc.view

    if let fsImage = UIImage(named: cfg.fullscreenImageName) {
      let iv = UIImageView()
      iv.image = fsImage
      iv.contentMode = .scaleAspectFill
      iv.clipsToBounds = true
      iv.translatesAutoresizingMaskIntoConstraints = false
      iv.alpha = hasIcon ? 0 : 1
      container.addSubview(iv)
      NSLayoutConstraint.activate([
        iv.topAnchor.constraint(equalTo: container.topAnchor),
        iv.bottomAnchor.constraint(equalTo: container.bottomAnchor),
        iv.leadingAnchor.constraint(equalTo: container.leadingAnchor),
        iv.trailingAnchor.constraint(equalTo: container.trailingAnchor),
      ])
      fullscreenView = iv
    }

    if cfg.iconEnabled, let iconImage = UIImage(named: cfg.iconImageName) {
      let iv = UIImageView(image: iconImage)
      iv.contentMode = .scaleAspectFit
      iv.translatesAutoresizingMaskIntoConstraints = false
      // Start visible so the launch storyboard (bg + icon at the same iconWidth) hands off to the
      // overlay without a black/invisible frame.
      iv.alpha = 1
      container.addSubview(iv)
      NSLayoutConstraint.activate([
        iv.centerXAnchor.constraint(equalTo: container.centerXAnchor),
        iv.centerYAnchor.constraint(equalTo: container.centerYAnchor),
        iv.widthAnchor.constraint(equalToConstant: cfg.iconWidth),
        iv.heightAnchor.constraint(equalToConstant: cfg.iconWidth),
      ])
      iconView = iv
    }

    // isHidden = false makes the window visible without keying it — RN's window stays key, so
    // first-responder / keyboard / scene events continue to route to RN.
    window.isHidden = false
    overlayWindow = window

    if cfg.iconEnabled, iconView != nil, fullscreenView != nil {
      let work = DispatchWorkItem { [weak self] in
        self?.crossfadeToFullScreen(duration: cfg.crossfade)
      }
      scheduledWorkItem = work
      DispatchQueue.main.asyncAfter(deadline: .now() + cfg.fadeIn + cfg.iconDisplay, execute: work)
    }
  }

  private func crossfadeToFullScreen(duration: TimeInterval) {
    UIView.animate(
      withDuration: duration,
      delay: 0,
      options: [.curveEaseInOut],
      animations: {
        self.iconView?.alpha = 0
        self.fullscreenView?.alpha = 1
      },
    )
  }

  private func reset() {
    overlayWindow = nil
    iconView = nil
    fullscreenView = nil
    launchTime = 0
    minVisible = 0
    hasMounted = false
    removeSceneObserver()
    removeJsFailObserver()
    removeDevContentObserver()
    pendingHide = nil
  }

  private static func activeWindowScene() -> UIWindowScene? {
    let scenes = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
    if let active = scenes.first(where: { $0.activationState == .foregroundActive }) {
      return active
    }
    return scenes.first
  }

  private func currentConfig() -> Config {
    let info = Bundle.main.infoDictionary ?? [:]
    let iconEnabled = info["SplashIconEnabled"] as? Bool ?? false
    let iconWidth = info["SplashIconWidth"] as? CGFloat ?? 200
    let fadeIn = (info["SplashFadeIn"] as? NSNumber)?.doubleValue ?? 250
    let fadeOut = (info["SplashFadeOut"] as? NSNumber)?.doubleValue ?? 300
    let iconDisplay = (info["SplashIconDisplayMs"] as? NSNumber)?.doubleValue ?? 1200
    let crossfade = (info["SplashCrossfadeMs"] as? NSNumber)?.doubleValue ?? 400
    let fullscreenHold = (info["SplashFullscreenHoldMs"] as? NSNumber)?.doubleValue ?? 600
    let bgHex = info["SplashBackgroundColor"] as? String ?? "#FFFFFF"
    return Config(
      iconEnabled: iconEnabled,
      iconImageName: "SplashIcon",
      iconWidth: iconWidth,
      fullscreenImageName: "SplashFullScreen",
      backgroundColor: Self.color(fromHex: bgHex) ?? .white,
      fadeIn: fadeIn / (fadeIn > 10 ? 1000 : 1),
      fadeOut: fadeOut / (fadeOut > 10 ? 1000 : 1),
      iconDisplay: iconDisplay / (iconDisplay > 10 ? 1000 : 1),
      crossfade: crossfade / (crossfade > 10 ? 1000 : 1),
      fullscreenHold: fullscreenHold / (fullscreenHold > 10 ? 1000 : 1),
    )
  }

  private static func color(fromHex hex: String) -> UIColor? {
    var cleaned = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    if cleaned.hasPrefix("#") { cleaned.removeFirst() }
    guard cleaned.count == 6 || cleaned.count == 8 else { return nil }
    var value: UInt64 = 0
    guard Scanner(string: cleaned).scanHexInt64(&value) else { return nil }
    let hasAlpha = cleaned.count == 8
    let r = CGFloat((value >> (hasAlpha ? 24 : 16)) & 0xFF) / 255
    let g = CGFloat((value >> (hasAlpha ? 16 : 8)) & 0xFF) / 255
    let b = CGFloat((value >> (hasAlpha ? 8 : 0)) & 0xFF) / 255
    let a = hasAlpha ? CGFloat(value & 0xFF) / 255 : 1
    return UIColor(red: r, green: g, blue: b, alpha: a)
  }
}
