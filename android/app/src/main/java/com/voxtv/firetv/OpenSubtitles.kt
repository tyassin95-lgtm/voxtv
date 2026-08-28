package com.voxtv.firetv

import android.util.Log
import java.io.ByteArrayInputStream
import java.io.InterruptedIOException
import java.nio.ByteBuffer
import java.nio.charset.Charset
import java.nio.charset.CodingErrorAction
import java.net.ConnectException
import java.net.UnknownHostException
import java.util.concurrent.TimeUnit
import java.util.zip.GZIPInputStream
import javax.net.ssl.SSLException
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject

/**
 * Port of `src/lib/iptv/opensubtitles.ts`. Same endpoints, same filtering and
 * the same SubRip → WebVTT conversion, so the subtitle sheet behaves exactly as
 * it does in the browser build.
 */
object OpenSubtitles {
  private const val SEARCH_HOST = "https://rest.opensubtitles.org/search"
  private const val OS_USER_AGENT = "TemporaryUserAgent"
  private const val MAX_RESULTS = 12
  private const val MAX_SUBTITLE_BYTES = 2 * 1024 * 1024
  private const val TAG = "VoxSubs"

  /**
   * Subtitles get their own client: the streaming one deliberately has no
   * timeouts, so a stalled lookup used to hang until the socket died rather
   * than telling the user anything.
   */
  private val http: OkHttpClient by lazy {
    IptvProxy.client.newBuilder()
      .connectTimeout(10, TimeUnit.SECONDS)
      .readTimeout(20, TimeUnit.SECONDS)
      .callTimeout(25, TimeUnit.SECONDS)
      .build()
  }

  /** What actually went wrong, so the sheet can say something useful. */
  private data class Failure(val code: String, val message: String, val retryable: Boolean)

  private fun classify(err: Exception): Failure = when (err) {
    is UnknownHostException -> Failure(
      "offline",
      "No internet connection, or opensubtitles.org could not be resolved.",
      true,
    )
    is ConnectException -> Failure(
      "unreachable",
      "opensubtitles.org refused the connection. It may be down — try again shortly.",
      true,
    )
    is SSLException -> Failure(
      "tls",
      "The secure connection to opensubtitles.org failed. Check the device date and time.",
      false,
    )
    is InterruptedIOException -> Failure(
      "timeout",
      "opensubtitles.org took too long to answer. Try again.",
      true,
    )
    else -> Failure("network", "Could not reach OpenSubtitles: ${err.javaClass.simpleName}.", true)
  }

  private fun statusFailure(code: Int): Failure = when (code) {
    401, 403 -> Failure("rejected", "OpenSubtitles rejected the request (${code}).", false)
    429 -> Failure("rate-limited", "OpenSubtitles is rate limiting requests. Try again in a minute.", true)
    in 500..599 -> Failure("server", "OpenSubtitles is having trouble (${code}). Try again shortly.", true)
    else -> Failure("http", "OpenSubtitles search failed (${code}).", code != 404)
  }

  private fun errorBody(failure: Failure): ServerResponse = ServerResponse.text(
    502,
    """{"error":${Json.quote(failure.message)},"code":${Json.quote(failure.code)},"retryable":${failure.retryable}}""",
    "application/json",
  )

  private val NOISE = Regex(
    "\\b(1080p|720p|480p|2160p|4k|uhd|hdr|web-?dl|webrip|bluray|brrip|hdrip|dvdrip|x264|x265|h264|h265|hevc|aac|ac3|dts|hdtv|multi|dual|sub|vo?stfr)\\b",
    RegexOption.IGNORE_CASE,
  )

  fun normalizeQuery(raw: String): String =
    raw
      .replace(Regex("\\.(mkv|mp4|avi|ts|m3u8)$", RegexOption.IGNORE_CASE), "")
      .replace(NOISE, " ")
      .replace(Regex("[\\[\\]()_.\\-–—:|]+"), " ")
      .replace(Regex("\\s+"), " ")
      .trim()
      .take(120)

  fun isLang(value: String): Boolean = value == "eng" || value == "ara"

  fun langLabel(lang: String): String = if (lang == "ara") "العربية" else "English"

  fun buildSearchUrl(query: String, langs: List<String>, season: Int?, episode: Int?): String {
    val segments = ArrayList<String>()
    if (episode != null && episode > 0) segments.add("episode-$episode")
    segments.add("query-${Http.encodeComponent(query)}")
    if (season != null && season > 0) segments.add("season-$season")
    val wanted = if (langs.isEmpty()) listOf("eng") else langs.distinct()
    segments.add("sublanguageid-${wanted.joinToString(",")}")
    return "$SEARCH_HOST/${segments.joinToString("/")}"
  }

