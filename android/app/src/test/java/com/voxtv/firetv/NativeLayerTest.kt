package com.voxtv.firetv

import fi.iki.elonen.NanoHTTPD
import java.io.ByteArrayInputStream
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * The Android half of the app re-implements the four server routes the web
 * build relies on. These tests pin the ported behaviour to the TypeScript
 * originals in `src/lib/iptv/` and drive the real server over real HTTP.
 */
class StreamDetectTest {
  @Test
  fun detectsPlaylists() {
    assertEquals(StreamDetect.HLS, StreamDetect.sniff("#EXTM3U\n#EXTINF:1\nseg.ts\n".toByteArray()))
    assertEquals(StreamDetect.HLS, StreamDetect.sniff("\n  #EXTM3U\n".toByteArray()))
  }

  @Test
  fun detectsTransportStreamSyncBytes() {
    val ts = ByteArray(400)
    ts[0] = 0x47
    ts[188] = 0x47
    ts[376] = 0x47
    assertEquals(StreamDetect.TS, StreamDetect.sniff(ts))
  }

  @Test
  fun detectsContainers() {
    val mp4 = ByteArray(12)
    "ftyp".toByteArray().copyInto(mp4, 4)
    assertEquals(StreamDetect.MP4, StreamDetect.sniff(mp4))
    assertEquals(StreamDetect.MKV, StreamDetect.sniff(byteArrayOf(0x1a, 0x45, 0xdf.toByte(), 0xa3.toByte())))
    assertEquals(StreamDetect.UNKNOWN, StreamDetect.sniff(ByteArray(0)))
  }

  @Test
  fun mapsMimeTypes() {
    assertEquals("application/vnd.apple.mpegurl", StreamDetect.mimeForKind(StreamDetect.HLS, null))
    assertEquals("video/mp2t", StreamDetect.mimeForKind(StreamDetect.TS, null))
    assertEquals("text/plain", StreamDetect.mimeForKind(StreamDetect.UNKNOWN, "text/plain"))
    assertTrue(StreamDetect.looksLikePlaylistUrl("http://host/live/1.m3u8", ""))
    assertTrue(StreamDetect.looksLikePlaylistUrl("http://host/live/1", "application/x-mpegURL"))
  }
}

class ProxyLogicTest {
  @Test
  fun rewritesPlaylistReferences() {
    val playlist = """
      #EXTM3U
      #EXT-X-KEY:METHOD=AES-128,URI="key.bin"
      #EXTINF:6,
      seg1.ts
      #EXTINF:6,
      http://other.example/seg2.ts
    """.trimIndent()
    val out = IptvProxy.rewriteM3u8(playlist, "http://host/live/stream.m3u8")
    assertTrue(out.contains("URI=\"/api/iptv/stream?u=http%3A%2F%2Fhost%2Flive%2Fkey.bin\""))
    assertTrue(out.contains("/api/iptv/stream?u=http%3A%2F%2Fhost%2Flive%2Fseg1.ts"))
    assertTrue(out.contains("/api/iptv/stream?u=http%3A%2F%2Fother.example%2Fseg2.ts"))
    assertTrue(out.startsWith("#EXTM3U"))
  }

  @Test
  fun decodesTargetUrls() {
    assertEquals("http://host/a b", IptvProxy.decodeTargetUrl("http%3A%2F%2Fhost%2Fa%20b"))
    assertEquals("https://host/x", IptvProxy.decodeTargetUrl("https://host/x"))
    var rejected = false
    try {
      IptvProxy.decodeTargetUrl("file:///etc/passwd")
    } catch (_: IptvProxy.ProxyException) {
      rejected = true
    }
    assertTrue(rejected)
  }

  @Test
  fun parsesQueryStringsLikeTheBrowser() {
    val parsed = Http.parseQuery("u=http%3A%2F%2Fhost%2Fa%2Bb&probe=1")
    assertEquals("http://host/a+b", parsed["u"])
    assertEquals("1", parsed["probe"])
    assertEquals(emptyMap<String, String>(), Http.parseQuery(null))
  }
}

class SubtitleTest {
  @Test
  fun stripsReleaseNoise() {
    assertEquals("The Matrix 1999", OpenSubtitles.normalizeQuery("The.Matrix.1999.1080p.WEB-DL.x264"))
  }

