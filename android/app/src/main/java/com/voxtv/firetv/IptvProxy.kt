package com.voxtv.firetv

import java.io.ByteArrayInputStream
import java.io.FilterInputStream
import java.io.IOException
import java.io.InputStream
import java.io.SequenceInputStream
import java.net.URI
import java.util.concurrent.TimeUnit
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response

/**
 * Port of `src/lib/iptv/server-proxy.ts`.
 *
 * On the web this runs on the server because a browser cannot set a User-Agent,
 * follow the provider's redirects or read a cross-origin response. In the app it
 * runs here, which also means the video never makes a detour through a hosted
 * server: the stick talks to the provider directly.
 */
object IptvProxy {
  private const val API_UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

  private val STREAM_UAS = listOf(
    "VLC/3.0.21 LibVLC/3.0.21",
    "Lavf/60.16.100",
    "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3",
    API_UA,
  )

  private const val MAX_FETCH_BYTES = 90L * 1024 * 1024

  /** No read/call timeout: a live stream is one very long response. */
  val client: OkHttpClient = OkHttpClient.Builder()
    .connectTimeout(20, TimeUnit.SECONDS)
    .readTimeout(0, TimeUnit.MILLISECONDS)
    .writeTimeout(0, TimeUnit.MILLISECONDS)
    .callTimeout(0, TimeUnit.MILLISECONDS)
    .followRedirects(true)
    .followSslRedirects(true)
    .retryOnConnectionFailure(true)
    .build()

  class ProxyException(message: String) : Exception(message)

  /** Drops idle upstream sockets so a capped account is not held hostage. */
  fun releasePooledConnections() {
    runCatching { client.connectionPool.evictAll() }
  }

  fun decodeTargetUrl(raw: String?): String {
    if (raw.isNullOrBlank()) throw ProxyException("Missing url")
    var url = raw
    if (!url.matches(Regex("^https?://.*", RegexOption.IGNORE_CASE))) {
      val decoded = Http.decodeComponent(raw)
      if (decoded.matches(Regex("^https?://.*", RegexOption.IGNORE_CASE))) url = decoded
    }
    if (!url.matches(Regex("^https?://.*", RegexOption.IGNORE_CASE))) {
      throw ProxyException("Only HTTP and HTTPS URLs are allowed")
    }
    return url
  }

  private fun upstream(url: String, userAgent: String, range: String?, referer: String?): Response {
    val builder = Request.Builder()
      .url(url)
      .header("User-Agent", userAgent)
      .header("Accept", "*/*")
      .header("Accept-Encoding", "identity")
    if (!range.isNullOrBlank()) builder.header("Range", range)
    val ref = referer ?: try {
      val uri = URI(url)
      "${uri.scheme}://${uri.authority}/"
    } catch (_: Exception) {
      null
    }
    if (ref != null) builder.header("Referer", ref)
    try {
      return client.newCall(builder.build()).execute()
    } catch (err: IOException) {
      throw ProxyException("Could not reach the IPTV server. Check the URL and try again.")
    }
  }

  /**
   * Some providers answer 401/403 for anything that does not look like a set-top
   * box, so the same request is retried under a short list of player agents.
   */
  private fun upstreamWithUaFallback(url: String, range: String?, stream: Boolean): Response {
    val agents = if (stream) STREAM_UAS else listOf(API_UA)
    var last: Response? = null
    for (ua in agents) {
      val res = upstream(url, ua, range, null)
      last = res
      if (res.code == 401 || res.code == 403 || res.code == 406 || res.code == 451) {
        res.close()
        continue
      }
      return res
    }
    return last!!
  }

  // ---------------------------------------------------------------- /api/iptv/fetch

  fun fetchText(url: String): ServerResponse {
    val res = upstream(url, API_UA, null, null)
    res.use {
      val type = it.header("Content-Type") ?: "text/plain; charset=utf-8"
      if (!it.isSuccessful) {
        val body = runCatching { it.body?.string() ?: "" }.getOrDefault("")
        return ServerResponse.text(it.code, body.ifBlank { it.message }, "text/plain; charset=utf-8")
      }
      val bytes = it.body?.bytes() ?: ByteArray(0)
      if (bytes.size > MAX_FETCH_BYTES) {
        return ServerResponse.text(413, "Playlist is too large to import.", "text/plain; charset=utf-8")
      }
      return ServerResponse.bytes(200, bytes, type)
    }
  }

  // ---------------------------------------------------------------- /api/iptv/image

  fun image(url: String): ServerResponse {
    val res = upstream(url, API_UA, null, null)
    if (!res.isSuccessful) {
      res.close()
      return ServerResponse.bytes(res.code, ByteArray(0), "image/jpeg")
    }
    val type = res.header("Content-Type") ?: "image/jpeg"
    val length = res.body?.contentLength() ?: -1L
    return ServerResponse.stream(200, bodyStream(res), type, length)
      .header("Cache-Control", "public, max-age=86400")
  }

  // ---------------------------------------------------------------- /api/iptv/stream?probe=1

  fun probe(url: String): ServerResponse {
    return try {
      val res = upstreamWithUaFallback(url, null, stream = true)
      val finalUrl = res.request.url.toString()
      val head = peek(res, 1024)
      var kind = StreamDetect.sniff(head)
      if (kind == StreamDetect.UNKNOWN &&
        StreamDetect.looksLikePlaylistUrl(url, res.header("Content-Type") ?: "")
      ) {
        kind = StreamDetect.HLS
      }
      val ok = res.code < 400
      val code = res.code
      res.close()
      ServerResponse.text(
        200,
        """{"ok":$ok,"status":$code,"kind":"$kind","finalUrl":${Json.quote(finalUrl)}}""",
        "application/json",
      )
    } catch (err: Exception) {
      ServerResponse.text(200, """{"ok":false,"status":0,"kind":"unknown"}""", "application/json")
    }
  }

