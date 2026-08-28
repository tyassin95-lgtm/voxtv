package com.voxtv.firetv

import java.io.ByteArrayInputStream
import java.io.InputStream
import java.net.URLDecoder
import java.net.URLEncoder

/** What a handler hands back to the local server, before NanoHTTPD sees it. */
class ServerResponse private constructor(
  val status: Int,
  val mime: String,
  val stream: InputStream,
  /** -1 when the length is unknown, which sends the body chunked. */
  val length: Long,
) {
  val headers: MutableMap<String, String> = LinkedHashMap()

  fun header(name: String, value: String): ServerResponse {
    headers[name] = value
    return this
  }

  companion object {
    fun text(status: Int, body: String, mime: String): ServerResponse {
      val bytes = body.toByteArray(Charsets.UTF_8)
      val withCharset = if (mime.contains("charset")) mime else "$mime; charset=utf-8"
      return ServerResponse(status, withCharset, ByteArrayInputStream(bytes), bytes.size.toLong())
    }

    fun bytes(status: Int, body: ByteArray, mime: String): ServerResponse =
      ServerResponse(status, mime, ByteArrayInputStream(body), body.size.toLong())

    fun stream(status: Int, stream: InputStream, mime: String, length: Long): ServerResponse =
      ServerResponse(status, mime, stream, length)
  }
}

object Http {
  /** Matches `encodeURIComponent` closely enough for URLs and search terms. */
  fun encodeComponent(value: String): String =
    URLEncoder.encode(value, "UTF-8")
      .replace("+", "%20")
      .replace("%7E", "~")
      .replace("*", "%2A")

  fun decodeComponent(value: String): String = try {
    URLDecoder.decode(value, "UTF-8")
  } catch (_: Exception) {
    value
  }

  /** Query parser with `URLSearchParams` semantics (last value wins). */
  fun parseQuery(query: String?): Map<String, String> {
    if (query.isNullOrEmpty()) return emptyMap()
    val out = LinkedHashMap<String, String>()
    for (pair in query.split("&")) {
      if (pair.isEmpty()) continue
      val index = pair.indexOf('=')
      val key = if (index < 0) pair else pair.substring(0, index)
      val raw = if (index < 0) "" else pair.substring(index + 1)
      out[decodeComponent(key)] = decodeComponent(raw)
    }
    return out
  }

  fun mimeForPath(path: String): String = when {
    path.endsWith(".html") -> "text/html"
    path.endsWith(".js") || path.endsWith(".mjs") -> "text/javascript"
    path.endsWith(".css") -> "text/css"
    path.endsWith(".json") -> "application/json"
    path.endsWith(".webmanifest") -> "application/manifest+json"
    path.endsWith(".svg") -> "image/svg+xml"
    path.endsWith(".png") -> "image/png"
    path.endsWith(".jpg") || path.endsWith(".jpeg") -> "image/jpeg"
    path.endsWith(".webp") -> "image/webp"
    path.endsWith(".ico") -> "image/x-icon"
    path.endsWith(".woff2") -> "font/woff2"
    path.endsWith(".woff") -> "font/woff"
    path.endsWith(".ttf") -> "font/ttf"
    path.endsWith(".vtt") -> "text/vtt"
    path.endsWith(".map") -> "application/json"
    else -> "application/octet-stream"
  }
}

object Json {
  /** Minimal JSON string escaping — the payloads here are small and flat. */
  fun quote(value: String): String {
    val sb = StringBuilder(value.length + 2)
    sb.append('"')
    for (ch in value) {
      when (ch) {
        '"' -> sb.append("\\\"")
        '\\' -> sb.append("\\\\")
        '\n' -> sb.append("\\n")
        '\r' -> sb.append("\\r")
        '\t' -> sb.append("\\t")
        else -> if (ch < ' ') sb.append(String.format("\\u%04x", ch.code)) else sb.append(ch)
      }
    }
    sb.append('"')
    return sb.toString()
  }
}
