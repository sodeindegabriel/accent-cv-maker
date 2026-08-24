import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import emailjs from "@emailjs/browser";

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string | undefined;

type EmployerEntry = {
  companyName: string;
  contactName: string;
  email: string;
  rolesHiring: string;
  timestamp: string;
};

const STORAGE_KEY = "cvlingo:employers";

function saveEmployer(entry: EmployerEntry) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? (JSON.parse(raw) as EmployerEntry[]) : [];
    all.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

async function notifyEmployer(entry: EmployerEntry) {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    console.warn("[notifyEmployer] EmailJS env vars missing — skipping email send");
    return;
  }
  const subject = `New CVLingo Employer Waitlist — ${entry.companyName}`;
  const message = [
    `Company: ${entry.companyName}`,
    `Contact: ${entry.contactName}`,
    `Email: ${entry.email}`,
    `Roles hiring for: ${entry.rolesHiring}`,
    `Time: ${entry.timestamp}`,
  ].join("\n");
  try {
    await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      {
        to_email: "hello@cvlingo.com",
        subject,
        message,
        name: entry.contactName,
      },
      { publicKey: PUBLIC_KEY },
    );
  } catch (err) {
    console.error("[notifyEmployer] EmailJS send failed", err);
  }
}

const benefits = [
  {
    icon: "🌍",
    title: "Ready, Motivated Candidates",
    body: "Job seekers across 21 languages, already building professional CVs and actively looking for work.",
  },
  {
    icon: "🆓",
    title: "No Cost to Join",
    body: "Reserve your spot on our early access waitlist at no cost. We'll be in touch as the employer platform develops.",
  },
  {
    icon: "🤝",
    title: "Community-Backed",
    body: "Many candidates come through trusted community partners, like Wiltshire Refugee Network.",
  },
];

function EmployersPage() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const thankYouRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (submitted && thankYouRef.current) {
      thankYouRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [submitted]);

  const scrollToForm = () => {
    const el = document.getElementById("employer-form");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const entry: EmployerEntry = {
      companyName: String(fd.get("companyName") ?? "").trim(),
      contactName: String(fd.get("contactName") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim(),
      rolesHiring: String(fd.get("rolesHiring") ?? "").trim(),
      timestamp: new Date().toISOString(),
    };
    if (!entry.companyName || !entry.contactName || !entry.email) return;
    setSubmitting(true);
    saveEmployer(entry);
    await notifyEmployer(entry);
    setSubmittedEmail(entry.email);
    setSubmitting(false);
    setSubmitted(true);
  };

  const inputCls =
    "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
  const labelCls = "mb-1.5 block text-sm font-medium text-foreground";

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Sticky navbar */}
      <header
        className={`sticky top-0 z-50 w-full transition-all ${
          scrolled ? "bg-white/90 backdrop-blur border-b border-border" : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2 text-primary transition hover:opacity-80">
            <img src="/cvlingo-logo.svg" alt="CVLingo" className="h-10 w-10 rounded-full" />
          </Link>
          <button
            onClick={scrollToForm}
            className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md"
          >
            Join the Waitlist
          </button>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto max-w-5xl px-4 pt-14 pb-10 text-center sm:px-6 lg:px-8">
        <h1 className="font-serif text-4xl sm:text-5xl">Hire from CVLingo's talent pool</h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Access job-ready candidates across 21 languages — already screened by role, right-to-work status, and availability.
        </p>
      </section>

      {/* BENEFITS */}
      <section className="mx-auto max-w-5xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="grid gap-5 sm:grid-cols-3">
          {benefits.map((b) => (
            <div key={b.title} className="rounded-2xl border border-border bg-card p-6">
              <div className="text-3xl">{b.icon}</div>
              <h3 className="mt-3 font-serif text-xl text-foreground">{b.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{b.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <button
            onClick={scrollToForm}
            className="inline-flex items-center rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md"
          >
            Join the Waitlist
          </button>
        </div>
      </section>

      {/* FORM */}
      <section id="employer-form" className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8 scroll-mt-24">
        <div className="text-center">
          <h2 className="font-serif text-3xl text-foreground">Ready to hire from CVLingo?</h2>
          <p className="mt-3 text-base text-muted-foreground">
            Join the waitlist and we will be in touch as we build out the employer platform.
          </p>
        </div>

        {submitted ? (
          <div
            ref={thankYouRef}
            className="mt-8 rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-8 text-center shadow-md"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="mt-4 font-serif text-2xl font-semibold text-emerald-900">You're on the list! 🎉</h3>
            <p className="mt-3 text-base text-emerald-800">
              Thanks for your interest in hiring through CVLingo. We will be in touch at{" "}
              <span className="font-semibold">{submittedEmail}</span> as the platform develops.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-5 rounded-2xl border border-border bg-card p-6">
            <div>
              <label className={labelCls} htmlFor="companyName">Company name *</label>
              <input id="companyName" name="companyName" required className={inputCls} />
            </div>

            <div>
              <label className={labelCls} htmlFor="contactName">Contact name *</label>
              <input id="contactName" name="contactName" required className={inputCls} />
            </div>

            <div>
              <label className={labelCls} htmlFor="email">Email address *</label>
              <input id="email" name="email" type="email" required className={inputCls} />
            </div>

            <div>
              <label className={labelCls} htmlFor="rolesHiring">What roles are you hiring for?</label>
              <textarea
                id="rolesHiring"
                name="rolesHiring"
                rows={3}
                placeholder="e.g. warehouse operatives, care assistants, kitchen staff..."
                className={`${inputCls} resize-none`}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Join the Waitlist"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

export const Route = createFileRoute("/employers")({
  component: EmployersPage,
  head: () => ({
    meta: [
      { title: "For Employers — CVLingo" },
      {
        name: "description",
        content:
          "Hire job-ready candidates across 21 languages. Join the CVLingo employer waitlist for free early access to our talent pool.",
      },
    ],
  }),
});