  // ---------------------------------------------------------------- /api/iptv/stream

  fun stream(url: String, range: String?): ServerResponse {
    val res = upstreamWithUaFallback(url, range, stream = true)
    if (res.code >= 400) {
      val code = res.code
      res.close()
      return ServerResponse.text(code, "Upstream $code", "text/plain; charset=utf-8")
        .header("X-Stream-Format", StreamDetect.UNKNOWN)
    }
    val finalUrl = res.request.url.toString()
    val type = res.header("Content-Type") ?: ""
    val playlistHint = StreamDetect.looksLikePlaylistUrl(url, type) ||
      StreamDetect.looksLikePlaylistUrl(finalUrl, type)

    if (playlistHint || Regex("octet-stream|mp2t|video/", RegexOption.IGNORE_CASE).containsMatchIn(type) || type.isBlank()) {
      val head = peek(res, 512)
      val kind = StreamDetect.sniff(head)
      if (kind == StreamDetect.HLS || (playlistHint && kind == StreamDetect.UNKNOWN && head.isNotEmpty() && looksLikeExt(head))) {
        val rest = runCatching { res.body?.byteStream()?.readBytes() ?: ByteArray(0) }.getOrDefault(ByteArray(0))
        res.close()
        val text = String(head + rest, Charsets.UTF_8)
        val body = if (text.trimStart().startsWith("#EXT")) rewriteM3u8(text, finalUrl) else text
        return ServerResponse.text(200, body, "application/vnd.apple.mpegurl")
          .header("X-Stream-Format", StreamDetect.HLS)
      }
      val resolved = if (kind == StreamDetect.UNKNOWN && playlistHint) StreamDetect.TS else kind
      return passthrough(res, joinHead(head, res), resolved)
    }

    return passthrough(res, bodyStream(res), sniffFromType(type))
  }

  private fun passthrough(res: Response, body: InputStream, kind: String): ServerResponse {
    val length = if (res.header("Content-Length") != null) res.body?.contentLength() ?: -1L else -1L
    val status = if (res.code == 206) 206 else 200
    val out = ServerResponse.stream(status, body, StreamDetect.mimeForKind(kind, res.header("Content-Type")), length)
      .header("X-Stream-Format", kind)
      .header("Cache-Control", "no-store")
      .header("Accept-Ranges", res.header("Accept-Ranges") ?: "bytes")
    res.header("Content-Range")?.let { out.header("Content-Range", it) }
    return out
  }

  private fun sniffFromType(type: String): String = when {
    Regex("mpegurl|m3u8", RegexOption.IGNORE_CASE).containsMatchIn(type) -> StreamDetect.HLS
    Regex("mp2t", RegexOption.IGNORE_CASE).containsMatchIn(type) -> StreamDetect.TS
    Regex("mp4", RegexOption.IGNORE_CASE).containsMatchIn(type) -> StreamDetect.MP4
    Regex("matroska|mkv", RegexOption.IGNORE_CASE).containsMatchIn(type) -> StreamDetect.MKV
    else -> StreamDetect.UNKNOWN
  }

  private fun looksLikeExt(head: ByteArray): Boolean =
    String(head, Charsets.UTF_8).trimStart().startsWith("#EXT")

  /**
   * Rewrites every segment/variant reference onto this server, exactly like the
   * web build, so relative URLs keep resolving against the provider's host.
   */
  fun rewriteM3u8(text: String, playlistUrl: String): String {
    val uriAttr = Regex("URI=(?:\"([^\"]+)\"|'([^']+)'|([^,\\s]+))")
    return text.split(Regex("\r?\n")).joinToString("\n") { line ->
      val trimmed = line.trim()
      when {
        trimmed.isEmpty() -> line
        trimmed.startsWith("#") -> uriAttr.replace(line) { match ->
          val uri = match.groupValues[1].ifEmpty { match.groupValues[2].ifEmpty { match.groupValues[3] } }
          if (uri.isEmpty() || uri.startsWith("data:")) match.value
          else "URI=\"${proxyStreamPath(resolveRef(playlistUrl, uri))}\""
        }
        else -> proxyStreamPath(resolveRef(playlistUrl, trimmed))
      }
    }
  }

  private fun proxyStreamPath(url: String): String = "/api/iptv/stream?u=${Http.encodeComponent(url)}"

  private fun resolveRef(base: String, ref: String): String = try {
    URI(base).resolve(ref).toString()
  } catch (_: Exception) {
    ref
  }

  // ---------------------------------------------------------------- helpers

  /** Reads the first bytes of a response without losing them for the client. */
  private fun peek(res: Response, max: Int): ByteArray {
    val source = res.body?.byteStream() ?: return ByteArray(0)
    val buffer = ByteArray(max)
    var read = 0
    try {
      while (read < max) {
        val n = source.read(buffer, read, max - read)
        if (n <= 0) break
        read += n
      }
    } catch (_: IOException) {
      // fall through with whatever arrived
    }
    return buffer.copyOf(read)
  }

  private fun joinHead(head: ByteArray, res: Response): InputStream =
    SequenceInputStream(ByteArrayInputStream(head), bodyStream(res))

  /** Keeps the OkHttp response alive for as long as the body is being read. */
  private fun bodyStream(res: Response): InputStream {
    val body = res.body ?: return ByteArrayInputStream(ByteArray(0))
    return object : FilterInputStream(body.byteStream()) {
      override fun close() {
        try {
          super.close()
        } finally {
          res.close()
        }
      }
    }
  }
}
