import { fetchRemoteText } from "./proxy";
import { fetchShortEpg } from "./xtream";
import { getById, putEpg } from "./db";
import type { Channel, EpgEntry, EpgProgram, PlaylistConfig } from "./types";

function xmlUnescape(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/\u0026amp;/g, "&")
    .replace(/\u0026lt;/g, "<")
    .replace(/\u0026gt;/g, ">")
    .replace(/\u0026quot;/g, '"')
    .replace(/\u0026#39;/g, "'");
}

function parseXmltvTime(raw: string): number {
  const m = raw.trim().match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?/);
  if (!m) return Date.parse(raw) / 1000 || 0;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
  const tz = m[7] ? `${m[7].slice(0, 3)}:${m[7].slice(3)}` : "Z";
  return Date.parse(`${iso}${tz}`) / 1000 || 0;
}

export function parseXmltvNowNext(
  xml: string,
  channelByTvg: Map<string, string>,
): EpgEntry[] {
  const now = Date.now() / 1000;
  const byChannel = new Map<string, EpgProgram[]>();
  const re =
    /<programme\b([^>]*)>([\s\S]*?)<\/programme>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    const attrs = match[1] ?? "";
    const body = match[2] ?? "";
    const startRaw = attrs.match(/\bstart="([^"]+)"/)?.[1];
    const stopRaw = attrs.match(/\bstop="([^"]+)"/)?.[1];
    const chRaw = attrs.match(/\bchannel="([^"]+)"/)?.[1];
    if (!startRaw || !chRaw) continue;
    const start = parseXmltvTime(startRaw);
    const end = stopRaw ? parseXmltvTime(stopRaw) : start + 1800;
    if (end < now - 3600 || start > now + 3600 * 8) continue;
    const channelId = channelByTvg.get(chRaw);
    if (!channelId) continue;
    const title =
      xmlUnescape(body.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim() ||
      "Program";
    const description = xmlUnescape(
      body.match(/<desc\b[^>]*>([\s\S]*?)<\/desc>/i)?.[1] ?? "",
    ).trim();
    const list = byChannel.get(channelId) ?? [];
    list.push({ title, start, end, description: description || undefined });
    byChannel.set(channelId, list);
  }

  const entries: EpgEntry[] = [];
  for (const [channelId, programs] of byChannel) {
    programs.sort((a, b) => a.start - b.start);
    const current = programs.find((p) => p.start <= now && now < p.end) ?? programs[0];
    const next = programs.find((p) => p.start >= (current?.end || now));
    entries.push({
      channelId,
      now: current,
      next,
      updatedAt: Date.now(),
    });
  }
  return entries;
}

export async function importXmltv(
  url: string,
  channels: Channel[],
): Promise<number> {
  const xml = await fetchRemoteText(url, 120000);
  const map = new Map<string, string>();
  for (const ch of channels) {
    if (ch.tvgId) map.set(ch.tvgId, ch.id);
  }
  const entries = parseXmltvNowNext(xml, map);
  await putEpg(entries);
  return entries.length;
}

export async function hydrateEpgForChannels(
  config: PlaylistConfig,
  channels: Channel[],
): Promise<void> {
  if (config.type !== "xtream" || !config.xtream) return;
  const creds = config.xtream;
  const entries: EpgEntry[] = [];
  const now = Date.now() / 1000;
  const queue = channels.slice(0, 40);
  const concurrency = 4;
  let cursor = 0;

  async function worker() {
    while (cursor < queue.length) {
      const ch = queue[cursor++];
      if (!ch) break;
      const existing = await getById<EpgEntry>("epg", ch.id);
      if (existing && Date.now() - existing.updatedAt < 10 * 60 * 1000) continue;
      try {
        const listings = await fetchShortEpg(creds, ch.id);
        const current = listings.find((p) => p.start <= now && now < p.end) ?? listings[0];
        const next = listings.find((p) => p.start >= (current?.end || now));
        if (current) {
          entries.push({
            channelId: ch.id,
            now: current,
            next,
            updatedAt: Date.now(),
          });
        }
      } catch {
        /* ignore per-channel EPG failures */
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  if (entries.length) await putEpg(entries);
}
