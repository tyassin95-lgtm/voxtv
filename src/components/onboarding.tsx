import { useState } from "react";
import { Link2, Server, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoxMark } from "@/components/logo";
import { addPlaylist } from "@/lib/iptv/sync";
import { parseXtreamInput } from "@/lib/iptv/xtream";
import { useSyncProgress } from "@/lib/iptv/store";
import { cn } from "@/lib/utils";

type Mode = "m3u" | "xtream";

function friendlyError(err: unknown): string {
  const message = err instanceof Error ? err.message : "Could not add playlist.";
  if (/fetch failed|failed to fetch|networkerror|econnrefused|enotfound|abort/i.test(message)) {
    return "Could not reach that playlist. Check the URL and try again.";
  }
  return message;
}

export function Onboarding() {
  const [mode, setMode] = useState<Mode>("m3u");
  const [m3uUrl, setM3uUrl] = useState("");
  const [server, setServer] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sync = useSyncProgress();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "m3u") {
        const url = m3uUrl.trim();
        if (!/^https?:\/\//i.test(url) && !url.startsWith("//")) {
          throw new Error("Enter a full M3U / M3U8 URL starting with http:// or https://");
        }
        await addPlaylist({
          type: "m3u",
          name: "M3U playlist",
          m3uUrl: url.startsWith("//") ? `https:${url}` : url,
          addedAt: Date.now(),
        });
      } else {
        if (!server.trim() || !username.trim() || !password) {
          throw new Error("Server URL, username, and password are all required.");
        }
        const xtream = parseXtreamInput(server, username, password);
        await addPlaylist({
          type: "xtream",
          name: "Xtream playlist",
          xtream,
          addedAt: Date.now(),
        });
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  const shownError = error || (!sync.active ? sync.error : null);

  return (
    <main className="vignette flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="flex w-full max-w-md flex-col items-center">
        <VoxMark className="size-14" />
        <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight text-fg">
          Vox IPTV
        </h1>
        <p className="mt-2 max-w-sm text-center text-sm leading-relaxed text-muted">
          Add your own playlist to start watching. Nothing is preloaded.
        </p>

        <form
          onSubmit={onSubmit}
          className="mt-8 w-full rounded-xl bg-surface p-2 shadow-[var(--shadow-border)]"
        >
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-bg p-1">
            {(
              [
                { id: "m3u", label: "M3U URL", icon: Link2 },
                { id: "xtream", label: "Xtream Codes", icon: Server },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setMode(tab.id);
                  setError(null);
                }}
                className={cn(
                  "flex h-10 items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors duration-150",
                  mode === tab.id ? "bg-elevated text-fg" : "text-muted hover:text-fg",
                )}
              >
                <tab.icon className="size-4" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 px-3 pb-3 pt-4">
            {mode === "m3u" ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted">Playlist URL</span>
                <Input
                  value={m3uUrl}
                  onChange={(e) => setM3uUrl(e.target.value)}
                  placeholder="https://provider.example/playlist.m3u"
                  autoComplete="url"
                  inputMode="url"
                  required
                />
              </label>
            ) : (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted">Server URL</span>
                  <Input
                    value={server}
                    onChange={(e) => setServer(e.target.value)}
                    placeholder="http://host:port"
                    autoComplete="url"
                    required
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted">Username</span>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username"
                    autoComplete="username"
                    required
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted">Password</span>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    autoComplete="current-password"
                    required
                  />
                </label>
              </>
            )}

            {shownError && (
              <p className="text-sm text-accent" role="alert">
                {shownError}
              </p>
            )}

            <Button type="submit" size="lg" className="mt-1 w-full" disabled={busy || sync.active}>
              {busy || sync.active ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Connecting
                </>
              ) : (
                "Add playlist"
              )}
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
