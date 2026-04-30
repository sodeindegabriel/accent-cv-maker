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
          "CVLingo helps non-English speaking immigrants in the UK create professional CVs by answering simple questions in their own language. Free, AI-powered, UK-format.",
      },
      { name: "author", content: "CVLingo" },
      { property: "og:title", content: "CVLingo — Build Your CV in Your Language" },
      {
        property: "og:description",
        content:
          "Answer simple questions in your language. We create a professional UK CV for you — free, in minutes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@CVLingo" },
      { name: "twitter:title", content: "CVLingo — Build Your CV in Your Language" },
      { name: "description", content: "CVLingo is an AI-powered web app that helps non-English speaking immigrants in the UK build professional CVs." },
      { property: "og:description", content: "CVLingo is an AI-powered web app that helps non-English speaking immigrants in the UK build professional CVs." },
      { name: "twitter:description", content: "CVLingo is an AI-powered web app that helps non-English speaking immigrants in the UK build professional CVs." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/3307bccf-ba6d-40f9-aaed-c652371f10d1/id-preview-a066dbf5--0541e4a6-ece3-4c39-93b4-ee543be54aca.lovable.app-1777476165883.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/3307bccf-ba6d-40f9-aaed-c652371f10d1/id-preview-a066dbf5--0541e4a6-ece3-4c39-93b4-ee543be54aca.lovable.app-1777476165883.png" },
    ],
    links: [
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
