import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  FileDown,
  Globe,
  Lock,
  LogOut,
  Mail,
  MessageCircle,
  Pencil,
  Share2,
  Twitter,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { t } from "@/lib/buildTranslations";
import { notifyFeedback } from "@/lib/notifyFeedback";

// Native names for the lang toggle — mirrors the languages array in build.tsx
const NATIVE_LANG_NAME: Record<string, string> = {
  pl: "Polski", ro: "Română", pa: "ਪੰਜਾਬੀ", ur: "اردو", pt: "Português",
  es: "Español", ar: "عربي", bn: "বাংলা", gu: "ગુજરાતી", fr: "Français",
  tr: "Türkçe", hi: "हिन्दी", so: "Soomaali", zh: "普通话", fa: "فارسی",
  uk: "Українська", ku: "Kurdî", ta: "தமிழ்", am: "አማርኛ", ti: "ትግርኛ",
};

// ── Types ──────────────────────────────────────────────────────────────────
interface Profile {
  full_name: string | null;
  preferred_ui_language: string | null;
  default_cv_language: string | null;
  referral_code: string | null;
}

interface CVDocument {
  id: string;
  title: string;
  status: string;
  created_at: string;
}

const FREE_LIMIT = 2;

// Derive a stable 10-char hex code from user UUID (unique by construction)
function deriveReferralCode(userId: string): string {
  return userId.replace(/-/g, "").slice(0, 10);
}

