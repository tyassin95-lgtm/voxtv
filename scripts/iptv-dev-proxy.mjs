/**
 * Node streaming proxy for IPTV media in Vite dev/preview.
 * TanStack Start server routes can buffer Response bodies, which breaks live
 * MPEG-TS and HLS segment piping. This middleware streams bytes directly.
 */
import http from "node:http";
import https from "node:https";
import { Buffer } from "node:buffer";

const API_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const STREAM_UAS = [
  "VLC/3.0.21 LibVLC/3.0.21",
  "Lavf/60.16.100",
  "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3",
  API_UA,
];
const MAX_FETCH_BYTES = 90 * 1024 * 1024;
const httpsAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });
const httpAgent = new http.Agent({ keepAlive: true });

function cors(extra = {}) {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "Range, Content-Type",
    "access-control-expose-headers":
      "Content-Length, Content-Range, Accept-Ranges, Content-Type, X-Stream-Format",
    "access-control-allow-methods": "GET, OPTIONS",
    ...extra,
  };
}

function decodeTarget(raw) {
  if (!raw) throw new Error("Missing url");
  let url = raw;
  if (!/^https?:\/\//i.test(url)) {
    try {
      const decoded = decodeURIComponent(raw);
      if (/^https?:\/\//i.test(decoded)) url = decoded;
    } catch {
      /* keep */
    }
  }
  if (!/^https?:\/\//i.test(url)) throw new Error("Only HTTP and HTTPS URLs are allowed");
  return url;
}

function sniff(buf) {
  if (!buf || !buf.length) return "unknown";
  let offset = 0;
  while (
    offset < buf.length &&
    (buf[offset] === 0x20 || buf[offset] === 0x0a || buf[offset] === 0x0d || buf[offset] === 0x09)
  ) {
    offset += 1;
  }
  const slice = buf.subarray(offset);
  const head = slice.subarray(0, Math.min(slice.length, 8)).toString("utf8");
  if (head.startsWith("#EXT")) return "hls";
  for (let i = 0; i < Math.min(slice.length, 188); i++) {
    if (slice[i] !== 0x47) continue;
    const next = i + 188;
    const third = i + 376;
    if (next >= slice.length || slice[next] === 0x47) {
      if (third >= slice.length || slice[third] === 0x47) return "ts";
    }
  }
  if (slice.length >= 8 && slice.toString("latin1", 4, 8) === "ftyp") return "mp4";
  if (slice[0] === 0x1a && slice[1] === 0x45 && slice[2] === 0xdf) return "mkv";
  return "unknown";
}

function mimeFor(kind, fallback) {
  if (kind === "hls") return "application/vnd.apple.mpegurl";
  if (kind === "ts") return "video/mp2t";
  if (kind === "mp4") return "video/mp4";
  if (kind === "mkv") return "video/x-matroska";
  return fallback || "application/octet-stream";
}

function resolveRef(base, ref) {
  try {
    return new URL(ref, base).href;
  } catch {
    return ref;
  }
}

function proxyStreamPath(url) {
  return `/api/iptv/stream?u=${encodeURIComponent(url)}`;
}

export function rewriteM3u8(text, playlistUrl) {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        return line.replace(/URI=(?:"([^"]+)"|'([^']+)'|([^,\s]+))/g, (all, d, s, u) => {
          const uri = d || s || u;
          if (!uri || uri.startsWith("data:")) return all;
          return `URI="${proxyStreamPath(resolveRef(playlistUrl, uri))}"`;
        });
      }
      return proxyStreamPath(resolveRef(playlistUrl, trimmed));
    })
    .join("\n");
}

