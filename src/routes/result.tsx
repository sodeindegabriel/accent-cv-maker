import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { GeneratedCV } from "@/utils/generateCV";

function ResultPage() {
  const navigate = useNavigate();
  const [result, setResult] = useState<GeneratedCV | null>(null);
  const [name, setName] = useState<string>("");
  const [tab, setTab] = useState<"native" | "english">("native");
  const [copied, setCopied] = useState(false);

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

  const activeText = useMemo(() => {
    if (!result) return "";
    const raw = tab === "native" ? result.native : result.english;
    return normalizeMarkdown(raw);
  }, [result, tab]);

  if (!result) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const plainText = stripMarkdown(activeText);
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`Here is my CV:\n\n${plainText}`)}`;
  const shareLink = typeof window !== "undefined" ? `${window.location.origin}/build` : "/build";
  const friendShareHref = `https://wa.me/?text=${encodeURIComponent(
    `Know someone who needs a CV? CVLingo helps you build a UK CV in your own language. ${shareLink}`,
  )}`;

  const nativeLabel = result.language ? `${result.language} CV` : "Native CV";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <style>{`
        #cv-print h1.cv-name {
          text-align: center;
          font-size: 2rem;
          font-weight: 700;
          margin: 0 0 0.5rem 0;
          letter-spacing: -0.01em;
        }
        #cv-print .cv-contact {
          text-align: center;
          font-size: 0.95rem;
          color: #334155;
          margin: 0 0 0.75rem 0;
          padding-bottom: 1rem;
          border-bottom: 1px solid #e2e8f0;
        }
        #cv-print .cv-contact span + span::before {
          content: " • ";
          color: #94a3b8;
          margin: 0 0.4rem;
        }
        #cv-print h2 {
          margin-top: 1.75rem !important;
          margin-bottom: 0.75rem !important;
          padding-bottom: 0.35rem !important;
          border-bottom: 1px solid #e2e8f0 !important;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-size: 1.05rem;
          font-weight: 700;
        }
        #cv-print h2:first-child { margin-top: 0 !important; }
        #cv-print p { margin: 0.5rem 0; line-height: 1.65; }
        #cv-print ul, #cv-print ol { margin: 0.5rem 0 0.75rem 0; padding-left: 1.4rem; }
        #cv-print li { margin: 0.3rem 0; line-height: 1.6; }
        #cv-print li + li { margin-top: 0.35rem; }
        #cv-print h3 { margin-top: 1rem; margin-bottom: 0.25rem; }
        #cv-print .cv-watermark {
          margin-top: 2.5rem;
          padding-top: 1rem;
          border-top: 1px solid #e2e8f0;
          text-align: center;
          font-size: 0.8rem;
          color: #94a3b8;
          letter-spacing: 0.08em;
        }
        @media print {
          @page { size: A4; margin: 14mm; }
          html, body { background: #ffffff !important; }
          body * { visibility: hidden !important; }
          #cv-print, #cv-print * {
            visibility: visible !important;
            color: #000000 !important;
            background: #ffffff !important;
            box-shadow: none !important;
          }
          #cv-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            margin: 0;
            border: none !important;
            display: block !important;
            font-size: 11pt;
            line-height: 1.55;
          }
          #cv-print h1.cv-name { font-size: 22pt; margin-bottom: 6pt; }
          #cv-print .cv-contact {
            font-size: 10.5pt;
            border-bottom: 1px solid #cbd5e1 !important;
            padding-bottom: 8pt;
            margin-bottom: 14pt;
          }
          #cv-print h2 {
            font-size: 12pt;
            margin-top: 18pt !important;
            margin-bottom: 8pt !important;
            padding-bottom: 4pt !important;
            border-bottom: 1px solid #cbd5e1 !important;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            page-break-after: avoid;
          }
          #cv-print h3 { page-break-after: avoid; }
          #cv-print p, #cv-print li { page-break-inside: avoid; }
          #cv-print ul, #cv-print ol { padding-left: 18pt; }
          #cv-print li { margin: 3pt 0; }
          #cv-print .cv-watermark {
            margin-top: 20pt;
            padding-top: 8pt;
            border-top: 1px solid #cbd5e1 !important;
            color: #64748b !important;
            font-size: 9pt;
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

          <article
            id="cv-print"
            className="rounded-2xl border border-border bg-white p-6 text-slate-900 shadow-sm sm:p-10"
            style={{ minHeight: "60vh" }}
          >
            <div className="max-w-none text-[15px] leading-relaxed text-slate-900 sm:text-base">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => (
                    <h1 className="mb-3 mt-2 text-3xl font-bold tracking-tight text-slate-900">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="mb-2 mt-6 border-b border-slate-200 pb-1 text-xl font-semibold uppercase tracking-wide text-slate-900">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="mb-1 mt-4 text-base font-semibold text-slate-900">{children}</h3>
                  ),
                  h4: ({ children }) => (
                    <h4 className="mb-1 mt-3 text-sm font-semibold text-slate-900">{children}</h4>
                  ),
                  p: ({ children }) => (
                    <p className="my-2 whitespace-pre-line text-slate-800">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="my-2 list-disc space-y-1 pl-6 text-slate-800">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="my-2 list-decimal space-y-1 pl-6 text-slate-800">{children}</ol>
                  ),
                  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
                  em: ({ children }) => <em className="italic">{children}</em>,
                  hr: () => <hr className="my-4 border-slate-200" />,
                  a: ({ children, href }) => (
                    <a href={href} className="text-blue-700 underline">{children}</a>
                  ),
                }}
              >
                {activeText}
              </ReactMarkdown>
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
                // Wait for the CV content to be fully painted before opening the print dialog
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
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-xl border border-border bg-background px-5 py-3 font-medium text-foreground transition hover:bg-muted"
            >
              {copied ? "Copied!" : "Copy to clipboard"}
            </button>
          </div>

          <section className="no-print mt-10 rounded-2xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">Help a friend</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Know someone who needs a CV? Send them this link.
            </p>
            <a
              href={friendShareHref}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Share CVLingo
            </a>
          </section>
        </div>
      </section>
    </main>
  );
}

