package expo.modules.splashfullscreen

import android.app.Activity
import android.app.Dialog
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.animation.AccelerateInterpolator
import android.view.animation.DecelerateInterpolator
import android.view.animation.PathInterpolator
import android.widget.FrameLayout
import android.widget.ImageView

object SplashScreenOverlay {
  private var dialog: Dialog? = null
  private var rootFrame: FrameLayout? = null
  private var iconView: ImageView? = null
  private var fullscreenView: ImageView? = null
  private val handler = Handler(Looper.getMainLooper())
  private var scheduledFullscreen: Runnable? = null
  private var scheduledHide: Runnable? = null
  private var hasShown = false
  private var launchTimeMs: Long = 0L
  private var minVisibleMs: Long = 0L
  private var boundActivity: Activity? = null

  @JvmStatic
  fun showOnActivityCreate(activity: Activity) {
    if (hasShown) return
    hasShown = true
    boundActivity = activity
    if (dialog?.isShowing == true) return

    val res = activity.resources
    val pkg = activity.packageName

    val iconEnabled = getBool(res, pkg, "splash_icon_enabled", false)
    val fadeInMs = getInt(res, pkg, "splash_fade_in", 250)
    val iconDisplayMs = getInt(res, pkg, "splash_icon_display_ms", 1200)
    val crossfadeMs = getInt(res, pkg, "splash_crossfade_ms", 400)
    val fullscreenHoldMs = getInt(res, pkg, "splash_fullscreen_hold_ms", 600)
    val iconWidthDp = getInt(res, pkg, "splash_icon_width", 200)
    val bgColor = getColor(res, pkg, "splash_background", Color.WHITE, activity)
    val iconDrawableId = res.getIdentifier("splash_icon", "drawable", pkg)
    val fullscreenDrawableId = res.getIdentifier("splash_fullscreen", "drawable", pkg)

    launchTimeMs = System.currentTimeMillis()
    minVisibleMs =
      if (iconEnabled && iconDrawableId != 0 && fullscreenDrawableId != 0) {
        (fadeInMs + iconDisplayMs + crossfadeMs + fullscreenHoldMs).toLong()
      } else {
        (fadeInMs + fullscreenHoldMs).toLong()
      }

    val frame = FrameLayout(activity).apply {
      setBackgroundColor(bgColor)
    }

    if (fullscreenDrawableId != 0) {
      val fs = ImageView(activity).apply {
        setImageResource(fullscreenDrawableId)
        // FIT_XY matches the layer-list <bitmap android:gravity="fill"/> used for windowBackground
        // when icon is disabled, so the cold-start drawable → overlay ImageView handoff renders the
        // same image at the same size (no perceived resize jump).
        scaleType = ImageView.ScaleType.FIT_XY
        layoutParams = FrameLayout.LayoutParams(
          FrameLayout.LayoutParams.MATCH_PARENT,
          FrameLayout.LayoutParams.MATCH_PARENT,
        )
        alpha = if (iconEnabled && iconDrawableId != 0) 0f else 1f
      }
      frame.addView(fs)
      fullscreenView = fs
    }

    if (iconEnabled && iconDrawableId != 0) {
      val density = res.displayMetrics.density
      val sizePx = (iconWidthDp * density).toInt()
      val iv = ImageView(activity).apply {
        setImageResource(iconDrawableId)
        scaleType = ImageView.ScaleType.FIT_CENTER
        layoutParams = FrameLayout.LayoutParams(sizePx, sizePx, Gravity.CENTER)
        // Start visible so the launch windowBackground (bg + icon at the same iconWidth) hands
        // off to the overlay without a missing-icon frame. fadeIn still runs (as a no-op
        // animation) below to keep the timeline intact.
        alpha = 1f
      }
      frame.addView(iv)
      iconView = iv
    }

    val d = Dialog(activity, android.R.style.Theme_Translucent_NoTitleBar).apply {
      setCancelable(false)
      setContentView(frame)
      window?.apply {
        setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
        setLayout(
          WindowManager.LayoutParams.MATCH_PARENT,
          WindowManager.LayoutParams.MATCH_PARENT,
        )
        setFlags(
          WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
          WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
        )
        statusBarColor = Color.TRANSPARENT
        navigationBarColor = Color.TRANSPARENT
      }
    }

    try {
      d.show()
    } catch (_: Throwable) {
      return
    }

    dialog = d
    rootFrame = frame

    val firstLayer: View? = if (iconEnabled && iconDrawableId != 0) iconView else fullscreenView
    firstLayer
      ?.animate()
      ?.alpha(1f)
      ?.setDuration(fadeInMs.toLong())
      ?.setInterpolator(DecelerateInterpolator())
      ?.start()

    if (iconEnabled && iconDrawableId != 0 && fullscreenDrawableId != 0) {
      val runnable = Runnable { crossfadeToFullScreen(crossfadeMs.toLong()) }
      scheduledFullscreen = runnable
      handler.postDelayed(runnable, (fadeInMs + iconDisplayMs).toLong())
    }
  }

