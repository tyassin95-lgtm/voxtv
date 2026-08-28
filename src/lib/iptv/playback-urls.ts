import type { PlayableKind, XtreamCredentials } from "./types.ts";

export type Engine = "hls" | "mpegts" | "native";

export function looksHls(url: string): boolean {
  return /\.m3u8(\?|$)/i.test(url) || /[?&]type=m3u8\b/i.test(url) || /format=m3u8/i.test(url);
}

export function looksTs(url: string): boolean {
  return /\.ts(\?|$)/i.test(url) && !/\.m3u8/i.test(url);
}

export function looksNative(url: string): boolean {
  return /\.(mp4|webm|ogg|mov|m4v|mp3|aac|mkv|avi)(\?|$)/i.test(url);
}

export function unwrapProxiedUrl(url: string): string {
  try {
    const parsed = new URL(url, "http://local.invalid");
    const target = parsed.searchParams.get("u");
    if (target && /^https?:\/\//i.test(target)) return target;
  } catch {
    /* ignore */
  }
  const match = url.match(/[?&]u=([^&]+)/);
  if (match?.[1]) {
    try {
      const decoded = decodeURIComponent(match[1]);
      if (/^https?:\/\//i.test(decoded)) return decoded;
    } catch {
      /* ignore */
    }
  }
  return url;
}

export function pickEngine(url: string): Engine {
  const raw = unwrapProxiedUrl(url);
  if (looksHls(raw)) return "hls";
  if (looksNative(raw)) return "native";
  if (looksTs(raw)) return "mpegts";
  if (/\/live\//i.test(raw) || /\/(?:live|timeshift)\.php/i.test(raw)) return "mpegts";
  return "native";
}

function unique(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function pathSafe(value: string): boolean {
  return value.length > 0 && !/[/?#]/.test(value);
}

export function credentialPathPairs(username: string, password: string): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  const add = (user: string, pass: string) => {
    if (!pathSafe(user) || !pathSafe(pass)) return;
    const key = `${user}\0${pass}`;
    if (pairs.some(([u, p]) => `${u}\0${p}` === key)) return;
    pairs.push([user, pass]);
  };
  add(username, password);
  try {
    const decodedUser = decodeURIComponent(username);
    const decodedPass = decodeURIComponent(password);
    add(decodedUser, decodedPass);
    add(encodeURIComponent(decodedUser), encodeURIComponent(decodedPass));
  } catch {
    add(encodeURIComponent(username), encodeURIComponent(password));
  }
  if (!pairs.length) add(encodeURIComponent(username), encodeURIComponent(password));
  return pairs;
}

function withQuery(url: string, token?: string): string {
  if (!token) return url;
  if (/[?&]token=/i.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
}

export function streamHostBases(creds: XtreamCredentials): string[] {
  return unique(
    [creds.baseUrl, creds.streamBaseUrl]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.replace(/\/+$/, "")),
  );
}

export function liveStreamUrlVariants(creds: XtreamCredentials, id: string | number): string[] {
  const urls: string[] = [];
  const token = creds.token;
  const formats = creds.allowedFormats?.map((f) => f.replace(/^\./, "").toLowerCase()) ?? [];
  const preferTs = formats.includes("ts") && !formats.includes("m3u8");
  const exts = preferTs ? ["ts", "m3u8", ""] : ["m3u8", "ts", ""];
  for (const base of streamHostBases(creds)) {
    for (const [user, pass] of credentialPathPairs(creds.username, creds.password)) {
      for (const ext of exts) {
        urls.push(withQuery(`${base}/live/${user}/${pass}/${id}${ext ? `.${ext}` : ""}`, token));
      }
      urls.push(withQuery(`${base}/${user}/${pass}/${id}`, token));
      urls.push(withQuery(`${base}/${user}/${pass}/${id}.ts`, token));
      urls.push(withQuery(`${base}/${user}/${pass}/${id}.m3u8`, token));
    }
  }
  return unique(urls);
}

export function vodStreamUrlVariants(
  creds: XtreamCredentials,
  kind: "movie" | "series",
  id: string | number,
  ext = "mp4",
): string[] {
  const urls: string[] = [];
  const token = creds.token;
  const cleaned = ext.replace(/^\./, "").toLowerCase() || "mp4";
  const extras = unique([cleaned, "mp4", "mkv", "avi", "ts", "m3u8", "mpg"]);
  for (const base of streamHostBases(creds)) {
    for (const [user, pass] of credentialPathPairs(creds.username, creds.password)) {
      for (const nextExt of extras) {
        urls.push(withQuery(`${base}/${kind}/${user}/${pass}/${id}.${nextExt}`, token));
      }
    }
  }
  return unique(urls);
}

export function retargetStreamHost(url: string, bases: string[]): string[] {
  const out = [url];
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return out;
  }
  for (const base of bases) {
    try {
      const host = new URL(base.includes("://") ? base : `http://${base}`);
      const next = `${host.origin}${parsed.pathname}${parsed.search}`;
      if (!out.includes(next)) out.push(next);
    } catch {
      /* ignore */
    }
  }
  return out;
}

export function streamUrlVariants(url: string, kind: PlayableKind = "live"): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (value: string | undefined) => {
    if (!value) return;
    if (seen.has(value)) return;
    seen.add(value);
    out.push(value);
  };
  add(url);

  const live = url.match(/^(https?:\/\/.+\/live\/)([^/]+)\/([^/]+)\/([^/?]+?)(?:\.(m3u8|ts))?(\?.*)?$/i);
  if (live) {
    const prefix = live[1];
    const user = live[2];
    const pass = live[3];
    const id = live[4];
    const query = live[6] || "";
    for (const [nextUser, nextPass] of credentialPathPairs(user || "", pass || "")) {
      add(`${prefix}${nextUser}/${nextPass}/${id}.m3u8${query}`);
      add(`${prefix}${nextUser}/${nextPass}/${id}.ts${query}`);
      add(`${prefix}${nextUser}/${nextPass}/${id}${query}`);
      const origin = prefix.replace(/\/live\/$/, "");
      add(`${origin}/${nextUser}/${nextPass}/${id}${query}`);
      add(`${origin}/${nextUser}/${nextPass}/${id}.ts${query}`);
      add(`${origin}/${nextUser}/${nextPass}/${id}.m3u8${query}`);
    }
  }

  const vod = url.match(/^(https?:\/\/.+\/(movie|series)\/)([^/]+)\/([^/]+)\/([^/?]+)\.([a-z0-9]+)(\?.*)?$/i);
  if (vod) {
    const prefix = vod[1];
    const user = vod[3];
    const pass = vod[4];
    const id = vod[5];
    const originalExt = vod[6];
    const query = vod[7] || "";
    const extras =
      kind === "live" ? [originalExt, "m3u8", "ts"] : [originalExt, "mp4", "mkv", "avi", "ts", "m3u8"];
    for (const [nextUser, nextPass] of credentialPathPairs(user || "", pass || "")) {
      for (const ext of extras) add(`${prefix}${nextUser}/${nextPass}/${id}.${ext}${query}`);
    }
  }

  return out;
}
