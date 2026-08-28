import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { VideoPlayer } from "@/components/player/video-player";
import { resolvePlayable } from "@/lib/iptv/store";
import { getById } from "@/lib/iptv/db";
import type { Playable, WatchProgress } from "@/lib/iptv/types";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";

type WatchSearch = { kind: string; id: string };

export const Route = createFileRoute("/watch")({
  validateSearch: (search: Record<string, unknown>): WatchSearch => ({
    kind: String(search.kind ?? ""),
    id: String(search.id ?? ""),
  }),
  component: WatchPage,
});

function WatchPage() {
  const { kind, id } = Route.useSearch();
  const navigate = useNavigate();
  const [item, setItem] = useState<Playable | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const playable = await resolvePlayable(kind as Playable["kind"], id);
      if (!live) return;
      if (!playable) {
        setError("This title is no longer in your library.");
        return;
      }
      if (!playable.isLive) {
        const progress = await getById<WatchProgress>("progress", `${playable.kind}:${playable.id}`);
        if (progress && progress.position > 8) {
          playable.duration = progress.duration;
        }
      }
      setItem(playable);
    })().catch(() => setError("Could not load this stream."));
    return () => {
      live = false;
    };
  }, [kind, id]);

  if (error) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
        <p className="text-sm text-muted">{error}</p>
        <Button variant="secondary" onClick={() => navigate({ to: "/" })}>
          Back home
        </Button>
      </main>
    );
  }

  if (!item) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-bg">
        <span className="size-10 animate-spin rounded-full border-2 border-fg/20 border-t-accent" />
      </main>
    );
  }

  return <VideoPlayer item={item} />;
}
