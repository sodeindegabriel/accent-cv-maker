import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronDown, Copy, FileDown, Pencil, RefreshCw, X } from "lucide-react";
import { jsPDF } from "jspdf";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { t } from "@/lib/buildTranslations";
import type { CVData } from "@/lib/cv.functions";
import { generateCoverLetterServer, getCoverLetterQuotaServer, type CoverLetterQuota, type CoverLetterResult } from "@/lib/cover-letter.functions";

// ── Constants ─────────────────────────────────────────────────────────────────

const ADVERT_LIMIT = 8000;

const RTL_CODES = new Set(["ar", "ur", "fa", "ku"]);

// ── Types ─────────────────────────────────────────────────────────────────────

type CVWithData = {
  id: string;
  title: string;
  form_data: CVData;
};

type View = "form" | "result";

// ── Helpers ───────────────────────────────────────────────────────────────────

function isEnglishOnly(cvData: CVData | null) {
  if (!cvData) return true;
  const code = (cvData.languageCode || "").toLowerCase();
  const name = (cvData.language || "").toLowerCase();
  return code === "en" || name === "english";
}

async function downloadLetterPdf(text: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 20;
  const lineH = 6.5;
  const pageH = 297;
  const contentW = 210 - margin * 2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  let y = margin;
  for (const para of text.split("\n")) {
    const lines = para.trim() ? doc.splitTextToSize(para, contentW) as string[] : [""];
    for (const line of lines) {
      if (y + lineH > pageH - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += lineH;
    }
    y += 2;
  }
  doc.save("cover-letter.pdf");
}

async function downloadLetterWord(text: string) {
  const { Document, Packer, Paragraph, TextRun } = await import("docx");
  const children = text.split("\n").map(
    (line) =>
      new Paragraph({
        children: [new TextRun({ text: line, size: 24, font: "Calibri" })],
        spacing: { after: line.trim() ? 120 : 0 },
      }),
  );
  const doc = new Document({ sections: [{ properties: {}, children }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cover-letter.docx";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Route ─────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/cover-letter")({
  validateSearch: (search: Record<string, unknown>) => ({
    cv: typeof search.cv === "string" ? search.cv : undefined,
    letter: typeof search.letter === "string" ? search.letter : undefined,
  }),
  component: CoverLetterPage,
});

// ── Main component ────────────────────────────────────────────────────────────

function CoverLetterPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { cv: cvParam, letter: letterParam } = Route.useSearch();

  // ── State ──────────────────────────────────────────────────────────────────
  const [view, setView] = useState<View>("form");
  const [cvs, setCvs] = useState<CVWithData[]>([]);
  const [cvsLoading, setCvsLoading] = useState(true);
  const [selectedCvId, setSelectedCvId] = useState<string>("");

  // Form fields
  const [jobAdvert, setJobAdvert] = useState("");
  const [advertTrimmed, setAdvertTrimmed] = useState(false);
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [whyThisJob, setWhyThisJob] = useState("");
  const [explain, setExplain] = useState("");
  const [length, setLength] = useState<"short" | "standard">("standard");

  // Quota
  const [quota, setQuota] = useState<CoverLetterQuota | null>(null);
  const remaining = quota ? quota.limit - quota.used : null;

  // Generation
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Result
  const [result, setResult] = useState<CoverLetterResult | null>(null);
  const [tab, setTab] = useState<"english" | "native">("english");
  const [editText, setEditText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [wordLoading, setWordLoading] = useState(false);

  const resultRef = useRef<HTMLDivElement>(null);

  // Language for UI strings
  const selectedCv = cvs.find((c) => c.id === selectedCvId);
  const cvData = selectedCv?.form_data ?? null;
  const lang = cvData?.languageCode ?? "en";
  const englishOnly = isEnglishOnly(cvData);

  // ── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      try {
        sessionStorage.setItem("cvlingo:redirectAfterAuth", "/cover-letter");
      } catch { /* ignore */ }
      navigate({ to: "/build" });
    }
  }, [authLoading, user, navigate]);

  // ── Load user's CVs ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    void (async () => {
      setCvsLoading(true);
      const { data } = await supabase
        .from("cv_documents")
        .select("id, title, form_data")
        .eq("user_id", user.id)
        .not("form_data", "is", null)
        .order("created_at", { ascending: false });
      const list = (data ?? []) as CVWithData[];
      setCvs(list);
      // Pre-select from URL param or first CV
      if (cvParam && list.some((c) => c.id === cvParam)) {
        setSelectedCvId(cvParam);
      } else if (list.length > 0) {
        setSelectedCvId(list[0].id);
      }
      setCvsLoading(false);
    })();
  }, [user, cvParam]);

  // ── Fetch quota ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) return;
      const q = await getCoverLetterQuotaServer({ data: { accessToken: token } });
      setQuota(q);
    })();
  }, [user]);

  // ── Load saved letter from URL param ──────────────────────────────────────
  useEffect(() => {
    if (!user || !letterParam) return;
    void (async () => {
      const { data: row } = await supabase
        .from("cover_letters")
        .select("id, job_title, company, language, english_text, native_text, gaps")
        .eq("id", letterParam)
        .single();
      if (!row) return;
      const gaps = row.gaps as { english?: string[]; native?: string[] } | null;
      const savedResult: CoverLetterResult = {
        id: row.id as string,
        english: (row.english_text as string) ?? "",
        native: (row.native_text as string) ?? "",
        gapsEnglish: (gaps?.english ?? []) as string[],
        gapsNative: (gaps?.native ?? []) as string[],
        language: (row.language as string) ?? "English",
        languageCode: "en",
      };
      setResult(savedResult);
      if (row.job_title) setJobTitle(row.job_title as string);
      if (row.company) setCompany(row.company as string);
      setTab("english");
      setView("result");
    })();
  }, [user, letterParam]);

  // ── Scroll to result on generation ────────────────────────────────────────
  useEffect(() => {
    if (view === "result") {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [view]);

  // ── Generate ───────────────────────────────────────────────────────────────
  async function handleGenerate() {
    if (!cvData) return;
    if (!jobAdvert.trim() && !jobTitle.trim()) {
      setGenError(t("en", "clJobTitleRequired"));
      return;
    }

    setGenError(null);
    setGenerating(true);

    // Trim advert if too long
    let advert = jobAdvert;
    let trimmed = false;
    if (advert.length > ADVERT_LIMIT) {
      advert = advert.slice(0, ADVERT_LIMIT);
      trimmed = true;
      setAdvertTrimmed(true);
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token ?? "";

      const res = await generateCoverLetterServer({
        data: {
          cvData,
          cvDocumentId: selectedCvId || undefined,
          jobAdvert: advert,
          jobTitle: jobTitle.trim(),
          company: company.trim(),
          whyThisJob: whyThisJob.trim(),
          explain: explain.trim(),
          length,
          accessToken,
        },
      });

      setResult(res);
      setTab(englishOnly ? "english" : "native");
      setEditText(null);
      setView("result");
      if (trimmed) setAdvertTrimmed(true);
      setQuota((prev) => prev ? { ...prev, used: Math.min(prev.used + 1, prev.limit) } : null);
    } catch (err) {
      const raw = err instanceof Error ? err.message : t("en", "clError");
      const msg = raw === "cap_reached" ? t("en", "clCapReached") : raw;
      setGenError(msg);
    } finally {
      setGenerating(false);
    }
  }

  // ── Copy ───────────────────────────────────────────────────────────────────
  async function handleCopy() {
    const text =
      editText !== null
        ? editText
        : tab === "english"
          ? (result?.english ?? "")
          : (result?.native ?? "");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }

  // ── Active letter text ─────────────────────────────────────────────────────
  function activeText() {
    if (editText !== null) return editText;
    return tab === "english" ? (result?.english ?? "") : (result?.native ?? "");
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (view === "result") {
              setView("form");
              setResult(null);
            } else {
              navigate({ to: "/dashboard" });
            }
          }}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" />
          {view === "result" ? t("en", "clEditForm") : t("en", "back")}
        </button>
        <span className="font-semibold text-gray-900 text-sm">{t("en", "clTitle")}</span>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6">
        {view === "form" ? (
          <FormView
            cvs={cvs}
            cvsLoading={cvsLoading}
            selectedCvId={selectedCvId}
            setSelectedCvId={setSelectedCvId}
            jobAdvert={jobAdvert}
            setJobAdvert={setJobAdvert}
            advertTrimmed={advertTrimmed}
            jobTitle={jobTitle}
            setJobTitle={setJobTitle}
            company={company}
            setCompany={setCompany}
            whyThisJob={whyThisJob}
            setWhyThisJob={setWhyThisJob}
            explain={explain}
            setExplain={setExplain}
            length={length}
            setLength={setLength}
            generating={generating}
            genError={genError}
            remaining={remaining}
            quota={quota}
            onGenerate={handleGenerate}
            navigate={navigate}
          />
        ) : (
          <ResultView
            ref={resultRef}
            result={result!}
            tab={tab}
            setTab={setTab}
            editText={editText}
            setEditText={setEditText}
            copied={copied}
            pdfLoading={pdfLoading}
            wordLoading={wordLoading}
            englishOnly={englishOnly}
            lang={lang}
            onCopy={handleCopy}
            onDownloadPdf={async () => {
              setPdfLoading(true);
              await downloadLetterPdf(activeText()).catch(() => null);
              setPdfLoading(false);
            }}
            onDownloadWord={async () => {
              setWordLoading(true);
              await downloadLetterWord(activeText()).catch(() => null);
              setWordLoading(false);
            }}
            onRegenerate={() => {
              setResult(null);
              setView("form");
            }}
          />
        )}
      </div>
    </div>
  );
}

