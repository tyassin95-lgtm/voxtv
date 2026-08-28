import { Onboarding } from "@/components/onboarding";
import { SyncOverlay } from "@/components/sync-overlay";
import { usePlaylist, useSyncProgress } from "@/lib/iptv/store";

export function AppGuard({ children }: { children: React.ReactNode }) {
  const playlist = usePlaylist();
  const sync = useSyncProgress();

  return (
    <>
      {playlist ? children : <Onboarding />}
      {sync.active && <SyncOverlay />}
    </>
  );
}
