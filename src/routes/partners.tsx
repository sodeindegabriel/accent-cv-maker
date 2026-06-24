import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import emailjs from "@emailjs/browser";
import { BridgeIcon } from "@/components/BridgeIcon";

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string | undefined;
// Set "From Name" to "CVLingo" in the EmailJS template dashboard for both templates
const AUTOREPLY_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_AUTOREPLY_TEMPLATE_ID as string | undefined;

type PartnerEntry = {
  orgName: string;
  orgType: string;
  orgTypeOther: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  website: string;
  memberCount: string;
  referralSource: string;
  timestamp: string;
};

const STORAGE_KEY = "cvlingo:partners";

function savePartner(entry: PartnerEntry) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? (JSON.parse(raw) as PartnerEntry[]) : [];
    all.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

async function notifyPartner(entry: PartnerEntry) {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    console.warn("[notifyPartner] EmailJS env vars missing — skipping email send");
    return;
  }
  const subject = `New CVLingo Community Partner — ${entry.orgName}`;
  const typeLine = entry.orgType === "Other" && entry.orgTypeOther
    ? `Type: Other — ${entry.orgTypeOther}`
    : `Type: ${entry.orgType}`;
  const message = [
    `Organisation: ${entry.orgName}`,
    typeLine,
    `Contact: ${entry.name}`,
    `Role: ${entry.role}`,
    `Email: ${entry.email}`,
    `Phone: ${entry.phone}`,
    `Website: ${entry.website}`,
    `Members: ${entry.memberCount}`,
    `Heard via: ${entry.referralSource}`,
    `Time: ${entry.timestamp}`,
  ].join("\n");
  try {
    await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      {
        to_email: "cvlingouk@gmail.com",
        subject,
        message,
        name: entry.name,
        email: entry.email,
      },
      { publicKey: PUBLIC_KEY },
    );
  } catch (err) {
    console.error("[notifyPartner] EmailJS send failed", err);
  }
}

async function sendAutoReply(entry: PartnerEntry) {
  if (!SERVICE_ID || !AUTOREPLY_TEMPLATE_ID || !PUBLIC_KEY) {
    // Auto-reply template not configured — skip gracefully
    return;
  }
  try {
    await emailjs.send(
      SERVICE_ID,
      AUTOREPLY_TEMPLATE_ID,
      {
        to_email: entry.email,
        to_name: entry.name,
        org_name: entry.orgName,
      },
      { publicKey: PUBLIC_KEY },
    );
  } catch (err) {
    console.error("[sendAutoReply] EmailJS send failed", err);
  }
}

const benefits = [
  {
    icon: "🌍",
    title: "20 Languages and more",
    body: "Your members can build CVs in their native language — no English needed",
  },
  {
    icon: "💼",
    title: "Free for Your Members",
    body: "Every CV build is completely free for the people you support. Always.",
  },
  {
    icon: "📊",
    title: "Track Your Impact",
    body: "See how many of your members have built CVs through your referral link",
  },
];

const testimonials = [
  {
    quote:
      "CVLingo helped 27 of our members create professional CVs in their own language. Eight have already found work.",
    author: "Support Worker, Refugee Charity, Bristol",
  },
  {
    quote:
      "Simple, free, and it actually works. Our Arabic and Somali speaking clients could use it without any help from staff.",
    author: "Employment Advisor, Community Centre, Birmingham",
  },
  {
    quote:
      "We recommended CVLingo at our jobs fair and the feedback was overwhelmingly positive. Will be using it again.",
    author: "Volunteer Coordinator, Migrants Support Group, London",
  },
];

