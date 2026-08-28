import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CategoryBrowser } from "@/components/category-browser";

export const Route = createFileRoute("/shows/")({ component: ShowsPage });

function ShowsPage() {
  return (
    <AppShell fill>
      <CategoryBrowser kind="show" title="TV Shows" searchPlaceholder="Search TV shows" />
    </AppShell>
  );
}
