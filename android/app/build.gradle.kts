plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
}

android {
  namespace = "com.voxtv.firetv"
  compileSdk = 34

  defaultConfig {
    applicationId = "com.voxtv.firetv"
    // Fire OS 6 (Android 7.1) and newer — older sticks ship a WebView too old
    // for the player.
    minSdk = 24
    targetSdk = 34
    versionCode = 1
    versionName = "1.0.0"
  }

  buildTypes {
    debug {
      isMinifyEnabled = false
    }
    release {
      // Deliberately unshrunk: this app is sideloaded, not published, and a
      // stripped WebView/NanoHTTPD surface is not worth the debugging risk.
      isMinifyEnabled = false
      proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
      // Sideloaded builds are signed with the local debug key unless a real
      // keystore is supplied; an unsigned APK cannot be installed at all.
      signingConfig = signingConfigs.getByName("debug")
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  kotlinOptions {
    jvmTarget = "17"
  }

  buildFeatures {
    buildConfig = true
  }

  packaging {
    resources.excludes += setOf("META-INF/*.kotlin_module", "META-INF/DEPENDENCIES")
  }

  // The web build lands here via scripts/build-web-assets.mjs.
  sourceSets["main"].assets.srcDirs("src/main/assets")

  lint {
    abortOnError = false
  }

  testOptions {
    unitTests.isReturnDefaultValues = true
  }
}

dependencies {
  implementation("androidx.core:core-ktx:1.13.1")
  implementation("androidx.appcompat:appcompat:1.7.0")
  implementation("androidx.webkit:webkit:1.11.0")
  implementation("com.squareup.okhttp3:okhttp:4.12.0")
  implementation("org.nanohttpd:nanohttpd:2.3.1")

  testImplementation("junit:junit:4.13.2")
}
