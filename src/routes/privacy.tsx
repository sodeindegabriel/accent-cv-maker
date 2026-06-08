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
        <div className="prose mt-6 max-w-none space-y-6 text-foreground">
          <p>
            CVLingo is operated by Jebaco Global. We are committed to protecting your personal information.
          </p>

          <h2 className="text-xl font-semibold">Information We Collect</h2>
          <p>
            We collect information you provide when building your CV, including your name, contact details, work experience, and skills. We do not collect payment information at this time.
          </p>

          <h2 className="text-xl font-semibold">How We Use Your Information</h2>
          <p>
            Your information is used solely to generate your CV. We do not sell, share, or transfer your personal data to third parties without your consent.
          </p>

          <h2 className="text-xl font-semibold">Data Storage</h2>
          <p>
            CV data is processed in real time and is not permanently stored on our servers unless you create an account (coming soon).
          </p>

          <h2 className="text-xl font-semibold">Your Rights</h2>
          <p>
            Under UK GDPR you have the right to access, correct, or delete your personal data at any time. Contact us at{" "}
            <a href="mailto:privacy@cvlingo.com" className="text-primary underline">privacy@cvlingo.com</a>
          </p>

          <h2 className="text-xl font-semibold">Cookies</h2>
          <p>
            We use essential cookies only to keep the platform functioning. No tracking or advertising cookies are used.
          </p>

          <h2 className="text-xl font-semibold">Changes to This Policy</h2>
          <p>
            We may update this policy as the platform grows. Changes will be posted on this page.
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
