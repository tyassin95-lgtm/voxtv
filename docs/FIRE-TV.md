# Vox IPTV on Fire TV

This turns the web app into a real Android app you can install on a Fire TV
Stick. Nothing about the app changes: it is the same build, the same library,
the same player — packaged so it launches from the Fire TV home screen and
answers the remote.

---

## 1. How it is put together

The APK contains three things:

| Piece                           | What it does                                                                                 |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| The web build                   | The exact bundle the site is built from, copied into the APK.                                |
| A tiny web server               | Runs inside the app on `http://127.0.0.1:47231` and serves that bundle.                      |
| A Kotlin port of the API routes | `/api/iptv/stream`, `/fetch`, `/image`, `/subtitles` — the parts a browser cannot do itself. |

So the app is fully self-contained. **Video goes straight from your provider to
the Fire Stick** — it does not travel through a hosted server on the way, which
is faster and cheaper than the browser version, and it keeps working even if
the website is down.

The port is fixed on purpose: your playlist, favourites and watch history live
in the browser storage for that exact address, so a changing port would wipe
them on every launch.

---

## 2. Build the APK

### Option A — let GitHub build it (recommended, nothing to install)

1. Push this branch to GitHub (already done if you are reading this in the repo).
2. Open your repository on github.com → **Actions** tab.
   - First time only: GitHub shows _"Workflows aren't being run on this
     repository"_ → click **I understand my workflows, go ahead and enable them**.
3. In the left sidebar pick **Build Fire TV APK** → **Run workflow** →
   choose the branch → **Run workflow**.
4. Wait ~4 minutes for the green tick.
5. Get the APK, either way:
   - **Artifact:** open the finished run → **Artifacts** → `voxtv-firetv-apk`
     (downloads as a `.zip`, unzip it to get `voxtv-firetv.apk`), or
   - **Release (easier for the Fire Stick):** the run also publishes
     `https://github.com/<you>/voxtv/releases/download/firetv-latest/voxtv-firetv.apk`
     — a direct link the Fire TV Downloader app can open. Replace `<you>` with
     your GitHub username.

The release is only published for runs on `main` or runs you start by hand with
**Run workflow**.

### Option B — build it on your own computer

