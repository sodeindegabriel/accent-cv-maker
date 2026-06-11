import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { GeneratedCV } from "@/utils/generateCV";

function ResultPage() {
  const navigate = useNavigate();
  const [result, setResult] = useState<GeneratedCV | null>(null);
  const [name, setName] = useState<string>("");
  const [tab, setTab] = useState<"native" | "english">("native");

  useEffect(() => {
    const raw = sessionStorage.getItem("cvlingo:result");
    if (!raw) {
      navigate({ to: "/build" });
      return;
    }
    try {
      setResult(JSON.parse(raw) as GeneratedCV);
    } catch {
      navigate({ to: "/build" });
    }
    try {
      const inputRaw = sessionStorage.getItem("cvlingo:input");
      if (inputRaw) {
        const parsed = JSON.parse(inputRaw);
        setName(parsed?.personalDetails?.name ?? "");
      }
    } catch {
      /* ignore */
    }
  }, [navigate]);

  const activeHtml = useMemo(() => {
    if (!result) return "";
    return sanitizeCvHtml(tab === "native" ? result.native : result.english);
  }, [result, tab]);

  const lang = (result?.language || "").toLowerCase();
  const isEnglishOnly = !lang || lang === "english";

  useEffect(() => {
    if (isEnglishOnly) setTab("english");
  }, [isEnglishOnly]);

  if (!result) return null;


  const plainText = htmlToPlainText(activeHtml);
  const footer = "CV built with CVLingo — cvlingo.com";
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`Here is my CV:\n\n${plainText}\n\n${footer}`)}`;
  const emailSubject = `My CV — ${name || "CVLingo"}`;
  const emailBody = `${plainText}\n\n${footer}`;
  const emailHref = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
  const shareMessage =
    "I just built my CV using CVLingo — it translated it into English for me. If you need a UK CV, try it free: https://cvlingo.com";
  const whatsappShareHref = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
  const facebookShareHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
    "https://cvlingo.com",
  )}&quote=${encodeURIComponent(shareMessage)}`;
  const twitterShareHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}`;

  const nativeLabel = result.language ? `${result.language} CV` : "Native CV";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <style>{`
        #cv-print {
          max-width: 680px;
          margin: 0 auto;
          padding: 48px 48px 40px;
          background: #ffffff;
          color: #111827;
          font-family: "DM Sans", ui-sans-serif, system-ui, sans-serif;
        }
        #cv-print .cv-header { text-align: center; }
        #cv-print .cv-name {
          font-family: "DM Serif Display", ui-serif, Georgia, serif;
          font-size: 2.25rem;
          font-weight: 700;
          text-align: center;
          margin: 0 0 8px 0;
          color: #111827;
          letter-spacing: -0.01em;
        }
        #cv-print .cv-contact {
          text-align: center;
          color: #6B7280;
          font-size: 0.9rem;
          margin: 0;
        }
        #cv-print .cv-section {
          margin-top: 32px;
          border-top: 1px solid #E5E7EB;
          padding-top: 16px;
        }
        #cv-print .cv-section h2 {
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #0D6E6E;
          font-weight: 700;
          margin: 0 0 12px 0;
        }
        #cv-print .cv-job { margin-bottom: 16px; }
        #cv-print .cv-job p { margin: 0 0 6px 0; }
        #cv-print .cv-date {
          float: right;
          color: #6B7280;
          font-size: 0.85rem;
          font-weight: 400;
        }
        #cv-print .cv-section ul {
          padding-left: 20px;
          line-height: 1.8;
          margin: 0;
          list-style: disc;
        }
        #cv-print .cv-section li { margin-bottom: 4px; }
        #cv-print .cv-section p {
          line-height: 1.7;
          margin: 0 0 10px 0;
          color: #111827;
        }
        #cv-print strong { font-weight: 600; color: #111827; }
        #cv-print .cv-watermark {
          margin-top: 40px;
          padding-top: 16px;
          border-top: 1px solid #E5E7EB;
          text-align: center;
          font-size: 0.8rem;
          color: #9CA3AF;
          letter-spacing: 0.08em;
        }
        #cv-print .cv-watermark a {
          color: inherit;
          text-decoration: none;
        }
        @media print {
          @page { size: A4; margin: 18mm; }
          html, body { background: #ffffff !important; }
          body * { visibility: hidden !important; }
          #cv-print, #cv-print * {
            visibility: visible !important;
          }
          #cv-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: 100%;
            padding: 12px 16px;
            margin: 0;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <section className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="no-print mb-6 flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold sm:text-3xl">Your CV is ready</h1>
            <EditAnswersMenu />
          </div>

          {!isEnglishOnly && (
            <div className="no-print mb-4 inline-flex rounded-xl border border-border bg-card p-1">
              <button
                type="button"
                onClick={() => setTab("native")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  tab === "native" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                }`}
              >
                {nativeLabel}
              </button>
              <button
                type="button"
                onClick={() => setTab("english")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  tab === "english" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                }`}
              >
                English CV
              </button>
            </div>
          )}

          <article
            className="rounded-2xl border border-border bg-white shadow-sm"
            style={{ minHeight: "60vh" }}
          >
            <div id="cv-print">
              <div dangerouslySetInnerHTML={{ __html: activeHtml }} />
              <div className="cv-watermark">
                Created with <a href="https://cvlingo.com" target="_blank" rel="noreferrer">CVLingo · cvlingo.com</a>
              </div>
            </div>
          </article>

          <div className="no-print mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                const langForFile = tab === "english" ? "English" : result.language || "Native";
                const safeName = (name || "CV").trim();
                const filename = `${safeName} - CVLingo - ${langForFile}.pdf`;
                const previousTitle = document.title;
                document.title = filename;
                setTimeout(() => {
                  window.print();
                  setTimeout(() => {
                    document.title = previousTitle;
                  }, 1000);
                }, 300);
              }}
              className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Download PDF
            </button>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-secondary px-5 py-3 font-semibold text-secondary-foreground transition hover:opacity-90"
            >
              Share via WhatsApp
            </a>
            <a
              href={emailHref}
              className="rounded-xl border border-border bg-background px-5 py-3 font-semibold text-foreground transition hover:bg-muted"
            >
              Share via Email
            </a>
          </div>

          <CandidatePoolCard />


          <section className="no-print mt-10 rounded-2xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">Share CVLingo</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Know someone who needs a CV? Spread the word.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <a
                href={whatsappShareHref}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground transition hover:opacity-90"
              >
                Share on WhatsApp
              </a>
              <a
                href={facebookShareHref}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-secondary px-5 py-3 font-semibold text-secondary-foreground transition hover:opacity-90"
              >
                Share on Facebook
              </a>
              <a
                href={twitterShareHref}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-border bg-background px-5 py-3 font-semibold text-foreground transition hover:bg-muted"
              >
                Share on X
              </a>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

