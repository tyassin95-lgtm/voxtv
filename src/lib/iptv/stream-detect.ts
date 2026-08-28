export type StreamKind = "hls" | "ts" | "mp4" | "mkv" | "unknown";

function looksLikeTsAligned(bytes: Uint8Array): boolean {
  const limit = Math.min(bytes.length, 2048);
  for (let i = 0; i < Math.min(bytes.length, 188); i++) {
    if (bytes[i] !== 0x47) continue;
    const next = i + 188;
    const third = i + 376;
    if (next >= limit) return true;
    if (bytes[next] === 0x47 && (third >= limit || bytes[third] === 0x47)) return true;
  }
  return false;
}

export function sniffStreamBytes(bytes: Uint8Array | Buffer): StreamKind {
  if (!bytes || bytes.length === 0) return "unknown";
  let offset = 0;
  while (
    offset < bytes.length &&
    (bytes[offset] === 0x20 || bytes[offset] === 0x0a || bytes[offset] === 0x0d || bytes[offset] === 0x09)
  ) {
    offset += 1;
  }
  const slice = bytes.subarray(offset);
  if (slice.length >= 4) {
    const head = String.fromCharCode(slice[0]!, slice[1]!, slice[2]!, slice[3]!);
    if (head.startsWith("#EXT")) return "hls";
    if (head.startsWith("ID3")) {
      const rest = slice.subarray(Math.min(slice.length, 10));
      if (looksLikeTsAligned(rest)) return "ts";
      return "unknown";
    }
  }
  if (looksLikeTsAligned(slice)) return "ts";
  if (slice.length >= 8) {
    const brand = String.fromCharCode(slice[4]!, slice[5]!, slice[6]!, slice[7]!);
    if (brand === "ftyp") return "mp4";
  }
  if (slice[0] === 0x1a && slice[1] === 0x45 && slice[2] === 0xdf) return "mkv";
  try {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(slice.subarray(0, Math.min(slice.length, 24)));
    if (text.trimStart().startsWith("#EXT")) return "hls";
  } catch {
    /* ignore */
  }
  return "unknown";
}

export function mimeForKind(kind: StreamKind, fallback?: string | null): string {
  if (kind === "hls") return "application/vnd.apple.mpegurl";
  if (kind === "ts") return "video/mp2t";
  if (kind === "mp4") return "video/mp4";
  if (kind === "mkv") return "video/x-matroska";
  return fallback || "application/octet-stream";
}

export function looksLikePlaylistUrl(url: string, contentType = ""): boolean {
  return /mpegurl|m3u8/i.test(contentType) || /\.m3u8(\?|$)/i.test(url);
}

export function engineForKind(kind: StreamKind, fallbackUrl?: string): "hls" | "mpegts" | "native" {
  if (kind === "hls") return "hls";
  if (kind === "ts") return "mpegts";
  if (kind === "mp4" || kind === "mkv") return "native";
  if (fallbackUrl && /\.m3u8(\?|$)/i.test(fallbackUrl)) return "hls";
  if (fallbackUrl && /\/live\//i.test(fallbackUrl)) return "mpegts";
  return "native";
}
