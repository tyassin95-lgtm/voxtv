import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CategoryBrowser } from "@/components/category-browser";

export const Route = createFileRoute("/movies")({ component: MoviesPage });

function MoviesPage() {
  return (
    <AppShell fill>
      <CategoryBrowser kind="movie" title="Movies" searchPlaceholder="Search movies" />
    </AppShell>
  );
}
