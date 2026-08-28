import { Progress } from "@/components/ui/progress";
import { VoxMark } from "@/components/logo";
import { useSyncProgress } from "@/lib/iptv/store";

export function SyncOverlay() {
  const sync = useSyncProgress();
  if (!sync.active) return null;
  const pct = Math.round(sync.progress * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/95 px-6">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <VoxMark className="size-12" />
        <h2 className="mt-5 font-display text-2xl font-semibold tracking-tight">
          Syncing your library
        </h2>
        <p className="mt-2 text-sm text-muted">{sync.phase || "Please wait"}</p>
        <Progress value={pct} className="mt-6 h-2" />
        <p className="mt-2 text-xs tabular-nums text-subtle">{pct}%</p>
        {sync.stats && (
          <p className="mt-4 text-xs text-muted">
            {sync.stats.channels.toLocaleString()} channels ·{" "}
            {sync.stats.shows.toLocaleString()} shows ·{" "}
            {sync.stats.movies.toLocaleString()} movies
          </p>
        )}
      </div>
    </div>
  );
}