  @Test
  fun buildsAlphabeticalSearchPaths() {
    assertEquals(
      "https://rest.opensubtitles.org/search/episode-5/query-the%20office/season-2/sublanguageid-eng,ara",
      OpenSubtitles.buildSearchUrl("the office", listOf("eng", "ara"), 2, 5),
    )
    assertEquals(
      "https://rest.opensubtitles.org/search/query-dune/sublanguageid-ara",
      OpenSubtitles.buildSearchUrl("dune", listOf("ara"), null, null),
    )
  }

  @Test
  fun convertsSubripToWebVtt() {
    val srt = "1\r\n00:00:01,500 --> 00:00:03,000\r\nHello\r\n\r\n2\r\n00:00:04,000 --> 00:00:05,000\r\nBye\r\n"
    assertEquals(
      "WEBVTT\n\n00:00:01.500 --> 00:00:03.000\nHello\n\n00:00:04.000 --> 00:00:05.000\nBye\n",
      OpenSubtitles.srtToVtt(srt),
    )
  }

  @Test
  fun dropsStylingWebVttCannotRender() {
    assertEquals("مرحبا", OpenSubtitles.cleanCueText("{\\an8}<font face=\"Sakkal Majalla\">مرحبا</font>"))
    assertEquals("<i>Hello</i>", OpenSubtitles.cleanCueText("<i>Hello</i>"))
  }

  @Test
  fun fallsBackToArabicCodepage() {
    assertEquals("ال", OpenSubtitles.decodeSubtitle(byteArrayOf(0xc7.toByte(), 0xe1.toByte()), "ara"))
    assertEquals("مرحبا", OpenSubtitles.decodeSubtitle("مرحبا".toByteArray(Charsets.UTF_8), "ara"))
  }

  @Test
  fun detectsGzip() {
    assertTrue(OpenSubtitles.looksGzipped(byteArrayOf(0x1f, 0x8b.toByte(), 0x08)))
    assertTrue(!OpenSubtitles.looksGzipped("1\n".toByteArray()))
  }
}

/** Boots the real [LocalServer] and talks to it exactly as the WebView would. */
class LocalServerTest {
  private lateinit var server: LocalServer
  private lateinit var upstream: FakeProvider
  private lateinit var assetDir: File
  private var port = 0

  @Before
  fun setUp() {
    upstream = FakeProvider()
    upstream.start(NanoHTTPD.SOCKET_READ_TIMEOUT, false)

    assetDir = File.createTempFile("vox-assets", "").let {
      it.delete()
      it.mkdirs()
      it
    }
    File(assetDir, "assets").mkdirs()
    File(assetDir, "index.html").writeText("<html><body>shell</body></html>")
    File(assetDir, "assets/app.js").writeText("console.log('app')")

    server = LocalServer({ path ->
      val file = File(assetDir, path.removePrefix("web/"))
      if (file.isFile) file.inputStream() else null
    }, 0)
    server.start(NanoHTTPD.SOCKET_READ_TIMEOUT, false)
    port = server.listeningPort
  }

  @After
  fun tearDown() {
    server.stop()
    upstream.stop()
    assetDir.deleteRecursively()
  }

  private fun get(path: String, range: String? = null): Triple<Int, String, Map<String, List<String>>> {
    val connection = URL("http://127.0.0.1:$port$path").openConnection() as HttpURLConnection
    if (range != null) connection.setRequestProperty("Range", range)
    connection.connect()
    val code = connection.responseCode
    val body = (if (code < 400) connection.inputStream else connection.errorStream)
      ?.bufferedReader()?.use { it.readText() } ?: ""
    // HttpURLConnection keeps the server's header casing; normalise it.
    val headers = connection.headerFields
      .filterKeys { it != null }
      .mapKeys { (key, _) -> key.lowercase() }
    connection.disconnect()
    return Triple(code, body, headers)
  }

  @Test
  fun servesTheAppShellAndAssets() {
    val (rootCode, rootBody, _) = get("/")
    assertEquals(200, rootCode)
    assertTrue(rootBody.contains("shell"))

    val (assetCode, assetBody, assetHeaders) = get("/assets/app.js")
    assertEquals(200, assetCode)
    assertTrue(assetBody.contains("console.log"))
    assertTrue(assetHeaders["content-type"]?.first()?.contains("javascript") == true)
  }

