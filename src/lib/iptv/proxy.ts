import { parseJsonPayload } from "./xtream-parse.ts";
import type { StreamKind } from "./stream-detect.ts";

export function proxiedFetchUrl(url: string): string {
  return `/api/iptv/fetch?u=${encodeURIComponent(url)}`;
}

export function proxiedStreamUrl(url: string): string {
  return `/api/iptv/stream?u=${encodeURIComponent(url)}`;
}

export function proxiedImageUrl(url: string | undefined | null): string {
  if (!url) return "";
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (url.startsWith("/")) return url;
  return `/api/iptv/image?u=${encodeURIComponent(url)}`;
}

export async function fetchRemoteText(url: string, timeoutMs = 90000): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(proxiedFetchUrl(url), { signal: ctrl.signal });
    if (!res.ok) {
      const message = await res.text().catch(() => res.statusText);
      throw new Error(message || `Request failed (${res.status})`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchRemoteJson<T>(url: string, timeoutMs = 90000): Promise<T> {
  const text = await fetchRemoteText(url, timeoutMs);
  try {
    return parseJsonPayload(text) as T;
  } catch {
    throw new Error("The IPTV server returned an invalid response.");
  }
}

export interface StreamProbe {
  ok: boolean;
  status: number;
  kind: StreamKind;
  finalUrl?: string;
}

/**
 * Asks the proxy to drop pooled upstream sockets. IPTV accounts are commonly
 * capped at one or two connections, so a lingering socket from the title you
 * just closed is what makes the next one take forever to start.
 */
export function releaseStreams(): void {
  try {
    void fetch("/api/iptv/stream?release=1", { keepalive: true }).catch(() => undefined);
  } catch {
    /* best effort */
  }
}

export async function probeStream(url: string, signal?: AbortSignal): Promise<StreamProbe> {
  try {
    const res = await fetch(`${proxiedStreamUrl(url)}&probe=1`, { signal });
    if (!res.ok) {
      return { ok: false, status: res.status, kind: "unknown" };
    }
    const data = (await res.json()) as StreamProbe;
    return {
      ok: Boolean(data.ok),
      status: Number(data.status) || res.status,
      kind: data.kind || "unknown",
      finalUrl: data.finalUrl,
    };
  } catch {
    return { ok: false, status: 0, kind: "unknown" };
  }
}
