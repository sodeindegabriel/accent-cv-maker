import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { t } from "@/lib/buildTranslations";
import type { GeneratedCV } from "@/utils/generateCV";
import {
  addCandidate,
  hasSubmittedThisSession,
  isValidEmail,
  type CandidatePoolEntry,
} from "@/lib/candidatePool";
import { notifyCandidate } from "@/lib/notifyCandidate";


function ResultPage() {
  const navigate = useNavigate();
  const [result, setResult] = useState<GeneratedCV | null>(null);
  const [name, setName] = useState<string>("");
  const [langCode, setLangCode] = useState<string>("en");
  const [tab, setTab] = useState<"native" | "english">("native");
  const [downloading, setDownloading] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [poolConsentGiven] = useState<boolean>(() => {
    try {
      const raw = sessionStorage.getItem("cvlingo:input");
      if (raw) {
        const parsed = JSON.parse(raw);
        // Hide card when user made an explicit choice (true OR false) in Step 7
        return parsed?.candidatePoolConsent != null;
      }
    } catch { /* ignore */ }
    return false;
  });

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
        setLangCode(parsed?.languageCode ?? "en");
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
    setTab(isEnglishOnly ? "english" : "native");
  }, [isEnglishOnly]);

  const uiLang = tab === "english" ? "en" : langCode;

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

  const downloadPdf = async (whichTab: "native" | "english") => {
    setDownloading(true);
    setShowPdfModal(false);
    const langForFile = whichTab === "english" ? "English" : result.language || "Native";
    const safeName = (name || "CV").replace(/[^\w\s-]/g, "").trim();
    const filename = `${safeName} - CVLingo - ${langForFile}.pdf`;
    const htmlContent = sanitizeCvHtml(whichTab === "native" ? result.native : result.english);
    const el = document.createElement("div");
    el.innerHTML = htmlContent;
    el.style.cssText = "position:absolute;visibility:hidden;left:-9999px;top:-9999px;";
    document.body.appendChild(el);
    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W = 210; const ML = 18; const MR = 18; const CW = W - ML - MR;
      let y = 22;
      const newPageIfNeeded = (h: number) => { if (y + h > 282) { pdf.addPage(); y = 18; } };
      const cvName = el.querySelector(".cv-name")?.textContent?.trim() ?? "";
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(26); pdf.setTextColor(26, 26, 26);
      pdf.splitTextToSize(cvName, CW).forEach((line: string) => { pdf.text(line, W / 2, y, { align: "center" }); y += 10; });
      y += 3;
      const cvContact = el.querySelector(".cv-contact")?.textContent?.trim() ?? "";
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(10); pdf.setTextColor(107, 114, 128);
      pdf.splitTextToSize(cvContact, CW).forEach((line: string) => { pdf.text(line, W / 2, y, { align: "center" }); y += 6; });
      y += 8;
      el.querySelectorAll(".cv-section").forEach((section) => {
        newPageIfNeeded(14);
        pdf.setDrawColor(220, 220, 220); pdf.line(ML, y, W - MR, y); y += 5;
        const heading = section.querySelector("h2")?.textContent?.trim() ?? "";
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(13); pdf.setTextColor(13, 110, 110);
        pdf.text(heading, ML, y); y += 6;
        section.querySelectorAll("p").forEach((p) => {
          if (p.closest(".cv-job") || p.closest(".cv-edu")) return;
          const txt = p.textContent?.trim() ?? ""; if (!txt) return;
          newPageIfNeeded(6); pdf.setFont("helvetica", "normal"); pdf.setFontSize(11); pdf.setTextColor(26, 26, 26);
          pdf.splitTextToSize(txt, CW).forEach((line: string) => { newPageIfNeeded(6); pdf.text(line, ML, y); y += 6; }); y += 3;
        });
        section.querySelectorAll(".cv-job").forEach((job) => {
          newPageIfNeeded(8);
          const jobP = job.querySelector("p");
          if (jobP) {
            const titleText = jobP.querySelector("strong")?.textContent?.trim() ?? "";
            const dateText = jobP.querySelector(".cv-date")?.textContent?.trim() ?? "";
            let companyText = "";
            jobP.childNodes.forEach((node) => { if (node.nodeType === Node.TEXT_NODE) companyText += node.textContent ?? ""; });
            companyText = companyText.trim();
            pdf.setFontSize(11); pdf.setFont("helvetica", "bold"); pdf.setTextColor(26, 26, 26);
            const titleW = pdf.getTextWidth(titleText + " ");
            pdf.text(titleText, ML, y); pdf.setFont("helvetica", "normal");
            if (companyText) pdf.text(companyText, ML + titleW, y);
            if (dateText) { pdf.setTextColor(107, 114, 128); pdf.text(dateText, W - MR, y, { align: "right" }); pdf.setTextColor(26, 26, 26); }
            y += 6;
          }
          job.querySelectorAll("li").forEach((li) => {
            const txt = li.textContent?.trim() ?? ""; if (!txt) return;
            newPageIfNeeded(6); pdf.setFont("helvetica", "normal"); pdf.setFontSize(11); pdf.setTextColor(26, 26, 26);
            pdf.text("•", ML + 1, y);
            pdf.splitTextToSize(txt, CW - 5).forEach((line: string) => { newPageIfNeeded(6); pdf.text(line, ML + 5, y); y += 6; });
          });
          y += 2;
        });
        section.querySelectorAll(".cv-edu").forEach((edu) => {
          newPageIfNeeded(8);
          const eduP = edu.querySelector("p");
          if (eduP) {
            const qualText = eduP.querySelector("strong")?.textContent?.trim() ?? "";
            const dateText = eduP.querySelector(".cv-date")?.textContent?.trim() ?? "";
            pdf.setFontSize(11); pdf.setFont("helvetica", "bold"); pdf.setTextColor(26, 26, 26);
            pdf.text(qualText, ML, y);
            if (dateText) { pdf.setTextColor(107, 114, 128); pdf.text(dateText, W - MR, y, { align: "right" }); }
            y += 6;
            let instText = "";
            eduP.childNodes.forEach((node) => { if (node.nodeType === Node.TEXT_NODE) instText += node.textContent ?? ""; });
            instText = instText.trim();
            if (instText) { pdf.setFont("helvetica", "normal"); pdf.setTextColor(107, 114, 128); pdf.text(instText, ML, y); y += 6; }
          }
          y += 1;
        });
        section.querySelectorAll("ul > li").forEach((li) => {
          if (li.closest(".cv-job") || li.closest(".cv-edu")) return;
          const strongEl = li.querySelector("strong");
          newPageIfNeeded(6); pdf.setFontSize(11); pdf.setTextColor(26, 26, 26);
          if (strongEl) {
            const label = strongEl.textContent?.trim() ?? "";
            let desc = "";
            li.childNodes.forEach((node) => { if (node !== strongEl && node.nodeType === Node.TEXT_NODE) desc += node.textContent ?? ""; });
            desc = desc.trim();
            pdf.setFont("helvetica", "bold"); pdf.text("• " + label, ML + 1, y); y += 6;
            if (desc) { pdf.setFont("helvetica", "normal"); pdf.splitTextToSize(desc, CW - 5).forEach((line: string) => { newPageIfNeeded(6); pdf.text(line, ML + 5, y); y += 6; }); }
            y += 2;
          } else {
            const txt = li.textContent?.trim() ?? ""; if (!txt) return;
            pdf.setFont("helvetica", "normal"); pdf.text("•", ML + 1, y);
            pdf.splitTextToSize(txt, CW - 5).forEach((line: string) => { newPageIfNeeded(6); pdf.text(line, ML + 5, y); y += 6; });
            y += 1;
          }
        });
        y += 4;
      });
      newPageIfNeeded(10);
      pdf.setDrawColor(220, 220, 220); pdf.line(ML, y, W - MR, y); y += 5;
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(180, 180, 180);
      pdf.text("Created with CVLingo · cvlingo.com", W / 2, y, { align: "center" });
      pdf.save(filename);
    } catch (err) {
      console.error("PDF error:", err);
      alert("PDF error: " + (err as Error).message);
    } finally {
      document.body.removeChild(el);
      setDownloading(false);
    }
  };

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
            <h1 className="text-2xl font-semibold sm:text-3xl">{t(uiLang, "cvReady")}</h1>
            <EditAnswersMenu lang={uiLang} />
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

          {!poolConsentGiven && <CandidatePoolCard />}

          <div className="no-print mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={downloading}
              onClick={() => {
                if (isEnglishOnly) {
                  downloadPdf("english");
                } else {
                  setShowPdfModal(true);
                }
              }}
              className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {downloading ? "Preparing PDF…" : "Download PDF"}
            </button>
            {/* PDF language picker modal */}
            {showPdfModal && !isEnglishOnly && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
                  <h2 className="mb-1 text-lg font-semibold text-foreground">{t(uiLang, "downloadTitle")}</h2>
                  <p className="mb-5 text-sm text-muted-foreground">{t(uiLang, "downloadSubtitle")}</p>
                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => downloadPdf("native")}
                      className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground transition hover:opacity-90"
                    >
                      {nativeLabel}
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadPdf("english")}
                      className="rounded-xl border border-border bg-background px-5 py-3 font-semibold text-foreground transition hover:bg-muted"
                    >
                      English CV
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPdfModal(false)}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      {t(uiLang, "downloadCancel")}
                    </button>
                  </div>
                </div>
              </div>
            )}
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


          <section className="no-print mt-10 rounded-2xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">Share CVLingo</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(uiLang, "shareMessage")}
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