function normalizeMarkdown(input: string): string {
  if (!input) return "";
  let s = input.replace(/\r\n/g, "\n");
  // Strip surrounding code fences if the model wrapped output
  s = s.replace(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i, "$1");
  // Trim spaces inside bold/italic delimiters: "** Text **" -> "**Text**"
  s = s.replace(/\*\*\s+([^*\n]+?)\s+\*\*/g, "**$1**");
  s = s.replace(/\*\*\s+([^*\n]+?)\*\*/g, "**$1**");
  s = s.replace(/\*\*([^*\n]+?)\s+\*\*/g, "**$1**");
  // Ensure ATX headings have a space after #
  s = s.replace(/^(#{1,6})([^#\s])/gm, "$1 $2");
  // Ensure blank line before headings
  s = s.replace(/([^\n])\n(#{1,6} )/g, "$1\n\n$2");
  // Split contact details lines (Phone/Email/Location/Right to work) onto their own lines.
  // The model often emits "Phone: 123 | Email: a@b | Location: London" on a single line.
  const contactLabels = "(Phone|Tel|Telephone|Mobile|Email|E-mail|Location|City|Address|Right to [Ww]ork|Right-to-[Ww]ork)";
  s = s.replace(
    new RegExp(`(\\S)\\s*[•·\\|‧/–—-]\\s+(?=${contactLabels}\\s*:)`, "g"),
    "$1  \n",
  );
  // Also handle ", " separating contact fields when both sides look like labelled values
  s = s.replace(
    new RegExp(`(\\S),\\s+(?=${contactLabels}\\s*:)`, "g"),
    "$1  \n",
  );
  return s;
}

function stripMarkdown(input: string): string {
  if (!input) return "";
  let s = input.replace(/\r\n/g, "\n");
  // Remove code fences
  s = s.replace(/```[a-z]*\n?/gi, "").replace(/```/g, "");
  // Headings: drop leading #'s
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  // Bold/italic markers
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, "$1");
  s = s.replace(/\*\*(.+?)\*\*/g, "$1");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1$2");
  s = s.replace(/__(.+?)__/g, "$1");
  s = s.replace(/(^|[^_])_([^_\n]+)_/g, "$1$2");
  // Bullet lists -> dashes
  s = s.replace(/^\s*[-*+]\s+/gm, "- ");
  // Numbered lists keep as is but trim
  s = s.replace(/^\s*(\d+)\.\s+/gm, "$1. ");
  // Horizontal rules
  s = s.replace(/^\s*([-*_])\1{2,}\s*$/gm, "");
  // Links [text](url) -> text (url)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
  // Inline code
  s = s.replace(/`([^`]+)`/g, "$1");
  // Collapse 3+ newlines
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

const editSections: { step: number; label: string }[] = [
  { step: 1, label: "Language" },
  { step: 2, label: "Job Type" },
  { step: 3, label: "Personal Details" },
  { step: 4, label: "Experience" },
  { step: 5, label: "Skills & Availability" },
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