function follow(url, headers, redirects = 5, timeoutMs = 0) {
  return new Promise((resolve, reject) => {
    const go = (current, left) => {
      let parsed;
      try {
        parsed = new URL(current);
      } catch (err) {
        reject(err);
        return;
      }
      const isHttps = parsed.protocol === "https:";
      const lib = isHttps ? https : http;
      const req = lib.request(
        {
          protocol: parsed.protocol,
          hostname: parsed.hostname,
          port: parsed.port || (isHttps ? 443 : 80),
          path: `${parsed.pathname}${parsed.search}`,
          method: "GET",
          headers,
          agent: isHttps ? httpsAgent : httpAgent,
          rejectUnauthorized: false,
        },
        (res) => {
          const loc = res.headers.location;
          const code = res.statusCode || 0;
          if (code >= 300 && code < 400 && loc && left > 0) {
            res.resume();
            go(new URL(loc, current).href, left - 1);
            return;
          }
          resolve({ res, finalUrl: current });
        },
      );
      req.on("error", reject);
      if (timeoutMs > 0) {
        req.setTimeout(timeoutMs, () => {
          req.destroy(new Error("Upstream timeout"));
        });
      }
      req.end();
    };
    go(url, redirects);
  });
}

function peek(res) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    const onData = (chunk) => {
      chunks.push(chunk);
      size += chunk.length;
      if (size >= 188) {
        cleanup();
        res.pause();
        resolve(Buffer.concat(chunks));
      }
    };
    const onEnd = () => {
      cleanup();
      resolve(Buffer.concat(chunks));
    };
    const onErr = (err) => {
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      res.off("data", onData);
      res.off("end", onEnd);
      res.off("error", onErr);
    };
    res.on("data", onData);
    res.on("end", onEnd);
    res.on("error", onErr);
    res.resume();
  });
}

function readRest(res, head) {
  return new Promise((resolve, reject) => {
    const chunks = [head];
    res.on("data", (c) => chunks.push(c));
    res.on("end", () => resolve(Buffer.concat(chunks)));
    res.on("error", reject);
    res.resume();
  });
}

function copyUpstreamHeaders(res, kind) {
  const headers = cors({
    "content-type": mimeFor(kind, res.headers["content-type"]),
    "cache-control": "no-store",
    "x-stream-format": kind,
  });
  for (const key of ["content-length", "content-range", "accept-ranges"]) {
    if (res.headers[key]) headers[key] = res.headers[key];
  }
  if (!headers["accept-ranges"]) headers["accept-ranges"] = "bytes";
  return headers;
}

function streamHeaders(target, ua, req) {
  const headers = {
    "user-agent": ua,
    accept: "*/*",
    "accept-encoding": "identity",
    connection: "keep-alive",
  };
  if (req?.headers?.range) headers.range = req.headers.range;
  try {
    headers.referer = `${new URL(target).origin}/`;
  } catch {
    /* ignore */
  }
  return headers;
}

async function followStream(target, req) {
  let last = null;
  for (const ua of STREAM_UAS) {
    const result = await follow(target, streamHeaders(target, ua, req));
    last = result;
    const code = result.res.statusCode || 0;
    if (code === 401 || code === 403 || code === 406 || code === 451) {
      result.res.resume();
      continue;
    }
    return result;
  }
  return last;
}

async function handleProbe(target, req, res) {
  try {
    const { res: up, finalUrl } = await followStream(target, req);
    const head = await peek(up);
    const kind = sniff(head);
    up.destroy();
    const status = up.statusCode || 0;
    const payload = JSON.stringify({
      ok: status < 400,
      status,
      kind: kind === "unknown" && /\.m3u8(\?|$)/i.test(target) ? "hls" : kind,
      finalUrl,
    });
    res.writeHead(200, cors({ "content-type": "application/json", "x-stream-format": kind }));
    res.end(payload);
  } catch (err) {
    res.writeHead(200, cors({ "content-type": "application/json" }));
    res.end(JSON.stringify({ ok: false, status: 0, kind: "unknown", error: err instanceof Error ? err.message : "probe failed" }));
  }
}

