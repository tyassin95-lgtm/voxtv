import { createFileRoute } from "@tanstack/react-router";
import { optionsResponse } from "@/lib/iptv/server-proxy";
import { downloadSubtitle, searchSubtitles } from "@/lib/iptv/opensubtitles";
import { isSubtitleLang, type SubtitleLang } from "@/lib/iptv/subtitle-types";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function parseLangs(raw: string | null): SubtitleLang[] {
  const langs = (raw ?? "eng")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(isSubtitleLang);
  return langs.length ? [...new Set(langs)] : ["eng"];
}

function parseNumber(raw: string | null): number | undefined {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined;
}

export const Route = createFileRoute("/api/iptv/subtitles")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const action = url.searchParams.get("action") || "search";
        try {
          if (action === "download") {
            const id = url.searchParams.get("id") || "";
            if (!id) return json({ error: "Missing subtitle id" }, 400);
            const [lang] = parseLangs(url.searchParams.get("lang"));
            const vtt = await downloadSubtitle({
              id,
              lang: lang ?? "eng",
              url: url.searchParams.get("u") || undefined,
            });
            return new Response(vtt, {
              status: 200,
              headers: {
                "content-type": "text/vtt; charset=utf-8",
                "cache-control": "no-store",
                "Access-Control-Allow-Origin": "*",
              },
            });
          }

          const query = url.searchParams.get("q") || "";
          if (!query.trim()) return json({ results: [] });
          const results = await searchSubtitles({
            query,
            langs: parseLangs(url.searchParams.get("lang")),
            season: parseNumber(url.searchParams.get("season")),
            episode: parseNumber(url.searchParams.get("episode")),
          });
          return json({ results });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Subtitle lookup failed.";
          return json({ error: message }, 502);
        }
      },
    },
  },
});
