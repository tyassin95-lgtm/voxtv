import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Heart, Play } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useBackHandler, useRemoteHandler } from "@/components/remote-root";
import { getById } from "@/lib/iptv/db";
import { loadShowEpisodes, useIsFavorite } from "@/lib/iptv/store";
import { proxiedImageUrl } from "@/lib/iptv/proxy";
import { enableTvMode } from "@/lib/iptv/remote";
import type { Episode, Show } from "@/lib/iptv/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/shows/$showId")({ component: ShowPage });

function ShowPage() {
  const { showId } = Route.useParams();
  const navigate = useNavigate();
  const [show, setShow] = useState<Show | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [season, setSeason] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [favorited, toggleFav] = useIsFavorite("show", showId);
  const [epIndex, setEpIndex] = useState(0);
  const [zone, setZone] = useState<"play" | "fav" | "seasons" | "episodes">("play");

  useEffect(() => {
    let live = true;
    (async () => {
      const row = await getById<Show>("shows", showId);
      if (!live) return;
      if (!row) {
        setLoading(false);
        return;
      }
      setShow(row);
      const eps = await loadShowEpisodes(row);
      if (!live) return;
      setEpisodes(eps);
      setSeason(eps[0]?.season ?? 1);
      setLoading(false);
    })();
    return () => {
      live = false;
    };
  }, [showId]);

  const seasons = useMemo(
    () => [...new Set(episodes.map((e) => e.season))].sort((a, b) => a - b),
    [episodes],
  );
  const visible = episodes.filter((e) => e.season === season);

  useEffect(() => {
    setEpIndex((index) => Math.max(0, Math.min(Math.max(visible.length - 1, 0), index)));
  }, [visible.length, season]);

  useBackHandler(() => {
    void navigate({ to: "/shows" });
    return true;
  }, [navigate]);

  useRemoteHandler(
    (event) => {
      if (loading || !show) return false;
      const action = event.action;
      if (
        action !== "up" &&
        action !== "down" &&
        action !== "left" &&
        action !== "right" &&
        action !== "select" &&
        action !== "playpause" &&
        action !== "play"
      ) {
        return false;
      }
      enableTvMode();
      const playFirst = () => {
        const ep = visible[0] ?? visible[epIndex];
        if (ep) void navigate({ to: "/watch", search: { kind: "episode", id: ep.id } });
      };
      if (action === "play" || action === "playpause") {
        const ep = visible[epIndex] ?? visible[0];
        if (ep) void navigate({ to: "/watch", search: { kind: "episode", id: ep.id } });
        return true;
      }
      if (action === "select") {
        if (zone === "play") playFirst();
        else if (zone === "fav") toggleFav();
        else if (zone === "seasons") return true;
        else {
          const ep = visible[epIndex];
          if (ep) void navigate({ to: "/watch", search: { kind: "episode", id: ep.id } });
        }
        return true;
      }
      if (zone === "play" || zone === "fav") {
        if (action === "right") setZone("fav");
        else if (action === "left") setZone("play");
        else if (action === "down") setZone(seasons.length ? "seasons" : "episodes");
        return true;
      }
      if (zone === "seasons") {
        if (action === "up") {
          setZone("play");
          return true;
        }
        if (action === "down") {
          setZone("episodes");
          return true;
        }
        if (action === "left" || action === "right") {
          const i = Math.max(0, seasons.indexOf(season ?? seasons[0] ?? 1));
          const next = action === "left" ? Math.max(0, i - 1) : Math.min(seasons.length - 1, i + 1);
          const value = seasons[next];
          if (value !== undefined) setSeason(value);
        }
        return true;
      }
      if (action === "up") {
        if (epIndex <= 0) setZone(seasons.length ? "seasons" : "play");
        else setEpIndex((i) => i - 1);
        return true;
      }
      if (action === "down") {
        setEpIndex((i) => Math.min(visible.length - 1, i + 1));
        return true;
      }
      return true;
    },
    [loading, show, visible, epIndex, zone, seasons, season, toggleFav, navigate],
  );

  useEffect(() => {
    if (zone !== "episodes") return;
    document.querySelector<HTMLElement>(`[data-ep-index="${epIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [epIndex, zone]);

  if (loading) {
    return (
      <AppShell>
        <p className="px-8 py-16 text-sm text-muted">Loading show…</p>
      </AppShell>
    );
  }

  if (!show) {
    return (
      <AppShell>
        <p className="px-8 py-16 text-sm text-muted">This show is no longer in your library.</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="relative">
        {show.backdrop && (
          <img
            src={proxiedImageUrl(show.backdrop)}
            alt=""
            className="absolute inset-0 h-72 w-full object-cover opacity-30"
          />
        )}
        <div className="relative flex flex-col gap-5 px-4 py-6 md:flex-row md:px-8">
          <img
            src={proxiedImageUrl(show.poster) || show.poster}
            alt=""
            className="h-64 w-44 rounded-lg object-cover shadow-[var(--shadow-poster)]"
          />
          <div className="flex min-w-0 flex-1 flex-col justify-end">
            <button
              type="button"
              onClick={() => navigate({ to: "/shows" })}
              className="mb-3 flex h-10 w-10 items-center justify-center rounded-md text-muted hover:text-fg"
              aria-label="Back to TV shows"
              data-tv-node="back"
            >
              <ArrowLeft className="size-5" />
            </button>
            <h1 className="font-display text-3xl font-semibold tracking-tight">{show.name}</h1>
            <p className="mt-2 text-sm text-muted">
              {[show.year, show.rating, `${seasons.length} season${seasons.length === 1 ? "" : "s"}`]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {show.plot && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{show.plot}</p>}
            <div className="mt-4 flex gap-2">
              {visible[0] && (
                <Button
                  onClick={() =>
                    navigate({ to: "/watch", search: { kind: "episode", id: visible[0]!.id } })
                  }
                  className={cn(zone === "play" && "tv-focused")}
                  data-tv-node="play"
                >
                  <Play className="ml-0.5 size-4 fill-current" />
                  Play
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={toggleFav}
                className={cn(zone === "fav" && "tv-focused")}
                data-tv-node="fav"
              >
                <Heart className={cn("size-4", favorited && "fill-accent text-accent")} />
                {favorited ? "Saved" : "Favorite"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-10 md:px-8">
        <div className="row-scroll mt-2 flex gap-2 overflow-x-auto">
          {seasons.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSeason(s)}
              data-tv-node="season"
              className={cn(
                "h-11 shrink-0 rounded-full px-4 text-sm font-medium",
                season === s ? "bg-fg text-bg" : "bg-elevated text-muted hover:text-fg",
                zone === "seasons" && season === s && "tv-focused",
              )}
            >
              Season {s}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {visible.map((ep, index) => (
            <button
              key={ep.id}
              type="button"
              data-ep-index={index}
              data-tv-node="episode"
              onClick={() => navigate({ to: "/watch", search: { kind: "episode", id: ep.id } })}
              className={cn(
                "flex min-h-16 items-center gap-3 rounded-lg bg-surface px-3 py-3 text-left shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)]",
                zone === "episodes" && index === epIndex && "tv-focused",
              )}
            >
              <span className="w-10 text-sm tabular-nums text-muted">{ep.episode}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{ep.name}</span>
                {ep.plot && <span className="block truncate text-xs text-muted">{ep.plot}</span>}
              </span>
              <Play className="size-4 text-muted" />
            </button>
          ))}
          {visible.length === 0 && (
            <p className="py-8 text-sm text-muted">No episodes in this season yet.</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