async function handleStream(target, req, res) {
  const { res: up, finalUrl } = await followStream(target, req);
  const status = up.statusCode || 200;
  if (status >= 400) {
    up.resume();
    res.writeHead(status, cors({ "content-type": "text/plain; charset=utf-8", "x-stream-format": "unknown" }));
    res.end(`Upstream ${status}`);
    return;
  }
  const type = String(up.headers["content-type"] || "");
  const playlistHint = /mpegurl|m3u8/i.test(type) || /\.m3u8(\?|$)/i.test(target) || /\.m3u8(\?|$)/i.test(finalUrl);
  const head = await peek(up);
  const kind = sniff(head);
  if (kind === "hls" || (playlistHint && head.toString("utf8").trimStart().startsWith("#EXT"))) {
    const buf = await readRest(up, head);
    const text = buf.toString("utf8");
    const rewritten = text.trimStart().startsWith("#EXT") ? rewriteM3u8(text, finalUrl) : text;
    res.writeHead(200, cors({
      "content-type": "application/vnd.apple.mpegurl",
      "cache-control": "no-store",
      "x-stream-format": "hls",
    }));
    res.end(rewritten);
    return;
  }
  const outKind = kind === "unknown" && playlistHint ? "ts" : kind;
  res.writeHead(status, copyUpstreamHeaders(up, outKind));
  res.write(head);
  up.pipe(res);
}

async function handleFetch(target, res) {
  const headers = {
    "user-agent": API_UA,
    accept: "*/*",
    "accept-encoding": "identity",
  };
  const { res: up } = await follow(target, headers, 5, 90000);
  const chunks = [];
  let size = 0;
  await new Promise((resolve, reject) => {
    up.on("data", (c) => {
      size += c.length;
      if (size > MAX_FETCH_BYTES) {
        up.destroy();
        reject(new Error("too large"));
        return;
      }
      chunks.push(c);
    });
    up.on("end", resolve);
    up.on("error", reject);
  });
  const buf = Buffer.concat(chunks);
  if ((up.statusCode || 200) >= 400) {
    res.writeHead(up.statusCode || 502, cors({ "content-type": "text/plain; charset=utf-8" }));
    res.end(buf.length ? buf : Buffer.from(up.statusMessage || "error"));
    return;
  }
  res.writeHead(200, cors({ "content-type": up.headers["content-type"] || "text/plain; charset=utf-8" }));
  res.end(buf);
}

async function handleImage(target, res) {
  const headers = { "user-agent": API_UA, accept: "image/*,*/*" };
  const { res: up } = await follow(target, headers);
  res.writeHead(up.statusCode || 200, cors({
    "content-type": up.headers["content-type"] || "image/jpeg",
    "cache-control": "public, max-age=86400",
  }));
  up.pipe(res);
}

function attach(server) {
  server.middlewares.use(async (req, res, next) => {
    const rawUrl = req.url || "";
    const pathOnly = rawUrl.split("?", 1)[0] || "";
    if (
      pathOnly !== "/api/iptv/stream" &&
      pathOnly !== "/api/iptv/fetch" &&
      pathOnly !== "/api/iptv/image"
    ) {
      next();
      return;
    }
    if ((req.method || "GET").toUpperCase() === "OPTIONS") {
      res.writeHead(204, cors());
      res.end();
      return;
    }
    try {
      const parsed = new URL(rawUrl, "http://127.0.0.1");
      const target = decodeTarget(parsed.searchParams.get("u"));
      if (pathOnly === "/api/iptv/fetch") await handleFetch(target, res);
      else if (pathOnly === "/api/iptv/image") await handleImage(target, res);
      else if (parsed.searchParams.get("probe") === "1") await handleProbe(target, req, res);
      else await handleStream(target, req, res);
    } catch (err) {
      if (res.headersSent) {
        res.end();
        return;
      }
      res.writeHead(400, cors({ "content-type": "text/plain; charset=utf-8" }));
      res.end(err instanceof Error ? err.message : "Proxy failed");
    }
  });
}

export function iptvDevProxyPlugin() {
  return {
    name: "iptv-dev-proxy",
    configureServer: attach,
    configurePreviewServer: attach,
  };
}
