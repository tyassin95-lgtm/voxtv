import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/shows")({ component: ShowsLayout });

function ShowsLayout() {
  return <Outlet />;
}