function PartnersPage() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [orgType, setOrgType] = useState("Charity");
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
    const el = document.getElementById("partner-form");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const entry: PartnerEntry = {
      orgName: String(fd.get("orgName") ?? "").trim(),
      orgType: String(fd.get("orgType") ?? ""),
      orgTypeOther: String(fd.get("orgTypeOther") ?? "").trim(),
      name: String(fd.get("name") ?? "").trim(),
      role: String(fd.get("role") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim(),
      phone: String(fd.get("phone") ?? "").trim(),
      website: String(fd.get("website") ?? "").trim(),
      memberCount: String(fd.get("memberCount") ?? ""),
      referralSource: String(fd.get("referralSource") ?? "").trim(),
      timestamp: new Date().toISOString(),
    };
    if (!entry.orgName || !entry.name || !entry.email || !entry.phone) return;
    setSubmitting(true);
    savePartner(entry);
    await notifyPartner(entry);
    await sendAutoReply(entry);
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
            <BridgeIcon className="h-7 w-7" />
            <span className="font-serif text-2xl">CVLingo</span>
          </Link>
          <button
            onClick={scrollToForm}
            className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md"
          >
            Apply to Partner
          </button>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto max-w-5xl px-4 pt-14 pb-10 text-center sm:px-6 lg:px-8">
        <h1 className="font-serif text-4xl sm:text-5xl">Partner with CVLingo</h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Help your community get hired. We handle the CV — you open the door.
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
            Apply to Partner
          </button>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="bg-secondary/40 py-14">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Trusted by community organisations supporting immigrants across the UK
          </p>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {testimonials.map((t) => (
              <figure key={t.author} className="rounded-2xl border border-border bg-card p-6">
                <blockquote className="text-sm leading-relaxed text-foreground">
                  "{t.quote}"
                </blockquote>
                <figcaption className="mt-4 text-xs font-medium text-muted-foreground">
                  — {t.author}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* FORM */}
      <section id="partner-form" className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8 scroll-mt-24">
        <div className="text-center">
          <h2 className="font-serif text-3xl text-foreground">Ready to partner with us?</h2>
          <p className="mt-3 text-base text-muted-foreground">
            Fill in the form below and we will be in touch within 2 working days.
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
            <h3 className="mt-4 font-serif text-2xl font-semibold text-emerald-900">Application Received! 🎉</h3>
            <p className="mt-3 text-base text-emerald-800">
              Thank you for applying to partner with CVLingo. We will be in touch within 2 working days at{" "}
              <span className="font-semibold">{submittedEmail}</span>.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-5 rounded-2xl border border-border bg-card p-6">
            <div>
              <label className={labelCls} htmlFor="orgName">Organisation name *</label>
              <input id="orgName" name="orgName" required className={inputCls} />
            </div>

            <div>
              <label className={labelCls} htmlFor="orgType">Organisation type</label>
              <select
                id="orgType"
                name="orgType"
                className={inputCls}
                value={orgType}
                onChange={(e) => setOrgType(e.target.value)}
              >
                <option>Charity</option>
                <option>NGO</option>
                <option>Refugee Support</option>
                <option>Job Centre</option>
                <option>Council</option>
                <option>Other</option>
              </select>
            </div>

            {orgType === "Other" && (
              <div>
                <label className={labelCls} htmlFor="orgTypeOther">
                  Please tell us more about your organisation
                </label>
                <input
                  id="orgTypeOther"
                  name="orgTypeOther"
                  placeholder="Describe your organisation type"
                  className={inputCls}
                />
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className={labelCls} htmlFor="name">Full name *</label>
                <input id="name" name="name" required className={inputCls} />
              </div>
              <div>
                <label className={labelCls} htmlFor="role">Your role / title</label>
                <input id="role" name="role" className={inputCls} />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className={labelCls} htmlFor="email">Email address *</label>
                <input id="email" name="email" type="email" required className={inputCls} />
              </div>
              <div>
                <label className={labelCls} htmlFor="phone">Phone number *</label>
                <input id="phone" name="phone" type="tel" required className={inputCls} />
              </div>
            </div>

            <div>
              <label className={labelCls} htmlFor="website">Website</label>
              <input id="website" name="website" type="url" placeholder="https://" className={inputCls} />
            </div>

            <div>
              <label className={labelCls} htmlFor="memberCount">How many members could benefit?</label>
              <select id="memberCount" name="memberCount" className={inputCls} defaultValue="Under 50">
                <option>Under 50</option>
                <option>50-200</option>
                <option>200-500</option>
                <option>500+</option>
              </select>
            </div>

            <div>
              <label className={labelCls} htmlFor="referralSource">How did you hear about CVLingo?</label>
              <input id="referralSource" name="referralSource" className={inputCls} />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Apply for Partnership"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

export const Route = createFileRoute("/partners")({
  component: PartnersPage,
  head: () => ({
    meta: [
      { title: "Community Partners — CVLingo" },
      {
        name: "description",
        content:
          "Become a CVLingo Community Partner. Free CV building tools for charities, NGOs, refugee support, councils, and job centres.",
      },
    ],
  }),
});