  private fun request(url: String, accept: String): okhttp3.Response {
    val req = Request.Builder()
      .url(url)
      .header("X-User-Agent", OS_USER_AGENT)
      .header("User-Agent", OS_USER_AGENT)
      .header("Accept", accept)
      .build()
    // No explicit Accept-Encoding: OkHttp then negotiates gzip and unwraps the
    // body itself. Setting it by hand hands back compressed bytes.
    return http.newCall(req).execute()
  }

  /** One retry, because the legacy endpoint drops connections fairly often. */
  private fun requestWithRetry(url: String, accept: String): Result<okhttp3.Response> {
    var last: Exception? = null
    for (attempt in 0 until 2) {
      try {
        return Result.success(request(url, accept))
      } catch (err: Exception) {
        last = err
        Log.w(TAG, "attempt ${attempt + 1} failed for ${url.substringBefore("?")}", err)
        if (err is SSLException) break
        try {
          Thread.sleep(400)
        } catch (_: InterruptedException) {
          Thread.currentThread().interrupt()
          break
        }
      }
    }
    return Result.failure(last ?: Exception("unknown"))
  }

  fun search(query: String, langs: List<String>, season: Int?, episode: Int?): ServerResponse {
    val normalized = normalizeQuery(query)
    if (normalized.isEmpty()) return ServerResponse.text(200, """{"results":[]}""", "application/json")
    val url = buildSearchUrl(normalized, langs, season, episode)
    val attempt = requestWithRetry(url, "application/json")
    val response = attempt.getOrElse { err ->
      return errorBody(classify(err as? Exception ?: Exception(err)))
    }
    val body: String
    response.use { res ->
      if (!res.isSuccessful) {
        Log.w(TAG, "search http ${res.code}")
        return errorBody(statusFailure(res.code))
      }
      body = runCatching { res.body?.string() ?: "" }.getOrDefault("")
    }
    if (body.isBlank()) {
      // The legacy endpoint answers 200 with an empty body when it finds nothing.
      return ServerResponse.text(200, """{"results":[]}""", "application/json")
    }
    val results = runCatching { parseResults(body, langs) }.getOrNull()
      ?: return errorBody(
        Failure("invalid", "OpenSubtitles returned something this app could not read.", true),
      )
    Log.i(TAG, "search ok")
    return ServerResponse.text(200, """{"results":$results}""", "application/json")
  }

  /** Throws on a payload that is not the array the endpoint promises. */
  private fun parseResults(payload: String, langs: List<String>): String {
    val rows = JSONArray(payload)
    val wanted = langs.toSet()
    val buckets = LinkedHashMap<String, MutableList<JSONObject>>()
    for (i in 0 until rows.length()) {
      val row = rows.optJSONObject(i) ?: continue
      val lang = row.optString("SubLanguageID").lowercase()
      val id = row.optString("IDSubtitleFile")
      if (id.isEmpty() || !isLang(lang) || !wanted.contains(lang)) continue
      val format = row.optString("SubFormat", "srt").lowercase()
      if (format != "srt" && format != "vtt") continue
      val release = row.optString("MovieReleaseName")
      val name = listOf(row.optString("SubFileName"), release, row.optString("MovieName"))
        .firstOrNull { it.isNotEmpty() } ?: "Subtitle $id"
      val hit = JSONObject()
        .put("id", id)
        .put("name", name)
        .put("lang", lang)
        .put("langLabel", langLabel(lang))
        .put("format", format)
        .put("downloads", row.optString("SubDownloadsCnt", "0").toIntOrNull() ?: 0)
        .put("rating", row.optString("SubRating", "0").toDoubleOrNull() ?: 0.0)
        .put("downloadUrl", row.optString("SubDownloadLink"))
      if (release.isNotEmpty()) hit.put("release", release)
      buckets.getOrPut(lang) { ArrayList() }.add(hit)
    }
    val sorted = buckets.values.map { bucket ->
      bucket.sortedWith(
        compareByDescending<JSONObject> { it.optInt("downloads") }.thenByDescending { it.optDouble("rating") },
      )
    }
    val ordered = JSONArray()
    var index = 0
    while (ordered.length() < MAX_RESULTS) {
      var added = false
      for (bucket in sorted) {
        if (index >= bucket.size) continue
        ordered.put(bucket[index])
        added = true
        if (ordered.length() >= MAX_RESULTS) break
      }
      if (!added) break
      index++
    }
    return ordered.toString()
  }

