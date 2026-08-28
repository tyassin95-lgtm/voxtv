# NanoHTTPD reflects on nothing we use, but keep its public surface intact.
-keep class fi.iki.elonen.** { *; }
-dontwarn fi.iki.elonen.**

# OkHttp ships optional Conscrypt / BouncyCastle hooks that are absent here.
-dontwarn okhttp3.internal.platform.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**

# Anything reachable from the WebView JavaScript bridge must survive shrinking.
-keepclassmembers class com.voxtv.firetv.** {
  @android.webkit.JavascriptInterface <methods>;
}
