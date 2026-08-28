import { iptvLog, iptvWarn, redactUrl } from "./log";
import { looksLikePlaylistUrl, mimeForKind, sniffStreamBytes, type StreamKind } from "./stream-detect";

const API_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const STREAM_UAS = [
  "VLC/3.0.21 LibVLC/3.0.21",
  "Lavf/60.16.100",
  "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3",
  API_UA,
];

const MAX_FETCH_BYTES = 90 * 1024 * 1024;

export function decodeTargetUrl(raw: string | null): string {
  if (!raw) throw new Error("Missing url");
  let url = raw;
  if (!/^https?:\/\//i.test(url)) {
    try {
      const decoded = decodeURIComponent(raw);
      if (/^https?:\/\//i.test(decoded)) url = decoded;
    } catch {
      url = raw;
    }
  }
  if (!/^https?:\/\//i.test(url)) throw new Error("Only HTTP and HTTPS URLs are allowed");
  return url;
}

function corsHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Headers", "Range, Content-Type");
  headers.set("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges, Content-Type, X-Stream-Format");
  headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  return headers;
}

export function optionsResponse(): Response {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function resolveRef(base: string, ref: string): string {
  try {
    return new URL(ref, base).href;
  } catch {
    return ref;
  }
}

function proxyStreamPath(url: string): string {
  return `/api/iptv/stream?u=${encodeURIComponent(url)}`;
}

export function rewriteM3u8(text: string, playlistUrl: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        return line.replace(/URI=(?:"([^"]+)"|'([^']+)'|([^,\s]+))/g, (_all, d: string, s: string, u: string) => {
          const uri = d || s || u;
          if (!uri || uri.startsWith("data:")) return _all;
          return `URI="${proxyStreamPath(resolveRef(playlistUrl, uri))}"`;
        });
      }
      return proxyStreamPath(resolveRef(playlistUrl, trimmed));
    })
    .join("\n");
}

async function upstream(
  url: string,
  request: Request,
  { range = true, userAgent = API_UA }: { range?: boolean; userAgent?: string } = {},
): Promise<Response> {
  const headers = new Headers();
  headers.set("User-Agent", userAgent);
  headers.set("Accept", "*/*");
  headers.set("Accept-Encoding", "identity");
  const rangeHeader = request.headers.get("Range");
  if (range && rangeHeader) headers.set("Range", rangeHeader);
  const incomingReferer = request.headers.get("x-upstream-referer");
  if (incomingReferer) headers.set("Referer", incomingReferer);
  else {
    try {
      headers.set("Referer", new URL(url).origin + "/");
    } catch {
      /* ignore */
    }
  }

  try {
    iptvLog("proxy", "upstream", redactUrl(url), userAgent.split(" ")[0]);
    return await fetch(url, {
      method: "GET",
      headers,
      redirect: "follow",
    });
  } catch (err) {
    iptvWarn("proxy", "upstream failed", redactUrl(url), err instanceof Error ? err.message : err);
    throw new Error("Could not reach the IPTV server. Check the URL and try again.");
  }
}

async function upstreamWithUaFallback(
  url: string,
  request: Request,
  opts: { range?: boolean; stream?: boolean } = {},
): Promise<Response> {
  const agents = opts.stream ? STREAM_UAS : [API_UA];
  let last: Response | null = null;
  for (const ua of agents) {
    const res = await upstream(url, request, { range: opts.range, userAgent: ua });
    last = res;
    if (res.status === 401 || res.status === 403 || res.status === 406 || res.status === 451) {
      iptvWarn("proxy", "ua rejected", res.status, ua.split(" ")[0]);
      continue;
    }
    return res;
  }
  return last!;
}

export async function proxyFetch(url: string, request: Request): Promise<Response> {
  const res = await upstream(url, request, { range: false, userAgent: API_UA });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    iptvWarn("proxy", "fetch status", res.status, redactUrl(url));
    return new Response(body || res.statusText, {
      status: res.status,
      headers: corsHeaders({ "content-type": "text/plain; charset=utf-8" }),
    });
  }
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_FETCH_BYTES) {
    return new Response("Playlist is too large to import.", {
      status: 413,
      headers: corsHeaders({ "content-type": "text/plain; charset=utf-8" }),
    });
  }
  const type = res.headers.get("content-type") || "text/plain; charset=utf-8";
  iptvLog("proxy", "fetch ok", buf.byteLength, type);
  return new Response(buf, {
    status: 200,
    headers: corsHeaders({ "content-type": type }),
  });
}

function passthroughHeaders(res: Response, kind: StreamKind): Headers {
  const headers = corsHeaders();
  const pass = ["content-type", "content-length", "content-range", "accept-ranges", "cache-control"];
  for (const key of pass) {
    const value = res.headers.get(key);
    if (value) headers.set(key, value);
  }
  headers.set("content-type", mimeForKind(kind, res.headers.get("content-type")));
  headers.set("x-stream-format", kind);
  if (!headers.has("accept-ranges")) headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "no-store");
  return headers;
}

