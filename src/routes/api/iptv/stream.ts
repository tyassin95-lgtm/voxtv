import { createFileRoute } from "@tanstack/react-router";
import { decodeTargetUrl, optionsResponse, proxyProbe, proxyStream } from "@/lib/iptv/server-proxy";

export const Route = createFileRoute("/api/iptv/stream")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(),
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const target = decodeTargetUrl(url.searchParams.get("u"));
          if (url.searchParams.get("probe") === "1") {
            return await proxyProbe(target, request);
          }
          return await proxyStream(target, request);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Stream proxy failed";
          return new Response(message, {
            status: 400,
            headers: { "content-type": "text/plain; charset=utf-8" },
          });
        }
      },
    },
  },
});
