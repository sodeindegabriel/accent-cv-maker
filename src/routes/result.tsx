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

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`Here is my CV:\n\n${activeText}`)}`;
  const shareLink = typeof window !== "undefined" ? `${window.location.origin}/build` : "/build";
  const friendShareHref = `https://wa.me/?text=${encodeURIComponent(
    `Know someone who needs a CV? CVLingo helps you build a UK CV in your own language. ${shareLink}`,
  )}`;

  const nativeLabel = result.language ? `${result.language} CV` : "Native CV";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
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
          }
          #cv-print h1, #cv-print h2, #cv-print h3, #cv-print h4,
          #cv-print p, #cv-print li, #cv-print span, #cv-print strong, #cv-print em, #cv-print a {
            color: #000000 !important;
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
            <div className="prose prose-slate max-w-none prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 text-sm leading-6 sm:text-base">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{activeText}</ReactMarkdown>
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
  return s;
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