// ── Form view ─────────────────────────────────────────────────────────────────

function FormView({
  cvs,
  cvsLoading,
  selectedCvId,
  setSelectedCvId,
  jobAdvert,
  setJobAdvert,
  advertTrimmed,
  jobTitle,
  setJobTitle,
  company,
  setCompany,
  whyThisJob,
  setWhyThisJob,
  explain,
  setExplain,
  length,
  setLength,
  generating,
  genError,
  remaining,
  quota,
  onGenerate,
  navigate,
}: {
  cvs: CVWithData[];
  cvsLoading: boolean;
  selectedCvId: string;
  setSelectedCvId: (id: string) => void;
  jobAdvert: string;
  setJobAdvert: (v: string) => void;
  advertTrimmed: boolean;
  jobTitle: string;
  setJobTitle: (v: string) => void;
  company: string;
  setCompany: (v: string) => void;
  whyThisJob: string;
  setWhyThisJob: (v: string) => void;
  explain: string;
  setExplain: (v: string) => void;
  length: "short" | "standard";
  setLength: (v: "short" | "standard") => void;
  generating: boolean;
  genError: string | null;
  remaining: number | null;
  quota: CoverLetterQuota | null;
  onGenerate: () => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  if (cvsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (cvs.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center space-y-3">
        <p className="text-gray-700 font-medium">{t("en", "clNoCvs")}</p>
        <p className="text-sm text-gray-400">{t("en", "clNoCvsHint")}</p>
        <button
          type="button"
          onClick={() => navigate({ to: "/build" })}
          className="mt-2 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {t("en", "dashboardNewCV")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("en", "clTitle")}</h1>
        <p className="mt-1 text-sm text-gray-500">{t("en", "clSubtitle")}</p>
      </div>

      {/* CV selector */}
      <Field label={t("en", "clSelectCv")}>
        <div className="relative">
          <select
            value={selectedCvId}
            onChange={(e) => setSelectedCvId(e.target.value)}
            className="w-full appearance-none rounded-xl border border-border bg-white px-4 py-3 text-sm pr-10 outline-none focus:border-primary"
          >
            {cvs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title || "CV"}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        </div>
      </Field>

      {/* Job advert */}
      <Field label={t("en", "clJobAdvert")} hint={t("en", "clJobAdvertHint")}>
        {advertTrimmed && (
          <p className="text-xs text-amber-600 mb-1">{t("en", "clAdvertTrimmed")}</p>
        )}
        <textarea
          value={jobAdvert}
          onChange={(e) => setJobAdvert(e.target.value)}
          placeholder={t("en", "clJobAdvertPlaceholder")}
          rows={6}
          maxLength={ADVERT_LIMIT + 500}
          className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm resize-y outline-none focus:border-primary"
        />
        <p className="text-right text-xs text-gray-400 mt-1">
          {jobAdvert.length.toLocaleString()} / {ADVERT_LIMIT.toLocaleString()}
        </p>
      </Field>

      {/* Job title + Company — single column on mobile, two on sm+ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label={t("en", "clJobTitle")}
          hint={!jobAdvert.trim() ? t("en", "clJobTitleHint") : undefined}
        >
          <input
            type="text"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder={t("en", "clJobTitlePlaceholder")}
            className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm outline-none focus:border-primary"
          />
        </Field>
        <Field label={t("en", "clCompany")}>
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder={t("en", "clCompanyPlaceholder")}
            className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm outline-none focus:border-primary"
          />
        </Field>
      </div>

      {/* Why this job */}
      <Field label={t("en", "clWhyJob")} hint={t("en", "clWhyJobHint")}>
        <textarea
          value={whyThisJob}
          onChange={(e) => setWhyThisJob(e.target.value)}
          placeholder={t("en", "clOwnLangPlaceholder")}
          rows={3}
          className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm resize-y outline-none focus:border-primary"
        />
      </Field>

      {/* Explain */}
      <Field label={t("en", "clExplain")} hint={t("en", "clExplainHint")}>
        <textarea
          value={explain}
          onChange={(e) => setExplain(e.target.value)}
          placeholder={t("en", "clOwnLangPlaceholder")}
          rows={3}
          className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm resize-y outline-none focus:border-primary"
        />
      </Field>

      {/* Length */}
      <Field label={t("en", "clLength")}>
        <div className="flex gap-3">
          {(["standard", "short"] as const).map((opt) => (
            <label
              key={opt}
              className={`flex-1 cursor-pointer rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                length === opt
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              <input
                type="radio"
                name="length"
                value={opt}
                checked={length === opt}
                onChange={() => setLength(opt)}
                className="sr-only"
              />
              {opt === "short" ? t("en", "clLengthShort") : t("en", "clLengthStandard")}
            </label>
          ))}
        </div>
      </Field>

      {/* Error */}
      {genError && (
        <p className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {genError}
        </p>
      )}

      {/* Generate button */}
      <button
        type="button"
        onClick={onGenerate}
        disabled={generating || !selectedCvId || remaining === 0}
        className="w-full rounded-xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 min-h-[44px]"
      >
        {generating ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            {t("en", "clGenerating")}
          </span>
        ) : (
          t("en", "clGenerate")
        )}
      </button>

      {/* Quota counter */}
      {quota !== null && (
        <div className="text-center space-y-1">
          <p className={`text-xs ${remaining === 0 ? "text-red-500 font-medium" : "text-gray-400"}`}>
            {remaining === 0
              ? t("en", "clCapReached")
              : t("en", "clQuotaLabel", { used: String(remaining), limit: String(quota.limit) })}
          </p>
          {remaining !== 0 && (
            <p className="text-xs text-gray-400">{t("en", "clQuotaInfo")}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Result view ───────────────────────────────────────────────────────────────

const ResultView = ({
  result,
  tab,
  setTab,
  editText,
  setEditText,
  copied,
  pdfLoading,
  wordLoading,
  englishOnly,
  onCopy,
  onDownloadPdf,
  onDownloadWord,
  onRegenerate,
}: {
  result: CoverLetterResult;
  tab: "english" | "native";
  setTab: (t: "english" | "native") => void;
  editText: string | null;
  setEditText: (v: string | null) => void;
  copied: boolean;
  pdfLoading: boolean;
  wordLoading: boolean;
  englishOnly: boolean;
  lang: string;
  onCopy: () => void;
  onDownloadPdf: () => void;
  onDownloadWord: () => void;
  onRegenerate: () => void;
} & { ref?: React.Ref<HTMLDivElement> }) => {
  const displayText = editText !== null
    ? editText
    : tab === "english"
      ? result.english
      : result.native;

  const isRtl = tab === "native" && RTL_CODES.has(result.languageCode);

  return (
    <div className="space-y-5">
      {/* Tabs */}
      {!englishOnly && (
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(["native", "english"] as const).map((t_) => (
            <button
              key={t_}
              type="button"
              onClick={() => {
                setTab(t_);
                setEditText(null);
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors min-h-[44px] ${
                tab === t_
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t_ === "english" ? t("en", "clEnglishLetter") : `${result.language} version`}
            </button>
          ))}
        </div>
      )}

      {/* Letter */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        {editText !== null ? (
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            dir={isRtl ? "rtl" : "ltr"}
            className="w-full min-h-[320px] text-sm text-gray-800 leading-relaxed resize-y outline-none font-mono"
            style={isRtl ? { textAlign: "right", fontFamily: "system-ui, sans-serif" } : undefined}
            autoFocus
          />
        ) : (
          <pre
            dir={isRtl ? "rtl" : "ltr"}
            className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed font-sans"
            style={isRtl ? { textAlign: "right" } : undefined}
          >
            {displayText}
          </pre>
        )}

        {/* Edit controls */}
        <div className="mt-4 flex items-center justify-end gap-2">
          {editText !== null ? (
            <>
              <button
                type="button"
                onClick={() => setEditText(null)}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 min-h-[44px]"
              >
                <X className="h-3 w-3" />
                {t("en", "clEditCancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  const saved = editText!;
                  setEditText(null);
                  // Persist to DB
                  if (result?.id) {
                    const field = tab === "english" ? "english_text" : "native_text";
                    void supabase
                      .from("cover_letters")
                      .update({ [field]: saved })
                      .eq("id", result.id);
                  }
                }}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 min-h-[44px]"
              >
                <Check className="h-3 w-3" />
                {t("en", "clEditSave")}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setEditText(displayText)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 min-h-[44px]"
            >
              <Pencil className="h-3 w-3" />
              {t("en", "clEdit")}
            </button>
          )}
        </div>
      </div>

      {/* Things to check */}
      {(() => {
        const activeGaps = tab === "english" ? result.gapsEnglish : result.gapsNative;
        return activeGaps.length > 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-amber-800 mb-2">
              {t("en", "clThingsToCheck")}
            </p>
            <ul className="space-y-1.5">
              {activeGaps.map((gap, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                  <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-amber-200 flex items-center justify-center text-[10px] font-bold text-amber-800">
                    {i + 1}
                  </span>
                  {gap}
                </li>
              ))}
            </ul>
          </div>
        ) : null;
      })()}

      {/* Action row — 2-col grid on mobile so buttons are wide enough to tap */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
        <button
          type="button"
          onClick={onCopy}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors min-h-[44px]"
        >
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          {copied ? t("en", "clCopied") : t("en", "clCopy")}
        </button>
        <button
          type="button"
          onClick={onDownloadPdf}
          disabled={pdfLoading}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors min-h-[44px] disabled:opacity-50"
        >
          <FileDown className="h-4 w-4" />
          {pdfLoading ? "…" : t("en", "clDownloadPdf")}
        </button>
        <button
          type="button"
          onClick={onDownloadWord}
          disabled={wordLoading}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors min-h-[44px] disabled:opacity-50"
        >
          <FileDown className="h-4 w-4" />
          {wordLoading ? "…" : t("en", "clDownloadWord")}
        </button>
        <button
          type="button"
          onClick={onRegenerate}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors min-h-[44px]"
        >
          <RefreshCw className="h-4 w-4" />
          {t("en", "clRegenerate")}
        </button>
      </div>
    </div>
  );
};

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {hint && <span className="ml-1.5 font-normal text-gray-400 text-xs">{hint}</span>}
      </label>
      {children}
    </div>
  );
}