  @Test
  fun clientRoutesFallBackToTheShell() {
    val (code, body, _) = get("/movies")
    assertEquals(200, code)
    assertTrue(body.contains("shell"))

    val (missingCode, _, _) = get("/assets/missing.js")
    assertEquals(404, missingCode)
  }

  @Test
  fun proxiesPlaylistFetches() {
    val (code, body, _) = get("/api/iptv/fetch?u=${Http.encodeComponent(upstream.url("/playlist.m3u"))}")
    assertEquals(200, code)
    assertTrue(body.startsWith("#EXTM3U"))
    assertTrue(body.contains("Alpha News"))
  }

  @Test
  fun rewritesLivePlaylistsThroughItself() {
    val (code, body, headers) = get("/api/iptv/stream?u=${Http.encodeComponent(upstream.url("/live/1.m3u8"))}")
    assertEquals(200, code)
    assertTrue(headers["content-type"]?.first()?.contains("mpegurl") == true)
    assertTrue(body.contains("/api/iptv/stream?u=http%3A%2F%2F127.0.0.1"))
    assertTrue(body.contains("seg1.ts"))
  }

  @Test
  fun probeReportsTheStreamKind() {
    val (code, body, _) = get("/api/iptv/stream?u=${Http.encodeComponent(upstream.url("/live/1.ts"))}&probe=1")
    assertEquals(200, code)
    assertTrue(body.contains("\"kind\":\"ts\""))
    assertTrue(body.contains("\"ok\":true"))
  }

  @Test
  fun passesRangeRequestsThrough() {
    val (code, body, headers) = get("/api/iptv/stream?u=${Http.encodeComponent(upstream.url("/movie.mp4"))}", "bytes=4-9")
    assertEquals(206, code)
    assertEquals(6, body.length)
    assertTrue(headers["content-range"]?.first()?.startsWith("bytes 4-9/") == true)
  }

  @Test
  fun reportsUpstreamFailures() {
    val (code, _, _) = get("/api/iptv/stream?u=${Http.encodeComponent(upstream.url("/missing"))}")
    assertEquals(404, code)

    val (badCode, _, _) = get("/api/iptv/stream?u=nonsense")
    assertEquals(400, badCode)
  }

  /** Stands in for an IPTV provider: playlists, a TS stream and a range-able file. */
  private class FakeProvider : NanoHTTPD("127.0.0.1", 0) {
    fun url(path: String) = "http://127.0.0.1:$listeningPort$path"

    override fun serve(session: IHTTPSession): Response = when (session.uri) {
      "/playlist.m3u" -> newFixedLengthResponse(
        Response.Status.OK,
        "audio/x-mpegurl",
        "#EXTM3U\n#EXTINF:-1 group-title=\"News\",Alpha News\nhttp://127.0.0.1:1/live/1.ts\n",
      )
      "/live/1.m3u8" -> newFixedLengthResponse(
        Response.Status.OK,
        "application/vnd.apple.mpegurl",
        "#EXTM3U\n#EXTINF:6,\nseg1.ts\n",
      )
      "/live/1.ts" -> {
        val ts = ByteArray(600)
        ts[0] = 0x47; ts[188] = 0x47; ts[376] = 0x47
        newFixedLengthResponse(Response.Status.OK, "video/mp2t", ByteArrayInputStream(ts), ts.size.toLong())
      }
      "/movie.mp4" -> {
        val body = "0123456789abcdef"
        val range = session.headers["range"]
        if (range != null && range.startsWith("bytes=")) {
          val (from, to) = range.removePrefix("bytes=").split("-").let { it[0].toInt() to it[1].toInt() }
          val slice = body.substring(from, to + 1)
          newFixedLengthResponse(Response.Status.PARTIAL_CONTENT, "video/mp4", slice).apply {
            addHeader("Content-Range", "bytes $from-$to/${body.length}")
            addHeader("Accept-Ranges", "bytes")
          }
        } else {
          newFixedLengthResponse(Response.Status.OK, "video/mp4", body)
        }
      }
      else -> newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "no")
    }
  }
}
