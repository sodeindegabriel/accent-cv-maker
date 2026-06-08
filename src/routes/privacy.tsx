import { createFileRoute, Link } from "@tanstack/react-router";
import { BridgeIcon } from "@/components/BridgeIcon";

function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2 text-primary transition hover:opacity-80">
            <BridgeIcon className="h-7 w-7" />
            <span className="font-serif text-2xl">CVLingo</span>
          </Link>
          <Link to="/" className="text-sm font-medium text-muted-foreground transition hover:text-foreground">
            ← Back to home
          </Link>
        </div>
      </header>
      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-semibold sm:text-4xl">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: June 2026</p>
        <div className="prose mt-6 max-w-none space-y-5 text-foreground">
          <p>
            CVLingo helps you build a UK-format CV in your own language. We respect your privacy and
            keep your data handling simple.
          </p>
          <h2 className="text-xl font-semibold">What we collect</h2>
          <p>
            We collect only the information you enter into the CV builder — your name, contact
            details, work experience, skills, and language preference. This is used solely to
            generate your CV.
          </p>
          <h2 className="text-xl font-semibold">How we use your data</h2>
          <p>
            Your information is sent to our AI provider to generate your CV in both your chosen
            language and English. We do not sell, rent, or share your data with any third parties
            for marketing.
          </p>
          <h2 className="text-xl font-semibold">Storage</h2>
          <p>
            Your answers are stored in your browser session and cleared when you close the tab. We
            do not keep a copy of your finished CV on our servers.
          </p>
          <h2 className="text-xl font-semibold">Your rights</h2>
          <p>
            You can stop using CVLingo at any time. If you have questions about your data, contact
            us at <a href="mailto:hello@cvlingo.com" className="text-primary underline">hello@cvlingo.com</a>.
          </p>
        </div>
      </section>
    </main>
  );
}

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Privacy Policy — CVLingo" },
      { name: "description", content: "How CVLingo handles your information. We do not share your data with third parties." },
    ],
    links: [{ rel: "canonical", href: "https://cvlingo.com/privacy" }],
  }),
});
