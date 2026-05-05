import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
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
    return tab === "native" ? result.native : result.english;
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
          body * { visibility: hidden; }
          #cv-print, #cv-print * { visibility: visible; }
          #cv-print { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; }
          .no-print { display: none !important; }
        }
      `}</style>

      <section className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="no-print mb-6 flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold sm:text-3xl">Your CV is ready</h1>
            <Link to="/build" className="text-sm font-medium text-primary hover:opacity-80">
              Edit answers
            </Link>
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
              <ReactMarkdown>{activeText}</ReactMarkdown>
            </div>
          </article>

          <div className="no-print mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                const langForFile = tab === "english" ? "English" : result.language || "Native";
                const safeName = (name || "CV").trim();
                const filename = `${safeName} - CVLingo - ${langForFile}`;
                const previousTitle = document.title;
                document.title = filename;
                window.print();
                setTimeout(() => {
                  document.title = previousTitle;
                }, 1000);
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

export const Route = createFileRoute("/result")({
  component: ResultPage,
  head: () => ({
    meta: [
      { title: "Your CV — CVLingo" },
      { name: "description", content: "Your professional UK CV, ready to download and share." },
    ],
  }),
});
