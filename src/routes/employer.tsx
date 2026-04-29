import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/employer")({
  head: () => ({
    meta: [
      { title: "For Employers — CVBridge" },
      { name: "description", content: "Hire pre-vetted, motivated candidates ready to work in the UK." },
      { property: "og:title", content: "For Employers — CVBridge" },
      { property: "og:description", content: "Hire pre-vetted, motivated candidates ready to work in the UK." },
    ],
  }),
  component: EmployerPage,
});

function EmployerPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-5 py-24">
        <div className="text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-accent">For Employers</span>
          <h1 className="mt-3 font-serif text-4xl text-foreground md:text-6xl">Employer page coming soon</h1>
          <p className="mt-4 text-muted-foreground">A new way to hire is on the way.</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
