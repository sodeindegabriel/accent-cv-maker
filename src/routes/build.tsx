import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/build")({
  head: () => ({
    meta: [
      { title: "Build Your CV — CVBridge" },
      { name: "description", content: "Start building your professional UK CV in your own language." },
      { property: "og:title", content: "Build Your CV — CVBridge" },
      { property: "og:description", content: "Start building your professional UK CV in your own language." },
    ],
  }),
  component: BuildPage,
});

function BuildPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-5 py-24">
        <div className="text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-accent">Coming soon</span>
          <h1 className="mt-3 font-serif text-4xl text-foreground md:text-6xl">CV Builder coming soon</h1>
          <p className="mt-4 text-muted-foreground">We're putting the finishing touches on your CV journey.</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
