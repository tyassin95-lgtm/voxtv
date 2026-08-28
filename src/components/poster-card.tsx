import { Link } from "@tanstack/react-router";
import { Play } from "lucide-react";
import { proxiedImageUrl } from "@/lib/iptv/proxy";
import { cn } from "@/lib/utils";

export function PosterCard({
  to,
  search,
  title,
  image,
  subtitle,
  progress,
  tvIndex,
  tvFocused,
}: {
  to: "/watch" | "/shows/$showId";
  search?: { kind: string; id: string };
  title: string;
  image: string;
  subtitle?: string;
  progress?: number;
  tvIndex?: number;
  tvFocused?: boolean;
}) {
  const inner = (
    <>
      <span className="poster-frame relative block overflow-hidden rounded-md bg-elevated">
        <img
          src={proxiedImageUrl(image) || image}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
        />
        <span className="absolute inset-0 flex items-center justify-center bg-bg/0 opacity-0 transition-[opacity,background-color] duration-200 group-hover:bg-bg/35 group-hover:opacity-100 group-focus-visible:bg-bg/35 group-focus-visible:opacity-100">
          <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-fg">
            <Play className="ml-0.5 size-5 fill-current" />
          </span>
        </span>
        {progress !== undefined && progress > 0 && progress < 1 && (
          <span className="absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-fg/25">
            <span className="block h-full bg-accent" style={{ width: `${progress * 100}%` }} />
          </span>
        )}
      </span>
      <span className="mt-2 block truncate text-sm font-medium text-fg">{title}</span>
      {subtitle && <span className="block truncate text-xs text-muted">{subtitle}</span>}
    </>
  );

  const className = cn(
    "poster-scale group min-w-0 snap-start text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
    tvFocused && "tv-focused",
  );
  const tabIndex = tvIndex === undefined ? undefined : tvFocused ? 0 : -1;

  if (to === "/shows/$showId") {
    return (
      <Link
        to="/shows/$showId"
        params={{ showId: search?.id ?? "" }}
        className={className}
        data-tv-index={tvIndex}
        data-tv-node="card"
        tabIndex={tabIndex}
      >
        {inner}
      </Link>
    );
  }

  return (
    <Link
      to="/watch"
      search={{ kind: search?.kind ?? "movie", id: search?.id ?? "" }}
      className={className}
      data-tv-index={tvIndex}
      data-tv-node="card"
      tabIndex={tabIndex}
    >
      {inner}
    </Link>
  );
}

export function WideCard({
  title,
  subtitle,
  image,
  progress,
  kind,
  id,
}: {
  title: string;
  subtitle?: string;
  image: string;
  progress?: number;
  kind: string;
  id: string;
}) {
  return (
    <Link
      to="/watch"
      search={{ kind, id }}
      className="poster-scale group w-56 shrink-0 snap-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:w-64"
      data-tv-node="wide"
    >
      <span className="wide-frame relative block overflow-hidden rounded-md bg-elevated">
        <img
          src={proxiedImageUrl(image) || image}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
        />
        <span className="absolute inset-0 flex items-center justify-center bg-bg/0 opacity-0 transition-[opacity] duration-200 group-hover:bg-bg/35 group-hover:opacity-100">
          <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-fg">
            <Play className="ml-0.5 size-5 fill-current" />
          </span>
        </span>
        {progress !== undefined && (
          <span className="absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-fg/25">
            <span className="block h-full bg-accent" style={{ width: `${Math.min(100, progress * 100)}%` }} />
          </span>
        )}
      </span>
      <span className="mt-2 block truncate text-sm font-medium">{title}</span>
      {subtitle && <span className="block truncate text-xs text-muted">{subtitle}</span>}
    </Link>
  );
}
