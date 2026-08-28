package com.voxtv.firetv

/**
 * Port of `src/lib/iptv/stream-detect.ts`. The player picks its engine from the
 * kind reported here, so the sniffing rules must stay byte-for-byte identical
 * to the web build.
 */
object StreamDetect {
  const val HLS = "hls"
  const val TS = "ts"
  const val MP4 = "mp4"
  const val MKV = "mkv"
  const val UNKNOWN = "unknown"

  private fun looksLikeTsAligned(bytes: ByteArray, from: Int): Boolean {
    val limit = minOf(bytes.size, from + 2048)
    var i = from
    val scanEnd = minOf(bytes.size, from + 188)
    while (i < scanEnd) {
      if (bytes[i] != 0x47.toByte()) {
        i++
        continue
      }
      val next = i + 188
      val third = i + 376
      if (next >= limit) return true
      if (bytes[next] == 0x47.toByte() && (third >= limit || bytes[third] == 0x47.toByte())) return true
      i++
    }
    return false
  }

  fun sniff(bytes: ByteArray): String {
    if (bytes.isEmpty()) return UNKNOWN
    var offset = 0
    while (offset < bytes.size) {
      val b = bytes[offset]
      if (b == 0x20.toByte() || b == 0x0a.toByte() || b == 0x0d.toByte() || b == 0x09.toByte()) {
        offset++
      } else {
        break
      }
    }
    val remaining = bytes.size - offset
    if (remaining >= 4) {
      val head = String(bytes, offset, 4, Charsets.ISO_8859_1)
      if (head.startsWith("#EXT")) return HLS
      if (head.startsWith("ID3")) {
        val skip = minOf(bytes.size, offset + 10)
        return if (looksLikeTsAligned(bytes, skip)) TS else UNKNOWN
      }
    }
    if (looksLikeTsAligned(bytes, offset)) return TS
    if (remaining >= 8) {
      val brand = String(bytes, offset + 4, 4, Charsets.ISO_8859_1)
      if (brand == "ftyp") return MP4
    }
    if (remaining >= 3 &&
      bytes[offset] == 0x1a.toByte() &&
      bytes[offset + 1] == 0x45.toByte() &&
      bytes[offset + 2] == 0xdf.toByte()
    ) {
      return MKV
    }
    val textLen = minOf(remaining, 24)
    if (textLen > 0) {
      val text = String(bytes, offset, textLen, Charsets.UTF_8).trimStart()
      if (text.startsWith("#EXT")) return HLS
    }
    return UNKNOWN
  }

  fun mimeForKind(kind: String, fallback: String?): String = when (kind) {
    HLS -> "application/vnd.apple.mpegurl"
    TS -> "video/mp2t"
    MP4 -> "video/mp4"
    MKV -> "video/x-matroska"
    else -> if (fallback.isNullOrBlank()) "application/octet-stream" else fallback
  }

  fun looksLikePlaylistUrl(url: String, contentType: String): Boolean {
    if (Regex("mpegurl|m3u8", RegexOption.IGNORE_CASE).containsMatchIn(contentType)) return true
    return Regex("\\.m3u8(\\?|$)", RegexOption.IGNORE_CASE).containsMatchIn(url)
  }
}
