package com.voxtv.firetv

import android.util.Log
import fi.iki.elonen.NanoHTTPD
import fi.iki.elonen.NanoHTTPD.Response
import fi.iki.elonen.NanoHTTPD.Response.Status
import java.io.InputStream

/**
 * The app's own web server.
 *
 * The whole point is fidelity: the page is served over real HTTP from a fixed
 * origin, so the bundled build behaves exactly like the hosted one — same
 * relative `/api/iptv/...` calls, same range requests, same streaming — with no
 * hosted server in the path.
 */
class LocalServer(
  /** Opens a bundled web file, or returns null when it does not exist. */
  private val openAsset: (String) -> InputStream?,
  port: Int,
) : NanoHTTPD("127.0.0.1", port) {

  companion object {
    private const val TAG = "VoxServer"

    /**
     * Fixed on purpose: IndexedDB and localStorage are scoped to the origin,
     * port included, so a moving port would wipe the library on every launch.
     */
    const val PRIMARY_PORT = 47231
    val FALLBACK_PORTS = intArrayOf(47232, 47233, 47234, 47235)

    private const val ASSET_ROOT = "web"
  }

  override fun serve(session: IHTTPSession): Response {
    val uri = session.uri ?: "/"
    return try {
      if (session.method == Method.OPTIONS) {
        return cors(newFixedLengthResponse(Status.NO_CONTENT, null, null))
      }
      val query = Http.parseQuery(session.queryParameterString)
      val response = when (uri) {
        "/api/iptv/stream" -> serveStream(session, query)
        "/api/iptv/fetch" -> serveFetch(query)
        "/api/iptv/image" -> serveImage(query)
        "/api/iptv/subtitles" -> serveSubtitles(query)
        else -> return serveAsset(uri)
      }
      cors(toNano(response))
    } catch (err: IptvProxy.ProxyException) {
      cors(newFixedLengthResponse(Status.BAD_REQUEST, "text/plain; charset=utf-8", err.message ?: "Bad request"))
    } catch (err: Exception) {
      Log.w(TAG, "handler failed for $uri", err)
      cors(
        newFixedLengthResponse(
          Status.INTERNAL_ERROR,
          "text/plain; charset=utf-8",
          err.message ?: "Request failed",
        ),
      )
    }
  }

  // ------------------------------------------------------------------ handlers

  private fun serveStream(session: IHTTPSession, query: Map<String, String>): ServerResponse {
    if (query["release"] == "1") {
      // The player closed a stream: hand the provider its connection back now
      // instead of when the pool happens to expire.
      IptvProxy.releasePooledConnections()
      return ServerResponse.text(200, "", "text/plain")
    }
    val target = IptvProxy.decodeTargetUrl(query["u"])
    if (query["probe"] == "1") return IptvProxy.probe(target)
    val range = session.headers["range"]
    return IptvProxy.stream(target, range)
  }

  private fun serveFetch(query: Map<String, String>): ServerResponse =
    IptvProxy.fetchText(IptvProxy.decodeTargetUrl(query["u"]))

  private fun serveImage(query: Map<String, String>): ServerResponse =
    IptvProxy.image(IptvProxy.decodeTargetUrl(query["u"]))

  private fun serveSubtitles(query: Map<String, String>): ServerResponse {
    val langs = (query["lang"] ?: "eng")
      .split(",")
      .map { it.trim().lowercase() }
      .filter { OpenSubtitles.isLang(it) }
      .ifEmpty { listOf("eng") }
    if (query["action"] == "download") {
      val id = query["id"].orEmpty()
      if (id.isEmpty()) {
        return ServerResponse.text(400, """{"error":"Missing subtitle id"}""", "application/json")
      }
      return OpenSubtitles.download(id, langs.first(), query["u"])
    }
    val q = query["q"].orEmpty()
    if (q.isBlank()) return ServerResponse.text(200, """{"results":[]}""", "application/json")
    return OpenSubtitles.search(q, langs, positive(query["season"]), positive(query["episode"]))
  }

  private fun positive(raw: String?): Int? {
    val value = raw?.toIntOrNull() ?: return null
    return if (value > 0) value else null
  }

  // ------------------------------------------------------------------ static assets

  private fun serveAsset(uri: String): Response {
    val clean = uri.substringBefore('?').removePrefix("/")
    val path = if (clean.isEmpty()) "index.html" else clean
    val stream = openAsset("$ASSET_ROOT/$path")
    if (stream != null) {
      val response = newChunkedResponse(Status.OK, Http.mimeForPath(path), stream)
      // Hashed bundles never change; the shell must not be pinned.
      if (path.startsWith("assets/")) {
        response.addHeader("Cache-Control", "public, max-age=31536000, immutable")
      } else {
        response.addHeader("Cache-Control", "no-cache")
      }
      return cors(response)
    }
    // Client-side routes (/movies, /watch, …) fall back to the app shell.
    if (!path.substringAfterLast('/').contains('.')) {
      val shell = openAsset("$ASSET_ROOT/index.html")
      if (shell != null) {
        return cors(newChunkedResponse(Status.OK, "text/html", shell).also {
          it.addHeader("Cache-Control", "no-cache")
        })
      }
    }
    return cors(newFixedLengthResponse(Status.NOT_FOUND, "text/plain; charset=utf-8", "Not found"))
  }

  // ------------------------------------------------------------------ plumbing

  private fun toNano(response: ServerResponse): Response {
    val status = HttpStatus(response.status)
    val nano = if (response.length >= 0) {
      newFixedLengthResponse(status, response.mime, response.stream, response.length)
    } else {
      newChunkedResponse(status, response.mime, response.stream)
    }
    for ((name, value) in response.headers) nano.addHeader(name, value)
    return nano
  }

  private fun cors(response: Response): Response {
    response.addHeader("Access-Control-Allow-Origin", "*")
    response.addHeader("Access-Control-Allow-Headers", "Range, Content-Type")
    response.addHeader(
      "Access-Control-Expose-Headers",
      "Content-Length, Content-Range, Accept-Ranges, Content-Type, X-Stream-Format",
    )
    response.addHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
    return response
  }

  /** Lets upstream status codes through unchanged (NanoHTTPD only ships an enum). */
  private class HttpStatus(private val code: Int) : Response.IStatus {
    override fun getRequestStatus(): Int = code
    override fun getDescription(): String = "$code ${reason(code)}"

    private fun reason(code: Int): String = when (code) {
      200 -> "OK"
      204 -> "No Content"
      206 -> "Partial Content"
      301 -> "Moved Permanently"
      302 -> "Found"
      304 -> "Not Modified"
      400 -> "Bad Request"
      401 -> "Unauthorized"
      403 -> "Forbidden"
      404 -> "Not Found"
      413 -> "Payload Too Large"
      416 -> "Requested Range Not Satisfiable"
      429 -> "Too Many Requests"
      500 -> "Internal Server Error"
      502 -> "Bad Gateway"
      503 -> "Service Unavailable"
      504 -> "Gateway Timeout"
      else -> if (code < 400) "OK" else "Error"
    }
  }

  /** NanoHTTPD would gzip text responses; keep bytes exactly as produced. */
  override fun useGzipWhenAccepted(r: Response?): Boolean = false
}
