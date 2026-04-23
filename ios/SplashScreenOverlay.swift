import UIKit

final class SplashScreenOverlay {
  static let shared = SplashScreenOverlay()

  private var overlayView: UIView?
  private var iconView: UIImageView?
  private var fullscreenView: UIImageView?
  private var hasShown = false
  private var scheduledWorkItem: DispatchWorkItem?
  private var scheduledHide: DispatchWorkItem?
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

  private init() {}

  func showOnAppLaunch() {
    if hasShown { return }
    hasShown = true

    // Sync present from didFinishLaunchingWithOptions (already on main). Deferring to the next
    // runloop via DispatchQueue.main.async lets UIKit paint one frame with the default window
    // backgroundColor (usually white) before the overlay mounts → visible flicker on dark splashes.
    present()
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
      guard let overlay = self.overlayView else { return }

      let elapsed = CFAbsoluteTimeGetCurrent() - self.launchTime
      let remaining = self.minVisible - elapsed

      if remaining > 0 {
        let work = DispatchWorkItem { [weak self] in
          self?.fadeOutRoot(overlay: overlay, fade: fade, duration: duration)
        }
        self.scheduledHide = work
        DispatchQueue.main.asyncAfter(deadline: .now() + remaining, execute: work)
        return
      }

      self.fadeOutRoot(overlay: overlay, fade: fade, duration: duration)
    }
  }

  private func fadeOutRoot(overlay: UIView, fade: Bool, duration: TimeInterval) {
    if fade {
      UIView.animate(
        withDuration: duration,
        delay: 0,
        options: [.curveEaseIn],
        animations: { overlay.alpha = 0 },
        completion: { _ in
          overlay.removeFromSuperview()
          self.reset()
        },
      )
    } else {
      overlay.removeFromSuperview()
      self.reset()
    }
  }

  private func present() {
    guard let window = Self.keyWindow() else { return }
    let cfg = currentConfig()

    // Paint window bg to splash bg before the overlay view is added, so any pre-layout frame
    // (window already keyed but overlay subview not yet attached) matches the storyboard.
    window.backgroundColor = cfg.backgroundColor

    launchTime = CFAbsoluteTimeGetCurrent()
    let hasIcon = cfg.iconEnabled && UIImage(named: cfg.iconImageName) != nil
    minVisible =
      hasIcon
        ? (cfg.fadeIn + cfg.iconDisplay + cfg.crossfade + cfg.fullscreenHold)
        : (cfg.fadeIn + cfg.fullscreenHold)

    let root = UIView(frame: window.bounds)
    root.backgroundColor = cfg.backgroundColor
    root.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    root.isUserInteractionEnabled = false

    var firstLayer: UIView?

    if let fsImage = UIImage(named: cfg.fullscreenImageName) {
      let iv = UIImageView(frame: root.bounds)
      iv.image = fsImage
      iv.contentMode = .scaleAspectFill
      iv.clipsToBounds = true
      iv.autoresizingMask = [.flexibleWidth, .flexibleHeight]
      iv.alpha = cfg.iconEnabled && UIImage(named: cfg.iconImageName) != nil ? 0 : 1
      root.addSubview(iv)
      fullscreenView = iv
      firstLayer = iv
    }

    if cfg.iconEnabled, let iconImage = UIImage(named: cfg.iconImageName) {
      let iv = UIImageView(image: iconImage)
      iv.contentMode = .scaleAspectFit
      let size = cfg.iconWidth
      iv.frame = CGRect(
        x: (root.bounds.width - size) / 2,
        y: (root.bounds.height - size) / 2,
        width: size,
        height: size,
      )
      iv.autoresizingMask = [.flexibleTopMargin, .flexibleBottomMargin, .flexibleLeftMargin, .flexibleRightMargin]
      // Start visible so the launch storyboard (bg + icon at the same iconWidth) hands off to the
      // overlay without a black/invisible frame. fadeIn runs as a no-op animation below to keep
      // the timeline intact.
      iv.alpha = 1
      root.addSubview(iv)
      iconView = iv
      firstLayer = iv
    }

    window.addSubview(root)
    overlayView = root

    if let target = firstLayer {
      UIView.animate(
        withDuration: cfg.fadeIn,
        delay: 0,
        options: [.curveEaseOut],
        animations: { target.alpha = 1 },
      )
    }

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
    overlayView = nil
    iconView = nil
    fullscreenView = nil
    launchTime = 0
    minVisible = 0
  }

  private static func keyWindow() -> UIWindow? {
    if #available(iOS 15.0, *) {
      return UIApplication.shared.connectedScenes
        .compactMap { $0 as? UIWindowScene }
        .flatMap { $0.windows }
        .first { $0.isKeyWindow }
    }
    return UIApplication.shared.windows.first { $0.isKeyWindow }
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
