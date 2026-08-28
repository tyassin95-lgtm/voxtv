import { Keyboard, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function SearchBar({
  value,
  onChange,
  placeholder,
  className,
  onActivate,
  active,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  onActivate?: () => void;
  active?: boolean;
}) {
  return (
    <div className={cn("relative w-full max-w-md", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
      <button
        type="button"
        data-tv-zone="search"
        data-tv-node="search"
        onClick={() => onActivate?.()}
        className={cn(
          "flex h-11 w-full items-center rounded-md bg-elevated pr-20 pl-10 text-left text-sm shadow-[var(--shadow-border)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          active && "ring-2 ring-accent",
          !value && "text-subtle",
        )}
        aria-label={placeholder}
      >
        <span className="min-w-0 flex-1 truncate" dir="auto">
          {value || placeholder}
        </span>
      </button>
      <span className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
        {value ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={(event) => {
              event.stopPropagation();
              onChange("");
            }}
            className="flex size-8 items-center justify-center rounded-sm text-muted hover:text-fg"
          >
            <X className="size-4" />
          </button>
        ) : null}
        <button
          type="button"
          aria-label="Open keyboard"
          onClick={() => onActivate?.()}
          className="flex size-8 items-center justify-center rounded-sm text-muted hover:text-fg"
        >
          <Keyboard className="size-4" />
        </button>
      </span>
    </div>
  );
}
