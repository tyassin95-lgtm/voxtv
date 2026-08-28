import { createFileRoute } from "@tanstack/react-router";
import { decodeTargetUrl, optionsResponse, proxyImage } from "@/lib/iptv/server-proxy";

export const Route = createFileRoute("/api/iptv/image")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(),
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const target = decodeTargetUrl(url.searchParams.get("u"));
          return await proxyImage(target, request);
        } catch {
          return new Response(null, { status: 400 });
        }
      },
    },
  },
});
