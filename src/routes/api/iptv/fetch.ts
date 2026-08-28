import { createFileRoute } from "@tanstack/react-router";
import { decodeTargetUrl, optionsResponse, proxyFetch } from "@/lib/iptv/server-proxy";

export const Route = createFileRoute("/api/iptv/fetch")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(),
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const target = decodeTargetUrl(url.searchParams.get("u"));
          return await proxyFetch(target, request);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Proxy failed";
          return new Response(message, {
            status: 400,
            headers: { "content-type": "text/plain; charset=utf-8" },
          });
        }
      },
    },
  },
});