async function peekBody(
  res: Response,
  max = 512,
): Promise<{ kind: StreamKind; head: Uint8Array; rest: ReadableStream<Uint8Array> | null }> {
  const body = res.body;
  if (!body) {
    return { kind: "unknown", head: new Uint8Array(), rest: null };
  }
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < max) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      size += value.length;
    }
  }
  const head = concatBytes(chunks);
  const rest = new ReadableStream<Uint8Array>({
    async start(controller) {
      if (head.length) controller.enqueue(head);
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) controller.enqueue(value);
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
    cancel() {
      void reader.cancel();
    },
  });
  return { kind: sniffStreamBytes(head), head, rest };
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function errorResponse(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: corsHeaders({ "content-type": "text/plain; charset=utf-8", "x-stream-format": "unknown" }),
  });
}

export async function proxyProbe(url: string, request: Request): Promise<Response> {
  try {
    const res = await upstreamWithUaFallback(url, request, { range: false, stream: true });
    const finalUrl = res.url || url;
    const peeked = await peekBody(res, 1024);
    void peeked.rest?.cancel();
    const payload = {
      ok: res.status < 400,
      status: res.status,
      kind: peeked.kind === "unknown" && looksLikePlaylistUrl(url, res.headers.get("content-type") || "") ? "hls" : peeked.kind,
      finalUrl,
    };
    iptvLog("proxy", "probe", payload.kind, payload.status, redactUrl(finalUrl));
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: corsHeaders({ "content-type": "application/json", "x-stream-format": payload.kind }),
    });
  } catch (err) {
    iptvWarn("proxy", "probe failed", redactUrl(url), err instanceof Error ? err.message : err);
    return new Response(JSON.stringify({ ok: false, status: 0, kind: "unknown" }), {
      status: 200,
      headers: corsHeaders({ "content-type": "application/json" }),
    });
  }
}

export async function proxyStream(url: string, request: Request): Promise<Response> {
  const res = await upstreamWithUaFallback(url, request, { range: true, stream: true });
  if (res.status >= 400) {
    const message = `Upstream ${res.status}`;
    iptvWarn("proxy", "stream status", res.status, redactUrl(url));
    return errorResponse(res.status, message);
  }
  const finalUrl = res.url || url;
  const type = res.headers.get("content-type") || "";
  const playlistHint = looksLikePlaylistUrl(url, type) || looksLikePlaylistUrl(finalUrl, type);

  if (playlistHint || /octet-stream|mp2t|video\//i.test(type) || !type) {
    const peeked = await peekBody(res);
    iptvLog("proxy", "sniff", peeked.kind, redactUrl(finalUrl), type || "no-type");
    if (peeked.kind === "hls" || (playlistHint && peeked.kind === "unknown" && peeked.head.length && looksLikeExt(peeked.head))) {
      const text = await readStreamText(peeked.rest);
      const rewritten = text.trimStart().startsWith("#EXT") ? rewriteM3u8(text, finalUrl) : text;
      return new Response(rewritten, {
        status: 200,
        headers: corsHeaders({
          "content-type": "application/vnd.apple.mpegurl",
          "cache-control": "no-store",
          "x-stream-format": "hls",
        }),
      });
    }
    const headers = passthroughHeaders(res, peeked.kind === "unknown" && playlistHint ? "ts" : peeked.kind);
    return new Response(peeked.rest, {
      status: res.status,
      headers,
    });
  }

  if (/mpegurl|m3u8/i.test(type)) {
    const text = await res.text();
    const rewritten = text.trimStart().startsWith("#EXT") ? rewriteM3u8(text, finalUrl) : text;
    return new Response(rewritten, {
      status: 200,
      headers: corsHeaders({
        "content-type": "application/vnd.apple.mpegurl",
        "cache-control": "no-store",
        "x-stream-format": "hls",
      }),
    });
  }

  const headers = passthroughHeaders(res, sniffFromType(type));
  return new Response(res.body, {
    status: res.status,
    headers,
  });
}

function looksLikeExt(bytes: Uint8Array): boolean {
  try {
    return new TextDecoder().decode(bytes).trimStart().startsWith("#EXT");
  } catch {
    return false;
  }
}

function sniffFromType(type: string): StreamKind {
  if (/mpegurl|m3u8/i.test(type)) return "hls";
  if (/mp2t/i.test(type)) return "ts";
  if (/mp4/i.test(type)) return "mp4";
  if (/matroska|mkv/i.test(type)) return "mkv";
  return "unknown";
}

async function readStreamText(stream: ReadableStream<Uint8Array> | null): Promise<string> {
  if (!stream) return "";
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return new TextDecoder().decode(concatBytes(chunks));
}

export async function proxyImage(url: string, request: Request): Promise<Response> {
  const res = await upstream(url, request, { range: false });
  if (!res.ok) {
    return new Response(null, { status: res.status, headers: corsHeaders() });
  }
  const headers = corsHeaders({
    "content-type": res.headers.get("content-type") || "image/jpeg",
    "cache-control": "public, max-age=86400",
  });
  return new Response(res.body, { status: 200, headers });
}