You need **JDK 17** and the **Android SDK** (installing
[Android Studio](https://developer.android.com/studio) gives you both).

```bash
npm ci
npm run apk:build
# → android/app/build/outputs/apk/release/app-release.apk
```

`npm run apk:build` does two things: `scripts/build-web-assets.mjs` builds the
web bundle and copies it (plus a captured `index.html` shell) into
`android/app/src/main/assets/web/`, then Gradle builds the APK around it.

If Gradle cannot find the SDK, create `android/local.properties`:

```properties
sdk.dir=/home/you/Android/Sdk
```

---

## 3. Prepare the Fire Stick (one time)

1. **Settings → My Fire TV → About** → click **Fire TV Stick** 7 times until it
   says _"No need, you are already a developer"_.
2. **Settings → My Fire TV → Developer options** →
   - **Apps from Unknown Sources** → **ON**
   - **ADB debugging** → **ON** (only needed for the adb method below)
3. Note the device IP if you plan to use adb: **Settings → My Fire TV →
   About → Network**.

---

## 4. Install the app

### Method 1 — Downloader app (no computer needed)

1. On the Fire Stick, search for **Downloader** (the orange one by AFTVnews) and
   install it.
2. Open it, choose **Browser → Home**, and type the release URL from step 2A:
   `https://github.com/<you>/voxtv/releases/download/firetv-latest/voxtv-firetv.apk`
3. Press **Go**, wait for the download, then **Install** → **Done → Delete**.

Tip: the URL is long to type with a remote. Downloader remembers it afterwards,
and you can also shorten it with any URL shortener first.

### Method 2 — adb from your computer

```bash
adb connect <fire-stick-ip>:5555      # accept the prompt on the TV
adb install -r voxtv-firetv.apk
adb shell monkey -p com.voxtv.firetv 1   # optional: launch it
```

### Method 3 — "Send files to TV"

Install the _Send files to TV_ app on both your phone and the Fire Stick, send
the APK across, then open it from the receiving app.

After installing, the app appears at the **end of your app list** on the Fire TV
home screen (Apps & Channels → See All). Move it to the front row from there.

---

## 5. Using the remote

| Button                                    | What it does                                                                                                                     |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| D-pad                                     | Moves between the sidebar, search, sort and the grid. The red outline only appears once you start using the d-pad.               |
| Select (centre)                           | Opens the focused item; in the player it presses the focused control.                                                            |
| Back                                      | Closes whatever is open — subtitle sheet, keyboard, category, player. On the home screen, press **Back twice** to leave the app. |
| Play/Pause                                | Play/pause. Works anywhere in the player, even with the controls hidden.                                                         |
| Rewind / Fast-forward                     | Seeks; hold to seek faster. On live TV, jumps to the previous/next channel.                                                      |
| Menu / Options                            | Passed to the app as a menu key.                                                                                                 |
| Up/Down while the player chrome is hidden | Shows the controls again.                                                                                                        |

Typing (playlist URL, search, subtitle search) uses the app's own on-screen
keyboard with English and Arabic layouts — you never need the Fire TV keyboard.

---

## 6. First run

1. Launch **Vox IPTV**.
2. Enter your **M3U URL** or **Xtream Codes** details, exactly as in the browser.
3. Wait for the library sync to finish; it is cached on the stick from then on.

Everything else — Live TV, Movies, TV Shows, favourites, Continue Watching,
subtitles, audio sync, the aspect-ratio button and Settings — works as it does
in the browser.

---

## 7. Updating later

Build again (Option A or B) and install over the top. The GitHub workflow reuses
the same signing key between runs so the update installs in place.

If you ever see **INSTALL_FAILED_UPDATE_INCOMPATIBLE**, the key changed:
uninstall the old app first (**Settings → Applications → Manage Installed
Applications → Vox IPTV → Uninstall**), then install the new APK. Your playlist
and library are stored inside the app, so an uninstall means adding the playlist
again.

---

## 8. Troubleshooting

**Black or white screen on launch.** The app could not start its internal
server. Force-close it (Settings → Applications → Manage Installed Applications
→ Vox IPTV → Force stop) and open it again.

**A stream will not play.** The player already tries several URL shapes and both
of its engines. Check the same channel in the browser build: if it fails there
too, it is the provider, not the app.

**Nothing happens when I press a remote key.** Make sure the app is in the
foreground; the Fire TV overlay (long-press Home) swallows keys until dismissed.

**The app feels stale, or the library is wrong.** Use **Settings → Clear library
cache**, or **Reset app to default** to go back to the setup screen.

**Look at the logs** (needs adb, section 4 method 2):

```bash
adb logcat -s VoxIPTV:V VoxServer:V chromium:E
```

**Inspect the page itself.** Debug builds allow remote debugging: connect adb,
then open `chrome://inspect` in Chrome on your computer and click **inspect**
under the Vox IPTV WebView. (Release builds have this switched off.)

---

## 9. What is in `android/`

```
android/
  app/src/main/
    AndroidManifest.xml          Leanback launcher entry, cleartext + banner
    assets/web/                  the web build (generated, not committed)
    java/com/voxtv/firetv/
      MainActivity.kt            WebView host, remote keys, Back handling
      LocalServer.kt             NanoHTTPD: static assets + /api/iptv/*
      IptvProxy.kt               port of src/lib/iptv/server-proxy.ts
      OpenSubtitles.kt           port of src/lib/iptv/opensubtitles.ts
      StreamDetect.kt            port of src/lib/iptv/stream-detect.ts
      Support.kt                 small HTTP/JSON helpers
    res/                         icon, TV banner, theme, network config
```

Minimum Fire OS is 6 (Android 7.1); the bundle is compiled for Chromium 70 and
newer, which every current Fire TV Stick exceeds.