// Strip code fences and any stray markdown/script tags. Allow our CV HTML through.
function sanitizeCvHtml(input: string): string {
  if (!input) return "";
  let s = input.replace(/\r\n/g, "\n").trim();
  // Strip code fences if model wrapped output
  s = s.replace(/^```(?:html|HTML)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  // Remove dangerous tags
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  s = s.replace(/\son\w+\s*=\s*"[^"]*"/gi, "");
  s = s.replace(/\son\w+\s*=\s*'[^']*'/gi, "");
  // Strip stray markdown bold/heading markers in case the model slipped
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  return s.trim();
}

function htmlToPlainText(html: string): string {
  if (typeof document === "undefined") {
    return html.replace(/<[^>]+>/g, "").replace(/\s+\n/g, "\n").trim();
  }
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  // Add line breaks for block-level elements
  tmp.querySelectorAll("h1, h2, h3, p, li, div").forEach((el) => {
    el.append("\n");
  });
  tmp.querySelectorAll("li").forEach((el) => {
    el.prepend("- ");
  });
  const text = (tmp.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
  return text;
}

const editSections: { step: number; label: string }[] = [
  { step: 1, label: "Language" },
  { step: 2, label: "Job Type" },
  { step: 3, label: "Personal Details" },
  { step: 4, label: "Experience" },
  { step: 5, label: "Education" },
  { step: 6, label: "Skills & Availability" },
];

function EditAnswersMenu() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onClick = () => setOpen(false);
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [open]);

  const goTo = (step: number) => {
    try {
      sessionStorage.setItem("cvlingo:editStep", String(step));
    } catch {
      /* ignore */
    }
    navigate({ to: "/build" });
  };

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm font-medium text-primary hover:opacity-80"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Edit answers ▾
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
        >
          {editSections.map((s) => (
            <button
              key={s.step}
              type="button"
              role="menuitem"
              onClick={() => goTo(s.step)}
              className="block w-full px-4 py-2 text-left text-sm text-foreground transition hover:bg-muted"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/result")({
  component: ResultPage,
  head: () => ({
    meta: [
      { title: "Your CV — CVLingo" },
      { name: "description", content: "Your professional UK CV, ready to download and share." },
    ],
  }),
});