  @JvmStatic
  fun showFullScreen() {
    handler.post {
      cancelScheduled()
      val crossfadeMs = rootFrame?.context?.let {
        getInt(it.resources, it.packageName, "splash_crossfade_ms", 400).toLong()
      } ?: 400L
      crossfadeToFullScreen(crossfadeMs)
    }
  }

  private fun crossfadeToFullScreen(durationMs: Long) {
    val interp = PathInterpolator(0.77f, 0f, 0.175f, 1f)
    iconView
      ?.animate()
      ?.alpha(0f)
      ?.setDuration(durationMs)
      ?.setInterpolator(interp)
      ?.start()
    fullscreenView
      ?.animate()
      ?.alpha(1f)
      ?.setDuration(durationMs)
      ?.setInterpolator(interp)
      ?.start()
  }

  @JvmStatic
  fun hide(fade: Boolean, durationMs: Long) {
    handler.post {
      val d = dialog ?: return@post
      scheduledHide?.let { handler.removeCallbacks(it) }
      scheduledHide = null

      val elapsed = System.currentTimeMillis() - launchTimeMs
      val remaining = minVisibleMs - elapsed

      if (remaining > 0) {
        val runnable = Runnable { fadeOutRoot(d, fade, durationMs) }
        scheduledHide = runnable
        handler.postDelayed(runnable, remaining)
        return@post
      }

      fadeOutRoot(d, fade, durationMs)
    }
  }

  @JvmStatic
  fun onActivityDestroyed(activity: Activity) {
    if (boundActivity !== activity) return
    cancelScheduled()
    val d = dialog
    dialog = null
    if (d != null) {
      try {
        if (d.isShowing && d.window?.decorView?.isAttachedToWindow == true) {
          d.dismiss()
        }
      } catch (_: Throwable) {
      }
    }
    rootFrame = null
    iconView = null
    fullscreenView = null
    launchTimeMs = 0L
    minVisibleMs = 0L
    hasShown = false
    boundActivity = null
  }

  private fun fadeOutRoot(d: Dialog, fade: Boolean, durationMs: Long) {
    if (fade) {
      rootFrame
        ?.animate()
        ?.alpha(0f)
        ?.setDuration(durationMs)
        ?.setInterpolator(AccelerateInterpolator())
        ?.withEndAction {
          dismissQuietly(d)
          reset()
        }
        ?.start() ?: run {
        dismissQuietly(d)
        reset()
      }
    } else {
      dismissQuietly(d)
      reset()
    }
  }

  private fun cancelScheduled() {
    scheduledFullscreen?.let { handler.removeCallbacks(it) }
    scheduledFullscreen = null
    scheduledHide?.let { handler.removeCallbacks(it) }
    scheduledHide = null
  }

  private fun dismissQuietly(d: Dialog) {
    try {
      val activity = boundActivity
      val attached = d.window?.decorView?.isAttachedToWindow == true
      val activityAlive = activity == null || (!activity.isFinishing && !activity.isDestroyed)
      if (d.isShowing && attached && activityAlive) d.dismiss()
    } catch (_: Throwable) {
    }
  }

  private fun reset() {
    dialog = null
    rootFrame = null
    iconView = null
    fullscreenView = null
    launchTimeMs = 0L
    minVisibleMs = 0L
  }

  private fun getBool(res: android.content.res.Resources, pkg: String, name: String, default: Boolean): Boolean {
    val id = res.getIdentifier(name, "bool", pkg)
    return if (id != 0) res.getBoolean(id) else default
  }

  private fun getInt(res: android.content.res.Resources, pkg: String, name: String, default: Int): Int {
    val id = res.getIdentifier(name, "integer", pkg)
    return if (id != 0) res.getInteger(id) else default
  }

  private fun getColor(
    res: android.content.res.Resources,
    pkg: String,
    name: String,
    default: Int,
    activity: Activity,
  ): Int {
    val id = res.getIdentifier(name, "color", pkg)
    return if (id != 0) activity.getColor(id) else default
  }
}
