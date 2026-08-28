import { Link, useRouterState } from "@tanstack/react-router";
import { Clapperboard, Film, Home, Radio, Settings } from "lucide-react";
import { VoxWordmark } from "@/components/logo";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/live", label: "Live TV", icon: Radio },
  { to: "/shows", label: "TV Shows", icon: Clapperboard },
  { to: "/movies", label: "Movies", icon: Film },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({
  children,
  trailing,
  fill,
}: {
  children: React.ReactNode;
  trailing?: React.ReactNode;
  fill?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className={cn("bg-bg text-fg", fill ? "flex h-dvh flex-col overflow-hidden" : "min-h-dvh")}>
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b border-border bg-bg/90 px-4 backdrop-blur-md md:px-8">
        <Link to="/" className="shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <VoxWordmark />
        </Link>
        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                data-tv-node="nav"
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  active ? "text-fg" : "text-muted hover:text-fg",
                )}
              >
                {item.label}
                {active && <span className="mt-1 block h-0.5 rounded-full bg-accent" />}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex min-w-0 items-center gap-2">{trailing}</div>
      </header>

      <div
        className={cn(
          fill ? "flex min-h-0 flex-1 flex-col overflow-hidden pb-20 md:pb-0" : "pb-24 md:pb-8",
        )}
      >
        {children}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
        {NAV.map((item) => {
          const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 text-[0.7rem] font-medium",
                active ? "text-fg" : "text-muted",
              )}
            >
              <item.icon className={cn("size-5", active && "text-accent")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
