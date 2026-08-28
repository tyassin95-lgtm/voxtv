import { useEffect, useState } from "react";
import { PosterCard, WideCard } from "@/components/poster-card";
import { getById } from "@/lib/iptv/db";
import { useFavoriteList } from "@/lib/iptv/store";
import type { Channel, ContentKind, Movie, Show } from "@/lib/iptv/types";
import { cn } from "@/lib/utils";

const TABS: { id: ContentKind; label: string }[] = [
  { id: "live", label: "Channels" },
  { id: "show", label: "TV Shows" },
  { id: "movie", label: "Movies" },
];

export function FavoritesPanel() {
  const favorites = useFavoriteList();
  const [tab, setTab] = useState<ContentKind>("live");
  const [items, setItems] = useState<Array<Channel | Movie | Show>>([]);

  useEffect(() => {
    let live = true;
    const subset = favorites.filter((f) => f.kind === tab);
    Promise.all(
      subset.map(async (fav) => {
        const store = fav.kind === "live" ? "channels" : fav.kind === "movie" ? "movies" : "shows";
        return getById<Channel | Movie | Show>(store, fav.itemId);
      }),
    ).then((rows) => {
      if (live) setItems(rows.filter(Boolean) as Array<Channel | Movie | Show>);
    });
    return () => {
      live = false;
    };
  }, [favorites, tab]);

  return (
    <section className="mt-8 px-4 md:px-8">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="font-display text-lg font-semibold tracking-tight">Favorites</h2>
        <div className="flex gap-1 rounded-lg bg-elevated p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "h-9 rounded-md px-3 text-sm font-medium transition-colors duration-150",
                tab === t.id ? "bg-surface text-fg" : "text-muted hover:text-fg",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="py-8 text-sm text-muted">
          Nothing saved here yet. Heart a title while browsing to keep it close.
        </p>
      ) : tab === "live" ? (
        <div className="row-scroll flex snap-x gap-3 overflow-x-auto pb-2">
          {(items as Channel[]).map((ch) => (
            <WideCard
              key={ch.id}
              title={ch.name}
              image={ch.logo}
              kind="live"
              id={ch.id}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
          {items.map((item) => (
            <PosterCard
              key={item.id}
              to={tab === "show" ? "/shows/$showId" : "/watch"}
              search={{ kind: tab, id: item.id }}
              title={item.name}
              image={"poster" in item ? item.poster : ""}
            />
          ))}
        </div>
      )}
    </section>
  );
}
