import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CategoryBrowser } from "@/components/category-browser";

export const Route = createFileRoute("/live")({ component: LivePage });

function LivePage() {
  return (
    <AppShell fill>
      <CategoryBrowser kind="live" title="Live TV" searchPlaceholder="Search live TV" />
    </AppShell>
  );
}
