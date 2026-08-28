import { cn } from "@/lib/utils";

export function VoxMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("text-accent", className)}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <path
        d="M8.2 8.5h5.1L16 18.2 18.7 8.5h5.1L17.6 23.5h-3.2L8.2 8.5Z"
        fill="white"
      />
    </svg>
  );
}

export function VoxWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <VoxMark className="size-8" />
      <span className="flex flex-col leading-none">
        <span className="font-display text-lg font-semibold tracking-tight text-fg">
          VOX
        </span>
        {!compact && (
          <span className="text-[0.65rem] font-medium tracking-[0.22em] text-muted">
            IPTV
          </span>
        )}
      </span>
    </span>
  );
}