  private fun isOpenSubtitlesUrl(url: String): Boolean = try {
    val host = java.net.URI(url).host?.lowercase() ?: ""
    host == "opensubtitles.org" || host.endsWith(".opensubtitles.org")
  } catch (_: Exception) {
    false
  }

  fun download(id: String, lang: String, url: String?): ServerResponse {
    val candidates = ArrayList<String>()
    if (!url.isNullOrBlank() && isOpenSubtitlesUrl(url)) candidates.add(url)
    candidates.add("https://dl.opensubtitles.org/en/download/subencoding-utf8/file/${Http.encodeComponent(id)}")

    var lastFailure = Failure("download", "Could not download that subtitle.", true)
    for (candidate in candidates) {
      try {
        request(candidate, "*/*").use { res ->
          if (!res.isSuccessful) {
            lastFailure = statusFailure(res.code)
            return@use
          }
          val raw = res.body?.bytes() ?: ByteArray(0)
          if (raw.size > MAX_SUBTITLE_BYTES) {
            lastFailure = Failure("too-large", "That subtitle file is too large.", false)
            return@use
          }
          val bytes = if (looksGzipped(raw)) gunzip(raw) else raw
          val vtt = srtToVtt(decodeSubtitle(bytes, lang))
          if (!vtt.contains("-->")) {
            lastFailure = Failure("invalid", "That subtitle file could not be read.", false)
            return@use
          }
          return ServerResponse.text(200, vtt, "text/vtt")
        }
      } catch (err: Exception) {
        Log.w(TAG, "download failed", err)
        lastFailure = classify(err)
      }
    }
    return errorBody(lastFailure)
  }

  fun looksGzipped(bytes: ByteArray): Boolean =
    bytes.size > 2 && bytes[0] == 0x1f.toByte() && bytes[1] == 0x8b.toByte()

  private fun gunzip(bytes: ByteArray): ByteArray =
    GZIPInputStream(ByteArrayInputStream(bytes)).use { it.readBytes() }

  /** UTF-8 when it decodes cleanly, otherwise the usual Latin/Arabic codepages. */
  fun decodeSubtitle(bytes: ByteArray, lang: String): String {
    val strict = Charsets.UTF_8.newDecoder()
      .onMalformedInput(CodingErrorAction.REPORT)
      .onUnmappableCharacter(CodingErrorAction.REPORT)
    try {
      return strict.decode(ByteBuffer.wrap(bytes)).toString()
    } catch (_: Exception) {
      // not valid UTF-8 — fall through to the legacy codepages
    }
    val fallback = if (lang == "ara") "windows-1256" else "windows-1252"
    return try {
      String(bytes, Charset.forName(fallback))
    } catch (_: Exception) {
      String(bytes, Charsets.UTF_8)
    }
  }

  /** Drops SSA/ASS override blocks and <font> tags WebVTT cannot render. */
  fun cleanCueText(text: String): String =
    text
      .replace(Regex("\\{\\\\[^}]*\\}"), "")
      .replace(Regex("</?font[^>]*>", RegexOption.IGNORE_CASE), "")
      .lines().joinToString("\n") { it.trimEnd() }
      .trim()

  fun srtToVtt(input: String): String {
    val text = input.removePrefix("﻿").replace(Regex("\r\n?"), "\n").trim()
    if (text.isEmpty()) return "WEBVTT\n\n"
    val body = if (text.startsWith("WEBVTT")) text.substring(6).trimStart() else text
    val cues = ArrayList<String>()
    for (block in body.split(Regex("\n{2,}"))) {
      val lines = block.split("\n").filter { it.isNotBlank() }
      if (lines.isEmpty()) continue
      var index = 0
      if (lines[0].trim().matches(Regex("^\\d+$")) && lines.size > 1 && lines[1].contains("-->")) index = 1
      val timing = lines.getOrNull(index) ?: continue
      if (!timing.contains("-->")) continue
      val parts = timing.split("-->")
      if (parts.size < 2) continue
      val start = parts[0].trim().replace(',', '.')
      val end = parts[1].trim().split(Regex("\\s+")).firstOrNull()?.replace(',', '.') ?: continue
      val payload = cleanCueText(lines.drop(index + 1).joinToString("\n"))
      if (payload.isEmpty()) continue
      cues.add("$start --> $end\n$payload")
    }
    return "WEBVTT\n\n${cues.joinToString("\n\n")}\n"
  }
}
