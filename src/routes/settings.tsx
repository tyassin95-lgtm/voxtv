import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Database, Eraser, History, RefreshCw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useBackHandler } from "@/components/remote-root";
import {
  clearLibraryCache,
  clearPreferences,
  clearWatchData,
  formatBytes,
  readCacheReport,
  resetApp,
  type CacheReport,
} from "@/lib/iptv/cache";
import { refreshLibrary, usePlaylist, useSyncProgress } from "@/lib/iptv/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

type ActionId = "refresh" | "library" | "watch" | "prefs" | "reset";

function SettingsPage() {
  const navigate = useNavigate();
  const playlist = usePlaylist();
  const sync = useSyncProgress();
  const [report, setReport] = useState<CacheReport | null>(null);
  const [busy, setBusy] = useState<ActionId | null>(null);
  const [confirming, setConfirming] = useState<ActionId | null>(null);

  const loadReport = useCallback(() => {
    readCacheReport()
      .then(setReport)
      .catch(() => setReport(null));
  }, []);

  useEffect(loadReport, [loadReport]);

  useBackHandler(() => {
    if (confirming) {
      setConfirming(null);
      return true;
    }
    void navigate({ to: "/" });
    return true;
  }, [confirming, navigate]);

  async function run(id: ActionId, task: () => Promise<void>, done: string) {
    setBusy(id);
    setConfirming(null);
    try {
      await task();
      toast.success(done);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That did not work. Try again.");
    } finally {
      setBusy(null);
      loadReport();
    }
  }

  const stats = report?.stats;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-16 md:px-8">
        <p className="text-sm text-muted">{playlist?.name || "No playlist"}</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Settings</h1>

        <section className="mt-6 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <div className="flex items-center gap-2">
            <Database className="size-4 text-muted" />
            <h2 className="font-display text-lg font-semibold">Storage</h2>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            <Stat label="Live channels" value={stats?.channels} />
            <Stat label="Movies" value={stats?.movies} />
            <Stat label="TV shows" value={stats?.shows} />
            <Stat label="Episodes" value={stats?.episodes} />
            <Stat label="Categories" value={stats?.categories} />
            <div>
              <dt className="text-xs text-subtle">Cache size</dt>
              <dd className="tabular-nums">{formatBytes(report?.usageBytes ?? null)}</dd>
            </div>
          </dl>
        </section>

        <div className="mt-4 flex flex-col gap-3">
          <ActionCard
            id="refresh"
            icon={RefreshCw}
            title="Refresh library"
            description="Download the latest channels, movies and shows from your provider."
            actionLabel="Refresh now"
            busy={busy === "refresh" || sync.active}
            disabled={!playlist}
            confirming={confirming}
            setConfirming={setConfirming}
            onRun={() => run("refresh", () => refreshLibrary(), "Library refreshed.")}
          />
          <ActionCard
            id="library"
            icon={Eraser}
            title="Clear library cache"
            description="Removes the cached catalog and TV guide. Your playlist, favorites and history stay. The library is downloaded again on the next refresh."
            actionLabel="Clear cache"
            needsConfirm
            busy={busy === "library"}
            confirming={confirming}
            setConfirming={setConfirming}
            onRun={() =>
              run(
                "library",
                async () => {
                  await clearLibraryCache();
                  await refreshLibrary().catch(() => undefined);
                },
                "Library cache cleared.",
              )
            }
          />
          <ActionCard
            id="watch"
            icon={History}
            title="Clear favorites & history"
            description="Removes Continue Watching progress and every favorite."
            actionLabel="Clear"
            needsConfirm
            busy={busy === "watch"}
            confirming={confirming}
            setConfirming={setConfirming}
            onRun={() => run("watch", clearWatchData, "Favorites and history cleared.")}
          />
          <ActionCard
            id="prefs"
            icon={Eraser}
            title="Reset player preferences"
            description="Restores the default aspect ratio, volume, sorting and keyboard language."
            actionLabel="Reset"
            needsConfirm
            busy={busy === "prefs"}
            confirming={confirming}
            setConfirming={setConfirming}
            onRun={() => run("prefs", clearPreferences, "Preferences reset.")}
          />
          <ActionCard
            id="reset"
            icon={TriangleAlert}
            title="Reset app to default"
            description="Deletes everything this app stored on this device — playlist, cached library, favorites, history and offline files — and returns to the setup screen."
            actionLabel="Reset app"
            destructive
            needsConfirm
            busy={busy === "reset"}
            confirming={confirming}
            setConfirming={setConfirming}
            onRun={() =>
              run(
                "reset",
                async () => {
                  await resetApp();
                  window.setTimeout(() => window.location.replace("/"), 400);
                },
                "App reset. Reloading…",
              )
            }
          />
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div>
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className="tabular-nums">{value === undefined ? "—" : value.toLocaleString()}</dd>
    </div>
  );
}

function ActionCard({
  id,
  icon: Icon,
  title,
  description,
  actionLabel,
  onRun,
  busy,
  disabled,
  destructive,
  needsConfirm,
  confirming,
  setConfirming,
}: {
  id: ActionId;
  icon: typeof Database;
  title: string;
  description: string;
  actionLabel: string;
  onRun: () => void;
  busy?: boolean;
  disabled?: boolean;
  destructive?: boolean;
  needsConfirm?: boolean;
  confirming: ActionId | null;
  setConfirming: (id: ActionId | null) => void;
}) {
  const asking = confirming === id;
  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:flex-row sm:items-center",
        destructive && "shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-accent)_45%,transparent)]",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Icon className={cn("size-4", destructive ? "text-accent" : "text-muted")} />
          <h2 className="font-display text-base font-semibold">{title}</h2>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        {asking ? (
          <>
            <Button variant="secondary" onClick={() => setConfirming(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant={destructive ? "default" : "secondary"} onClick={onRun} disabled={busy}>
              {busy ? "Working…" : "Confirm"}
            </Button>
          </>
        ) : (
          <Button
            variant="secondary"
            onClick={() => (needsConfirm ? setConfirming(id) : onRun())}
            disabled={busy || disabled}
            className={cn(destructive && "text-accent")}
          >
            {busy ? "Working…" : actionLabel}
          </Button>
        )}
      </div>
    </section>
  );
}
