import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { AppGuard } from "@/components/guard";
import { RemoteRoot } from "@/components/remote-root";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

const APP_NAME = "Vox IPTV";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      { name: "theme-color", content: "#08080a" },
      {
        name: "description",
        content: "Vox IPTV — add your M3U or Xtream playlist and watch live TV, shows, and movies.",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700&family=Outfit:wght@300;400;500;600;700&display=swap",
      },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  return (
    <html lang="en" className="dark antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-bg text-fg">
        <PreviewHostBridge />
        <AuthProvider>
          <RemoteRoot>
            <AppGuard>
              <Outlet />
            </AppGuard>
          </RemoteRoot>
          <Toaster
            theme="dark"
            position="top-center"
            toastOptions={{
              style: {
                background: "#1a1a1e",
                border: "1px solid rgb(255 255 255 / 0.08)",
                color: "#f4f4f5",
              },
            }}
          />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