function EditAnswersMenu({ lang = "en" }: { lang?: string }) {
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
        {t(lang, "editAnswers")} ▾
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
        >
          {([
            { step: 1, key: "editLanguage" },
            { step: 2, key: "editJobType" },
            { step: 3, key: "editPersonalDetails" },
            { step: 4, key: "editExperience" },
            { step: 5, key: "editEducation" },
            { step: 6, key: "editSkills" },
          ] as { step: number; key: Parameters<typeof t>[1] }[]).map((s) => (
            <button
              key={s.step}
              type="button"
              role="menuitem"
              onClick={() => goTo(s.step)}
              className="block w-full px-4 py-2 text-left text-sm text-foreground transition hover:bg-muted"
            >
              {t(lang, s.key)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CandidatePoolCard() {
  const [dismissed, setDismissed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cvEmail, setCvEmail] = useState<string>("");
  const [confirmedEmail, setConfirmedEmail] = useState<string | null>(null);

  useEffect(() => {
    if (hasSubmittedThisSession()) setSubmitted(true);
    try {
      const inputRaw = sessionStorage.getItem("cvlingo:input");
      if (inputRaw) {
        const parsed = JSON.parse(inputRaw);
        setCvEmail((parsed?.personalDetails?.email ?? "").trim());
      }
    } catch {
      /* ignore */
    }
  }, []);

  if (dismissed) return null;

  if (submitted) {
    return (
      <section className="no-print mt-8 rounded-2xl border border-border bg-card p-6 text-center">
        <p className="text-lg font-semibold text-foreground">You're in the pool 🎉</p>
        <p className="mt-2 text-sm text-muted-foreground">
          We'll be in touch when employers are looking for someone like you.
        </p>
      </section>
    );
  }

  const validEmail = isValidEmail(email);
  const typedEmail = email.trim();
  const emailsMismatch =
    validEmail && cvEmail && typedEmail.toLowerCase() !== cvEmail.toLowerCase();
  const needsConfirmation = !!emailsMismatch && !confirmedEmail;
  const canSubmit = validEmail && !needsConfirmation;

  const doSubmit = (finalEmail: string) => {
    try {
      const inputRaw = sessionStorage.getItem("cvlingo:input");
      const input = inputRaw ? JSON.parse(inputRaw) : {};
      let referralSource: string | null = null;
      try {
        referralSource =
          localStorage.getItem("cvlingo_referral") ||
          localStorage.getItem("cvlingo:referral") ||
          localStorage.getItem("referral") ||
          localStorage.getItem("referralCode") ||
          null;
      } catch {
        /* ignore */
      }
      const entry: CandidatePoolEntry = {
        email: finalEmail.trim(),
        name: input?.personalDetails?.name ?? "",
        jobTypes: Array.isArray(input?.jobTypes) ? input.jobTypes : [],
        language: input?.language ?? "",
        rightToWork: input?.personalDetails?.rightToWork ?? "",
        city: input?.personalDetails?.city ?? "",
        postcode: input?.personalDetails?.postcode
          ? String(input.personalDetails.postcode)
          : null,
        referralSource,
        timestamp: new Date().toISOString(),
      };
      addCandidate(entry);
      void notifyCandidate(entry);
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validEmail) {
      setError("Please enter a valid email address");
      return;
    }
    if (needsConfirmation) return;
    doSubmit(confirmedEmail ?? typedEmail);
  };

  return (
    <section className="no-print mt-8 rounded-2xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold text-foreground">Want employers to find you?</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Join the CVLingo candidate pool — employers hiring for your role type can view your CV and contact you directly. Free, always.
      </p>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
            setConfirmedEmail(null);
          }}
          placeholder="Enter your email address"
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary"
          aria-label="Email address"
        />
        {email.length > 0 && !validEmail && (
          <p className="text-sm text-destructive">Please enter a valid email address</p>
        )}
        {emailsMismatch && (
          <div className="rounded-xl border border-border bg-muted/40 p-3">
            <p className="text-sm text-foreground">
              This is different from the email on your CV (the one in Step 3). Which one should we use?
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => doSubmit(typedEmail)}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                Use this email
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail(cvEmail);
                  setConfirmedEmail(cvEmail);
                  doSubmit(cvEmail);
                }}
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
              >
                Use my CV email
              </button>
            </div>
          </div>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          Add me to the candidate pool
        </button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>
      <p className="mt-3 text-xs text-muted-foreground">
        We will never share your email without your permission. Unsubscribe anytime.
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="mt-3 text-sm text-muted-foreground underline hover:text-foreground"
      >
        No thanks, just keep my CV
      </button>
    </section>
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
