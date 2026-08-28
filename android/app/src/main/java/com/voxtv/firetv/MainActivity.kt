package com.voxtv.firetv

import android.annotation.SuppressLint
import android.app.Activity
import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import java.io.IOException

/**
 * The whole app: a full-screen WebView pointed at the bundled build, which is
 * served by [LocalServer] from inside the APK.
 *
 * This class owns the two things a web page cannot do on a TV — talking to the
 * remote control's media keys and the hardware Back button.
 */
class MainActivity : Activity() {

  private companion object {
    const val TAG = "VoxIPTV"
    const val EXIT_WINDOW_MS = 2500L
  }

  private var server: LocalServer? = null
  private var webView: WebView? = null
  private var fullscreenView: View? = null
  private var lastBackAt = 0L
  private lateinit var container: FrameLayout

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    goImmersive()

    container = FrameLayout(this)
    container.setBackgroundColor(BACKGROUND)
    setContentView(container)

    val port = startServer()
    if (port == null) {
      Toast.makeText(this, R.string.server_failed, Toast.LENGTH_LONG).show()
      return
    }

    val web = buildWebView()
    webView = web
    container.addView(
      web,
      FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT),
    )
    web.loadUrl("http://127.0.0.1:$port/")
  }

  // ------------------------------------------------------------------ server

  private fun startServer(): Int? {
    val ports = intArrayOf(LocalServer.PRIMARY_PORT, *LocalServer.FALLBACK_PORTS)
    for (port in ports) {
      // A restart can leave the previous socket in TIME_WAIT for a moment.
      for (attempt in 0 until 3) {
        try {
          val candidate = LocalServer(::openWebAsset, port)
          candidate.start(30_000, false)
          server = candidate
          Log.i(TAG, "local server listening on $port")
          return port
        } catch (err: IOException) {
          Log.w(TAG, "port $port unavailable (attempt $attempt): ${err.message}")
          try {
            Thread.sleep(250)
          } catch (_: InterruptedException) {
            Thread.currentThread().interrupt()
            return null
          }
        }
      }
    }
    return null
  }

  /** Reads a file out of `assets/web/` in the APK. */
  private fun openWebAsset(path: String): java.io.InputStream? = try {
    assets.open(path, android.content.res.AssetManager.ACCESS_STREAMING)
  } catch (_: java.io.FileNotFoundException) {
    null
  } catch (err: IOException) {
    Log.w(TAG, "asset read failed: $path", err)
    null
  }

  // ------------------------------------------------------------------ web view

  @SuppressLint("SetJavaScriptEnabled")
  private fun buildWebView(): WebView {
    val web = WebView(this)
    web.setBackgroundColor(BACKGROUND)
    web.isFocusable = true
    web.isFocusableInTouchMode = true
    web.overScrollMode = View.OVER_SCROLL_NEVER

    web.settings.apply {
      javaScriptEnabled = true
      domStorageEnabled = true
      databaseEnabled = true
      mediaPlaybackRequiresUserGesture = false
      loadWithOverviewMode = false
      useWideViewPort = false
      builtInZoomControls = false
      displayZoomControls = false
      setSupportZoom(false)
      textZoom = 100
      allowFileAccess = false
      allowContentAccess = false
      cacheMode = android.webkit.WebSettings.LOAD_DEFAULT
      // Provider streams are plain HTTP; the proxy fetches them, not the page.
      mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
      // The app switches to TV navigation when it recognises a TV agent.
      userAgentString = "$userAgentString VoxIPTV/1.0 FireTV AndroidTV"
    }

    WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)

    web.webViewClient = object : WebViewClient() {
      override fun onRenderProcessGone(view: WebView, detail: android.webkit.RenderProcessGoneDetail?): Boolean {
        Log.w(TAG, "web renderer died; rebuilding")
        recreateWebView()
        return true
      }
    }

    web.webChromeClient = object : WebChromeClient() {
      override fun onShowCustomView(view: View, callback: CustomViewCallback) {
        if (fullscreenView != null) {
          callback.onCustomViewHidden()
          return
        }
        fullscreenView = view
        view.setBackgroundColor(BACKGROUND)
        container.addView(
          view,
          FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT),
        )
        goImmersive()
      }

      override fun onHideCustomView() {
        fullscreenView?.let { container.removeView(it) }
        fullscreenView = null
        goImmersive()
      }

      override fun onConsoleMessage(message: ConsoleMessage): Boolean {
        // Every console line costs a JNI hop and a logcat write; keep the noisy
        // levels for debug builds and always surface warnings and errors.
        val level = message.messageLevel()
        val loud = level == ConsoleMessage.MessageLevel.ERROR ||
          level == ConsoleMessage.MessageLevel.WARNING
        if (loud) {
          Log.w(TAG, "web: ${message.message()} (${message.sourceId()}:${message.lineNumber()})")
        } else if (BuildConfig.DEBUG) {
          Log.d(TAG, "web: ${message.message()}")
        }
        return true
      }
    }
    return web
  }

  private fun recreateWebView() {
    webView?.let {
      container.removeView(it)
      it.destroy()
    }
    val port = server?.listeningPort ?: return
    val web = buildWebView()
    webView = web
    container.addView(
      web,
      FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT),
    )
    web.loadUrl("http://127.0.0.1:$port/")
  }

  // ------------------------------------------------------------------ remote control

  /**
   * D-pad keys reach the page as ordinary key events, but media and TV keys do
   * not: Android consumes them before the renderer sees them. Those are turned
   * into the same `KeyboardEvent`s the web build already listens for.
   */
  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    val webKey = webKeyFor(event.keyCode)
    val ours = webKey != null || event.keyCode == KeyEvent.KEYCODE_BACK
    // A forwarded key has to be swallowed for its whole lifecycle. Letting the
    // key-up (or an auto-repeat) reach the web view delivered a second event
    // the page counted as another press — one tap on fast-forward seeked twice.
    if (!ours) return super.dispatchKeyEvent(event)
    if (event.action != KeyEvent.ACTION_DOWN || event.repeatCount != 0) return true
    if (event.keyCode == KeyEvent.KEYCODE_BACK) {
      onBackRequested()
      return true
    }
    sendKeyToPage(webKey!!)
    return true
  }

  private fun webKeyFor(keyCode: Int): String? = when (keyCode) {
    KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> "MediaPlayPause"
    KeyEvent.KEYCODE_MEDIA_PLAY -> "MediaPlay"
    KeyEvent.KEYCODE_MEDIA_PAUSE -> "MediaPause"
    KeyEvent.KEYCODE_MEDIA_STOP -> "MediaStop"
    KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> "MediaFastForward"
    KeyEvent.KEYCODE_MEDIA_REWIND -> "MediaRewind"
    KeyEvent.KEYCODE_MEDIA_NEXT -> "MediaTrackNext"
    KeyEvent.KEYCODE_MEDIA_PREVIOUS -> "MediaTrackPrevious"
    KeyEvent.KEYCODE_CHANNEL_UP, KeyEvent.KEYCODE_PAGE_UP -> "ChannelUp"
    KeyEvent.KEYCODE_CHANNEL_DOWN, KeyEvent.KEYCODE_PAGE_DOWN -> "ChannelDown"
    KeyEvent.KEYCODE_MENU -> "ContextMenu"
    KeyEvent.KEYCODE_GUIDE, KeyEvent.KEYCODE_INFO -> "Info"
    else -> null
  }

  private fun sendKeyToPage(key: String) {
    val js = """
      (function (k) {
        try {
          var fire = function (type) {
            document.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true, cancelable: true }));
          };
          fire('keydown');
          fire('keyup');
        } catch (e) { /* older web views without the constructor */ }
      })(${Json.quote(key)});
    """.trimIndent()
    webView?.evaluateJavascript(js, null)
  }

  /**
   * Back belongs to the page first — it closes menus, the keyboard and the
   * player. Only when the app says it did nothing does Back leave the app, and
   * then only on a confirming second press.
   */
  private fun onBackRequested() {
    val web = webView
    if (web == null) {
      finish()
      return
    }
    web.evaluateJavascript(
      "(function(){try{return window.__voxBack ? !!window.__voxBack() : false}catch(e){return false}})()",
    ) { result ->
      if (result == "true") {
        lastBackAt = 0L
        return@evaluateJavascript
      }
      val now = System.currentTimeMillis()
      if (now - lastBackAt < EXIT_WINDOW_MS) {
        finish()
      } else {
        lastBackAt = now
        Toast.makeText(this, R.string.press_back_again, Toast.LENGTH_SHORT).show()
      }
    }
  }

  // ------------------------------------------------------------------ lifecycle

  private fun goImmersive() {
    WindowCompat.setDecorFitsSystemWindows(window, false)
    val controller = WindowInsetsControllerCompat(window, window.decorView)
    controller.hide(WindowInsetsCompat.Type.systemBars())
    controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) {
      goImmersive()
      webView?.requestFocus()
    }
  }

  override fun onPause() {
    super.onPause()
    webView?.onPause()
  }

  override fun onResume() {
    super.onResume()
    webView?.onResume()
    webView?.requestFocus()
  }

  override fun onDestroy() {
    webView?.let {
      container.removeView(it)
      it.destroy()
    }
    webView = null
    server?.stop()
    server = null
    super.onDestroy()
  }
}

private const val BACKGROUND = 0xFF08080A.toInt()
