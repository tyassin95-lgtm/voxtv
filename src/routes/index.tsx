import { createFileRoute } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ContentRow } from "@/components/content-row";
import { FavoritesPanel } from "@/components/favorites-panel";
import { PosterCard, WideCard } from "@/components/poster-card";
import { Button } from "@/components/ui/button";
import { SyncOverlay } from "@/components/sync-overlay";
import {
  refreshLibrary,
  useContinueWatching,
  usePlaylist,
  useRecent,
  useStats,
  useSyncProgress,
} from "@/lib/iptv/store";
import { useState } from "react";

export const Route = createFileRoute("/")({ component: HomePage });

function HomePage() {
  const stats = useStats();
  const playlist = usePlaylist();
  const continueWatching = useContinueWatching();
  const recentShows = useRecent("show");
  const recentMovies = useRecent("movie");
  const sync = useSyncProgress();
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setBusy(true);
    try {
      await refreshLibrary();
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell
      trailing={
        <Button
          variant="secondary"
          size="sm"
          onClick={refresh}
          disabled={busy || sync.active}
          className="shrink-0"
        >
          <RefreshCw className={busy || sync.active ? "size-4 animate-spin" : "size-4"} />
          <span className="hidden sm:inline">Refresh playlist data</span>
          <span className="sm:hidden">Refresh</span>
        </Button>
      }
    >
      <div className="px-4 pt-6 md:px-8">
        <p className="text-sm text-muted">{playlist?.name || "Your library"}</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Home</h1>
      </div>

      {continueWatching.length > 0 && (
        <ContentRow title="Continue Watching">
          {continueWatching.map((item) => (
            <WideCard
              key={item.key}
              title={item.title}
              subtitle={item.subtitle}
              image={item.poster}
              progress={item.duration ? item.position / item.duration : 0}
              kind={item.kind}
              id={item.itemId}
            />
          ))}
        </ContentRow>
      )}

      {stats.hasShowDates && recentShows.length > 0 && (
        <ContentRow title="Recently Added TV Shows">
          {recentShows.map((show) => (
            <div key={show.id} className="w-32 shrink-0 snap-start sm:w-36">
              <PosterCard
                to="/shows/$showId"
                search={{ kind: "show", id: show.id }}
                title={show.name}
                image={show.poster}
                subtitle={show.year}
              />
            </div>
          ))}
        </ContentRow>
      )}

      {stats.hasMovieDates && recentMovies.length > 0 && (
        <ContentRow title="Recently Added Movies">
          {recentMovies.map((movie) => (
            <div key={movie.id} className="w-32 shrink-0 snap-start sm:w-36">
              <PosterCard
                to="/watch"
                search={{ kind: "movie", id: movie.id }}
                title={movie.name}
                image={movie.poster}
                subtitle={movie.year}
              />
            </div>
          ))}
        </ContentRow>
      )}

      <FavoritesPanel />
      {sync.active && <SyncOverlay />}
    </AppShell>
  );
}
