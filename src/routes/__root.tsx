import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CVLingo — Build Your CV in Your Language" },
      {
        name: "description",
        content:
          "Free UK CV builder for immigrants and non-English speakers. Answer simple questions in your language, get a professional UK CV instantly.",
      },
      { name: "author", content: "CVLingo" },
      { property: "og:site_name", content: "CVLingo" },
      { property: "og:title", content: "CVLingo — Build Your CV in Your Language" },
      {
        property: "og:description",
        content:
          "Free UK CV builder for immigrants and non-English speakers. Answer simple questions in your language, get a professional UK CV instantly.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://cvlingo.com" },
      { property: "og:image", content: "https://cvlingo.com/cvlingo-logo.png" },
      { property: "og:image:width", content: "800" },
      { property: "og:image:height", content: "800" },
      { property: "og:image:alt", content: "CVLingo — Build Your CV in Your Language" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@CVLingo" },
      { name: "twitter:title", content: "CVLingo — Build Your CV in Your Language" },
      { name: "twitter:description", content: "Free UK CV builder for immigrants and non-English speakers. Answer simple questions in your language, get a professional UK CV instantly." },
      { name: "twitter:image", content: "https://cvlingo.com/cvlingo-logo.png" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/cvlingo-logo.svg" },
      { rel: "shortcut icon", href: "/cvlingo-logo.svg" },
      { rel: "apple-touch-icon", href: "/cvlingo-logo.svg" },
      { rel: "stylesheet", href: appCss },

      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return <Outlet />;
}