// ── Share URL helpers (mirrors result.tsx "Share CVLingo" pattern) ─────────
function makeCVLingoShareUrls(referralLink: string) {
  const msg = `Build your free UK CV in your own language — no English needed. Try CVLingo free: ${referralLink}`;
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(msg)}`,
    email: `mailto:?subject=${encodeURIComponent("Free UK CV builder — CVLingo")}&body=${encodeURIComponent(msg)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}&quote=${encodeURIComponent(msg)}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(msg)}`,
  };
}

// ── Main page ──────────────────────────────────────────────────────────────
function DashboardPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [cvs, setCVs] = useState<CVDocument[]>([]);
  const [downloadCount, setDownloadCount] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [forceEnglish, setForceEnglish] = useState(() => {
    try { return localStorage.getItem("cvlingo:dashLang") === "en"; } catch { return false; }
  });

  const storedLang = profile?.preferred_ui_language || "en";
  const lang = forceEnglish ? "en" : storedLang;
  const showLangToggle = storedLang !== "en";
  const toggleLangLabel = forceEnglish
    ? (NATIVE_LANG_NAME[storedLang] ?? storedLang.toUpperCase())
    : "English";

  function toggleLang() {
    const next = !forceEnglish;
    setForceEnglish(next);
    try { localStorage.setItem("cvlingo:dashLang", next ? "en" : ""); } catch { /* ignore */ }
  }

  async function handleEdit(cvId: string) {
    const { data, error: fetchErr } = await supabase
      .from("cv_documents")
      .select("form_data")
      .eq("id", cvId)
      .maybeSingle();
    if (fetchErr || !data?.form_data) {
      console.error("handleEdit: could not fetch form_data", fetchErr);
      return;
    }
    try {
      sessionStorage.setItem("cvlingo:input", JSON.stringify(data.form_data));
      sessionStorage.setItem("cvlingo:editingCvId", cvId);
      sessionStorage.setItem("cvlingo:editStep", "2");
    } catch { /* ignore */ }
    navigate({ to: "/build" });
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      try { sessionStorage.setItem("cvlingo:redirectAfterAuth", "/dashboard"); } catch { /* ignore */ }
      navigate({ to: "/build" });
    }
  }, [authLoading, user, navigate]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    setError(null);
    setErrorDetail(null);
    try {
      const [profileRes, cvsRes, downloadsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, preferred_ui_language, default_cv_language, referral_code")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("cv_documents")
          .select("id, title, status, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("downloads")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
      ]);

      if (profileRes.error) {
        console.error("Dashboard: profiles query error:", profileRes.error);
        setErrorDetail(`profiles: ${profileRes.error.code} — ${profileRes.error.message}`);
        throw profileRes.error;
      }
      if (cvsRes.error) {
        console.error("Dashboard: cv_documents query error:", cvsRes.error);
        setErrorDetail(`cv_documents: ${cvsRes.error.code} — ${cvsRes.error.message}`);
        throw cvsRes.error;
      }
      if (downloadsRes.error) {
        console.error("Dashboard: downloads query error:", downloadsRes.error);
      }

      let resolvedProfile = profileRes.data as Profile | null;
      const generatedCode = deriveReferralCode(user.id);

      if (!resolvedProfile) {
        const metaName = (user.user_metadata as { full_name?: string })?.full_name ?? null;
        const { error: upsertErr } = await supabase
          .from("profiles")
          .upsert({ id: user.id, full_name: metaName, referral_code: generatedCode });
        if (upsertErr) console.error("Dashboard: profile upsert error:", upsertErr);
        resolvedProfile = {
          full_name: metaName,
          preferred_ui_language: null,
          default_cv_language: null,
          referral_code: generatedCode,
        };
      } else if (!resolvedProfile.referral_code) {
        const { error: rcErr } = await supabase
          .from("profiles")
          .update({ referral_code: generatedCode })
          .eq("id", user.id);
        if (rcErr) console.error("Dashboard: referral_code update error:", rcErr);
        resolvedProfile = { ...resolvedProfile, referral_code: generatedCode };
      }

      setProfile(resolvedProfile);
      setCVs((cvsRes.data as CVDocument[]) ?? []);
      setDownloadCount(downloadsRes.count ?? 0);
    } catch (err) {
      console.error("Dashboard: load failed:", err);
      setError("error");
    } finally {
      setDataLoading(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  if (authLoading || (!user && !authLoading)) return null;

  const fullName =
    profile?.full_name ??
    (user?.user_metadata as { full_name?: string })?.full_name ??
    null;
  const firstName = fullName?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "";
  const initials = firstName.slice(0, 2).toUpperCase();
  const referralCode = profile?.referral_code ?? deriveReferralCode(user?.id ?? "");
  const referralLink = `https://cvlingo.com/?ref=${referralCode}`;
  const usagePct = Math.min(100, Math.round((downloadCount / FREE_LIMIT) * 100));

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return iso;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <a href="/" className="text-sm font-bold text-primary tracking-tight">CVLingo</a>
        <p className="hidden sm:block text-sm text-gray-500">
          {t(lang, "dashboardWelcome", { name: firstName })}
        </p>
        <div className="flex items-center gap-3">
          {showLangToggle && (
            <button
              type="button"
              onClick={toggleLang}
              className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
              title={forceEnglish ? "Switch back to your language" : "View in English"}
            >
              <Globe className="h-3.5 w-3.5" />
              {toggleLangLabel}
            </button>
          )}
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">{t(lang, "dashboardLogout")}</span>
          </button>
        </div>
      </header>

      {/* ── Two-column layout ── */}
      <div className="mx-auto max-w-6xl px-4 py-6 lg:grid lg:grid-cols-[272px_1fr] lg:gap-8 lg:items-start">

        {/* ── SIDEBAR ── */}
        <aside className="mb-5 lg:mb-0 lg:sticky lg:top-[57px] space-y-3">

          {/* Profile + usage */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
            {/* Avatar + name/email */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary">{initials}</span>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate">{fullName || firstName}</p>
                <p className="text-xs text-gray-400 truncate">{user?.email}</p>
              </div>
            </div>

            {/* Usage */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium text-gray-500">{t(lang, "dashboardUsageTitle")}</span>
                <span className="text-xs text-gray-400">{downloadCount}/{FREE_LIMIT} {t(lang, "dashboardDownload").toLowerCase()}s</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${usagePct >= 100 ? "bg-destructive" : "bg-primary"}`}
                  style={{ width: `${usagePct}%` }}
                />
              </div>
              {usagePct >= 100 && (
                <p className="text-xs text-destructive mt-1">Free limit reached</p>
              )}
            </div>

            {/* CV language */}
            {profile?.default_cv_language && (
              <p className="text-xs text-gray-400">
                {t(lang, "dashboardProfileCVLang")}:{" "}
                <span className="font-medium text-gray-600">{profile.default_cv_language}</span>
              </p>
            )}
          </div>

          {/* Talent pool status */}
          {user && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <CandidatePoolStatus lang={lang} userId={user.id} />
            </div>
          )}

          {/* Change password */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <ChangePasswordForm lang={lang} />
          </div>

          {/* Share CVLingo / personal referral */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <ReferralSection lang={lang} referralLink={referralLink} />
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main className="space-y-5">
          {/* Build new CV CTA */}
          <button
            type="button"
            onClick={() => navigate({ to: "/build" })}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm shadow-sm"
          >
            <FileDown className="h-4 w-4" />
            {t(lang, "dashboardNewCV")}
          </button>

          {/* Loading / error / content */}
          {dataLoading ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : error ? (
            <div className="bg-white rounded-xl border border-red-100 p-6 text-center space-y-2">
              <p className="text-red-600 text-sm font-medium">{t(lang, "dashboardError")}</p>
              {errorDetail && (
                <p className="text-xs text-red-400 font-mono break-all">{errorDetail}</p>
              )}
              <button
                type="button"
                onClick={() => void loadData()}
                className="text-sm text-primary hover:underline font-medium"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {/* My CVs */}
              <section>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  {t(lang, "dashboardMyCVs")}
                </h2>
                {cvs.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                    <p className="text-gray-500 text-sm mb-3">{t(lang, "dashboardNoCVsMsg")}</p>
                    <button
                      type="button"
                      onClick={() => navigate({ to: "/build" })}
                      className="text-sm text-primary hover:underline font-medium"
                    >
                      {t(lang, "dashboardBuildFirst")}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cvs.map((cv) => (
                      <CVCard
                        key={cv.id}
                        cv={cv}
                        lang={lang}
                        formatDate={formatDate}
                        referralLink={referralLink}
                        onEdit={handleEdit}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Feedback */}
              <FeedbackSection
                lang={lang}
                userId={user?.id ?? null}
                userEmail={user?.email}
              />
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// ── CV Card ────────────────────────────────────────────────────────────────
// Download navigates to result page (PDF rendering requires HTML content not
// stored in DB). WhatsApp/Email share the CVLingo site with the user's
// personal referral link — same pattern as result.tsx "Share CVLingo".
function CVCard({
  cv,
  lang,
  formatDate,
  referralLink,
  onEdit,
}: {
  cv: CVDocument;
  lang: string;
  formatDate: (iso: string) => string;
  referralLink: string;
  onEdit: (cvId: string) => Promise<void>;
}) {
  const urls = makeCVLingoShareUrls(referralLink);
  const [editing, setEditing] = useState(false);

  async function handleEditClick() {
    setEditing(true);
    await onEdit(cv.id);
    setEditing(false);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="font-medium text-gray-900 text-sm truncate">{cv.title || "CV"}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {t(lang, "dashboardCVCreated", { date: formatDate(cv.created_at) })}
          </p>
        </div>
        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded shrink-0">
          {t(lang, "dashboardStatusDraft")}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Download — navigates to result page, which loads cv_content from DB */}
        <a
          href={`/result?cv=${cv.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <FileDown className="h-3 w-3" />
          {t(lang, "dashboardDownload")}
        </a>

        {/* Edit — fetches form_data from DB, pre-fills build flow */}
        <button
          type="button"
          onClick={handleEditClick}
          disabled={editing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <Pencil className="h-3 w-3" />
          {editing ? "…" : t(lang, "dashboardEdit")}
        </button>

        {/* WhatsApp share */}
        <a
          href={urls.whatsapp}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <MessageCircle className="h-3 w-3" />
          {t(lang, "shareWhatsApp")}
        </a>

        {/* Email share */}
        <a
          href={urls.email}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <Mail className="h-3 w-3" />
          {t(lang, "shareEmail")}
        </a>
      </div>
    </div>
  );
}

// ── Candidate Pool Status ──────────────────────────────────────────────────
function CandidatePoolStatus({ lang, userId }: { lang: string; userId: string }) {
  const [inPool, setInPool] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase
      .from("candidates")
      .select("id, is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data }) => setInPool(data != null));
  }, [userId]);

  async function handleOptOut() {
    setBusy(true);
    await supabase
      .from("candidates")
      .update({ is_active: false })
      .eq("user_id", userId);
    setInPool(false);
    setBusy(false);
  }

  async function handleOptIn() {
    setBusy(true);
    // Check if a soft-deleted row exists; if so, reactivate it
    const { data: existing } = await supabase
      .from("candidates")
      .select("id")
      .eq("user_id", userId)
      .eq("is_active", false)
      .maybeSingle();
    if (existing) {
      await supabase.from("candidates").update({ is_active: true, opted_in_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      // No row at all — can't create without full CV data; redirect to build
    }
    setInPool(true);
    setBusy(false);
  }

  if (inPool === null) return null;

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Talent Pool</p>
      {inPool ? (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-sm font-medium text-gray-700">{t(lang, "poolDashboardInPool")}</span>
          </div>
          <button
            type="button"
            onClick={handleOptOut}
            disabled={busy}
            className="text-xs text-muted-foreground underline hover:text-foreground disabled:opacity-50"
          >
            {busy ? t(lang, "poolDashboardRemoving") : t(lang, "poolDashboardOptOut")}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-gray-300" />
            <span className="text-sm text-gray-500">{t(lang, "poolDashboardNotInPool")}</span>
          </div>
          <button
            type="button"
            onClick={handleOptIn}
            disabled={busy}
            className="text-xs font-semibold text-primary underline hover:opacity-80 disabled:opacity-50"
          >
            {busy ? t(lang, "poolDashboardJoining") : t(lang, "poolDashboardOptIn")}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Change Password ────────────────────────────────────────────────────────
function ChangePasswordForm({ lang }: { lang: string }) {
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError(t(lang, "dashboardPasswordTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t(lang, "dashboardPasswordMismatch"));
      return;
    }
    setSaving(true);
    const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (updateErr) {
      console.error("change password error:", updateErr);
      setError(t(lang, "dashboardPasswordError"));
      return;
    }
    setSaved(true);
    setNewPassword("");
    setConfirmPassword("");
    setTimeout(() => { setSaved(false); setOpen(false); }, 2500);
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setError(null); }}
        className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 w-full transition-colors"
      >
        <Lock className="h-4 w-4 text-gray-400" />
        {t(lang, "dashboardChangePassword")}
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="mt-3 space-y-2">
          <input
            type="password"
            placeholder={t(lang, "dashboardNewPassword")}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30"
            autoComplete="new-password"
          />
          <input
            type="password"
            placeholder={t(lang, "dashboardConfirmPassword")}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30"
            autoComplete="new-password"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          {saved && (
            <p className="text-xs text-emerald-600 flex items-center gap-1">
              <Check className="h-3 w-3" />
              {t(lang, "dashboardPasswordSaved")}
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {saving ? "Saving…" : t(lang, "dashboardPasswordSave")}
          </button>
        </form>
      )}
    </div>
  );
}

// ── Referral / Share CVLingo ───────────────────────────────────────────────
function ReferralSection({ lang, referralLink }: { lang: string; referralLink: string }) {
  const [copied, setCopied] = useState(false);
  const urls = makeCVLingoShareUrls(referralLink);

  function handleCopy() {
    navigator.clipboard.writeText(referralLink)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-gray-700">{t(lang, "dashboardReferralTitle")}</p>
        <p className="text-xs text-gray-400 mt-0.5">{t(lang, "dashboardReferralDesc")}</p>
      </div>

      {/* Link + copy button */}
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={referralLink}
          onFocus={(e) => e.target.select()}
          className="flex-1 min-w-0 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-500 select-all"
        />
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 shrink-0 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          {copied
            ? <Check className="h-3 w-3 text-emerald-600" />
            : <Copy className="h-3 w-3" />}
          {copied ? t(lang, "dashboardReferralCopied") : t(lang, "dashboardReferralCopy")}
        </button>
      </div>

      {/* Share buttons — same pattern as result.tsx "Share CVLingo" section */}
      <div className="flex flex-wrap gap-2">
        <a
          href={urls.whatsapp}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <MessageCircle className="h-3 w-3" />
          {t(lang, "shareOnWhatsApp")}
        </a>
        <a
          href={urls.email}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <Mail className="h-3 w-3" />
          Email
        </a>
        <a
          href={urls.facebook}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <Share2 className="h-3 w-3" />
          {t(lang, "shareOnFacebook")}
        </a>
        <a
          href={urls.twitter}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <Twitter className="h-3 w-3" />
          {t(lang, "shareOnX")}
        </a>
      </div>
    </div>
  );
}

// ── Usage tile (kept for potential reuse) ──────────────────────────────────
function UsageTile({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  return (
    <div>
      <p className="text-sm text-gray-700 mb-1">{label}</p>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${pct >= 100 ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Feedback ───────────────────────────────────────────────────────────────
function FeedbackSection({
  lang,
  userId,
  userEmail,
}: {
  lang: string;
  userId: string | null;
  userEmail?: string;
}) {
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [hover, setHover] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating && !comment.trim()) {
      setError(t(lang, "feedbackAtLeastOne"));
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error: dbErr } = await supabase.from("feedback").insert({
      user_id: userId,
      rating: rating || null,
      comment: comment.trim() || null,
    });
    if (dbErr) {
      console.error("feedback insert error:", dbErr);
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }
    void notifyFeedback(rating || null, comment.trim() || null, userEmail);
    setSubmitted(true);
    setSubmitting(false);
  }

  if (submitted) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
        <p className="text-gray-900 font-medium text-sm">{t(lang, "feedbackThanks")}</p>
      </div>
    );
  }

  return (
    <section>
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        {t(lang, "feedbackTitle")}
      </h2>
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-sm text-gray-700 mb-2">{t(lang, "feedbackRatingLabel")}</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHover(star)}
                  onMouseLeave={() => setHover(0)}
                  className="text-2xl leading-none transition-colors"
                  aria-label={`${star} star`}
                >
                  {star <= (hover || rating) ? "★" : "☆"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-700 block mb-1">
              {t(lang, "feedbackCommentLabel")}
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {submitting ? "Submitting…" : t(lang, "feedbackSubmit")}
          </button>
        </form>
      </div>
    </section>
  );
}

// Suppress "unused" warning — kept as a named export for potential reuse
export { UsageTile };

export const Route = createFileRoute("/dashboard")({
  codeSplitGroupings: [],
  component: DashboardPage,
});
