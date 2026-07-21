import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { generateCV } from "@/utils/generateCV";
import { GeneratingOverlay } from "@/components/GeneratingOverlay";
import { Clock } from "lucide-react";
import { t, type TKey } from "@/lib/buildTranslations";
import { addCandidate } from "@/lib/candidatePool";
import { notifyCandidate } from "@/lib/notifyCandidate";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

type Experience = {
  title: string;
  place: string;
  country: string;
  duration: string;
  description: string;
};

type Education = {
  qualification: string;
  institution: string;
  country: string;
  year: string;
};

type PersonalDetails = {
  name: string;
  phone: string;
  email: string;
  city: string;
  postcode: string;
  rightToWork: string;
};

type CVData = {
  language: string;
  languageCode: string;
  /** Language code used to display the questions in the build form. */
  questionLanguageCode: string;
  jobTypes: string[];
  otherJobType: string;
  personalDetails: PersonalDetails;
  experienceType: string;
  experience: Experience[];
  hasEducation: "" | "yes" | "no";
  education: Education[];
  skills: string[];
  availability: string[];
  candidatePoolConsent: boolean | null;
};

const initialData: CVData = {
  language: "",
  languageCode: "",
  questionLanguageCode: "en",
  jobTypes: [],
  otherJobType: "",
  personalDetails: { name: "", phone: "", email: "", city: "", postcode: "", rightToWork: "" },
  experienceType: "",
  experience: [],
  hasEducation: "",
  education: [],
  skills: [],
  availability: [],
  candidatePoolConsent: null,
};


const languages = [
  { code: "en", name: "English", native: "English", flag: "🇬🇧" },
  { code: "pl", name: "Polish", native: "Polski", flag: "🇵🇱" },
  { code: "ro", name: "Romanian", native: "Română", flag: "🇷🇴" },
  { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ", flag: "🇮🇳" },
  { code: "ur", name: "Urdu", native: "اردو", flag: "🇵🇰" },
  { code: "pt", name: "Portuguese", native: "Português", flag: "🇵🇹" },
  { code: "es", name: "Spanish", native: "Español", flag: "🇪🇸" },
  { code: "ar", name: "Arabic", native: "عربي", flag: "🇸🇦" },
  { code: "bn", name: "Bengali", native: "বাংলা", flag: "🇧🇩" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી", flag: "🇮🇳" },
  { code: "fr", name: "French", native: "Français", flag: "🇫🇷" },
  { code: "tr", name: "Turkish", native: "Türkçe", flag: "🇹🇷" },
  { code: "hi", name: "Hindi", native: "हिन्दी", flag: "🇮🇳" },
  { code: "so", name: "Somali", native: "Soomaali", flag: "🇸🇴" },
  { code: "zh", name: "Mandarin", native: "普通话", flag: "🇨🇳" },
  { code: "fa", name: "Persian", native: "فارسی", flag: "🇮🇷" },
  { code: "uk", name: "Ukrainian", native: "Українська", flag: "🇺🇦" },
  { code: "ku", name: "Kurdish", native: "Kurdî", flag: "🇽🇰" },
  { code: "ta", name: "Tamil", native: "தமிழ்", flag: "🇱🇰" },
  { code: "am", name: "Amharic", native: "አማርኛ", flag: "🇪🇹" },
  { code: "ti", name: "Tigrinya", native: "ትግርኛ", flag: "🇪🇷" },
];

const jobs: { id: string; tKey: TKey; emoji: string }[] = [
  { id: "hospitality", tKey: "job_hospitality", emoji: "🍽️" },
  { id: "construction", tKey: "job_construction", emoji: "🏗️" },
  { id: "care", tKey: "job_care", emoji: "🤝" },
  { id: "delivery", tKey: "job_delivery", emoji: "🚗" },
  { id: "cleaning", tKey: "job_cleaning", emoji: "🧹" },
  { id: "retail", tKey: "job_retail", emoji: "🛍️" },
  { id: "warehouse", tKey: "job_warehouse", emoji: "📦" },
  { id: "office", tKey: "job_office", emoji: "💼" },
  { id: "beauty", tKey: "job_beauty", emoji: "💇" },
  { id: "security", tKey: "job_security", emoji: "🔒" },
  { id: "agriculture", tKey: "job_agriculture", emoji: "🌱" },
  { id: "other", tKey: "job_other", emoji: "✨" },
];


const rightToWorkOptions: { value: string; tKey: TKey }[] = [
  { value: "British citizen", tKey: "rtw_british" },
  { value: "Settled / pre-settled status", tKey: "rtw_settled" },
  { value: "Skilled worker visa", tKey: "rtw_skilled" },
  { value: "Student visa", tKey: "rtw_student" },
  { value: "Refugee status", tKey: "rtw_refugee" },
  { value: "Other / not sure", tKey: "rtw_other" },
];

const experienceTypes: { id: string; tKey: TKey; descKey: TKey }[] = [
  { id: "paid", tKey: "expType_paid", descKey: "expType_paid_desc" },
  { id: "informal", tKey: "expType_informal", descKey: "expType_informal_desc" },
  { id: "volunteer", tKey: "expType_volunteer", descKey: "expType_volunteer_desc" },
  { id: "none", tKey: "expType_none", descKey: "expType_none_desc" },
];

const suggestedSkills: { value: string; tKey: TKey }[] = [
  { value: "Customer service", tKey: "skill_customer" },
  { value: "Teamwork", tKey: "skill_teamwork" },
  { value: "Timekeeping", tKey: "skill_timekeeping" },
  { value: "Cleaning", tKey: "skill_cleaning" },
  { value: "Food preparation", tKey: "skill_food" },
  { value: "Stock handling", tKey: "skill_stock" },
  { value: "Driving", tKey: "skill_driving" },
  { value: "Cash handling", tKey: "skill_cash" },
  { value: "Care support", tKey: "skill_care" },
  { value: "Microsoft Office", tKey: "skill_office" },
  { value: "Problem solving", tKey: "skill_problem" },
  { value: "English communication", tKey: "skill_english" },
];

const availabilityOptions: { value: string; tKey: TKey }[] = [
  { value: "Weekdays", tKey: "avail_weekdays" },
  { value: "Weekends", tKey: "avail_weekends" },
  { value: "Evenings", tKey: "avail_evenings" },
  { value: "Early mornings", tKey: "avail_mornings" },
  { value: "Full-time", tKey: "avail_full" },
  { value: "Part-time", tKey: "avail_part" },
];

function BuildPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(() => {
    try {
      // Login mode (returning user from nav) → go straight to the auth gate
      if (sessionStorage.getItem("cvlingo:loginMode") === "returning") return 0;
      // Pre-selected language from landing page → also start at auth gate for confirmation modal
      if (sessionStorage.getItem("cvlingo:preselectLanguage")) return 0;
    } catch { /* ignore */ }
    return 1;
  });
  const [data, setData] = useState<CVData>(() => {
    try {
      const saved = localStorage.getItem("cvlingo_form_data");
      if (saved) {
        const parsed = JSON.parse(saved) as CVData;
        // Always start Step 1 with no language highlighted — language is set
        // either by the user clicking a card or by the sessionStorage preselect
        // fast path. Restoring a stale languageCode causes English to appear
        // pre-highlighted with no way to advance without scrolling to Continue.
        return { ...parsed, languageCode: "", language: "", questionLanguageCode: "en", candidatePoolConsent: null };
      }
    } catch {
      localStorage.removeItem("cvlingo_form_data");
    }
    return initialData;
  });
  const [forceEnglish, setForceEnglish] = useState(false);
  const [preselectModalLang, setPreselectModalLang] = useState<typeof languages[number] | null>(null);
  const [loginMode] = useState(() => {
    try {
      const v = sessionStorage.getItem("cvlingo:loginMode");
      if (v === "returning") { sessionStorage.removeItem("cvlingo:loginMode"); return true; }
    } catch { /* ignore */ }
    return false;
  });

  // Scroll to top on mount and on every step change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  // Persist form data to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem("cvlingo_form_data", JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }, [data]);

  // Runs ONCE when the initial session check resolves (authLoading: true → false).
  // If the user was already signed in from a prior visit, skip the auth gate.
  // After this point, step changes only happen through explicit advanceFromAuth() calls
  // in StepAuth — NOT by reacting to onAuthStateChange events. This prevents stale
  // localStorage sessions, email-scanner magic-link completions, or any other ambient
  // SIGNED_IN event from silently advancing the flow mid-OTP-entry.
  useEffect(() => {
    if (authLoading) return;
    if (user) {
      try {
        const editStep = sessionStorage.getItem("cvlingo:editStep");
        if (editStep) {
          const n = parseInt(editStep, 10);
          if (n >= 2 && n <= 7) { setStep(n); sessionStorage.removeItem("cvlingo:editStep"); return; }
        }
      } catch { /* ignore */ }
      setStep((current) => (current === 0 ? 2 : current));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]); // intentionally omits `user` — see comment above

  useEffect(() => {
    try {
      const inputRaw = sessionStorage.getItem("cvlingo:input");
      if (inputRaw) setData(JSON.parse(inputRaw));
    } catch {
      /* ignore */
    }
    try {
      const preselect = sessionStorage.getItem("cvlingo:preselectLanguage");
      if (preselect) {
        const lang = languages.find((l) => l.code === preselect);
        if (lang) {
          if (lang.code === "en") {
            setData((current) => ({
              ...current,
              languageCode: lang.code,
              language: lang.name,
              questionLanguageCode: "en",
            }));
          } else {
            setData((current) => ({
              ...current,
              languageCode: lang.code,
              language: lang.name,
            }));
            setPreselectModalLang(lang);
          }
        }
        sessionStorage.removeItem("cvlingo:preselectLanguage");
      }
    } catch {
      /* ignore */
    }
  }, []);

  const update = <K extends keyof CVData>(key: K, value: CVData[K]) => {
    setData((current) => ({ ...current, [key]: value }));
  };

  const next = () =>
    setStep((current) => {
      // After language selection: unauthenticated users go to the auth gate; authenticated go straight to job type.
      if (current === 1) return user ? 2 : 0;
      return Math.min(7, current + 1);
    });
  const back = () => setStep((current) => Math.max(1, current - 1));
  // After auth: check if the user was redirected here from another page (e.g. /dashboard).
  // If so, go back there instead of advancing into the CV build flow.
  const advanceFromAuth = () => {
    try {
      const dest = sessionStorage.getItem("cvlingo:redirectAfterAuth");
      if (dest) {
        sessionStorage.removeItem("cvlingo:redirectAfterAuth");
        navigate({ to: dest as "/" });
        return;
      }
    } catch { /* ignore */ }
    setStep(2);
  };

  const originalLang = data.questionLanguageCode || "en";
  const displayLang = forceEnglish ? "en" : originalLang;
  const stepProps = {
    data,
    update,
    displayLang,
    originalLang,
    onToggleLang: () => setForceEnglish((v) => !v),
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="flex items-center gap-2 text-primary transition hover:opacity-80"
            aria-label="CVLingo — back to home"
          >
            <img src="/cvlingo-logo.svg" alt="CVLingo" className="h-8 w-8 rounded-full" />
          </Link>
          <Link
            to="/"
            className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            ← Back to home
          </Link>
        </div>
      </header>
      {step === 0 && <StepAuth onSuccess={advanceFromAuth} authLoading={authLoading} lang={data.languageCode || "en"} loginMode={loginMode} />}
      {step === 1 && <Step1Language data={data} update={update} onNext={next} />}
      {step === 2 && <Step2JobType {...stepProps} onBack={back} onNext={next} />}
      {step === 3 && <Step3PersonalDetails {...stepProps} onBack={back} onNext={next} />}
      {step === 4 && <Step4Experience {...stepProps} onBack={back} onNext={next} />}
      {step === 5 && <Step5Education {...stepProps} onBack={back} onNext={next} />}
      {step === 6 && <Step6Skills {...stepProps} onBack={back} onNext={next} />}
      {step === 7 && <Step7Review {...stepProps} onBack={back} onEdit={setStep} />}
      {preselectModalLang && (
        <LanguageChoiceModal
          lang={preselectModalLang}
          onChoose={(code) => {
            update("questionLanguageCode", code);
            setPreselectModalLang(null);
          }}
          onClose={() => {
            update("questionLanguageCode", preselectModalLang.code);
            setPreselectModalLang(null);
          }}
        />
      )}
    </main>
  );
}

// ─── Auth gate (Step 0) ──────────────────────────────────────────────────────

type AuthScreen = "capture" | "otp" | "password";

function friendlyAuthError(msg: string, lang: string): string {
  const m = msg.toLowerCase();
  if (m.includes("rate limit") || m.includes("too many")) return t(lang, "authErrorTooManyAttempts");
  if (m.includes("invalid") && m.includes("otp")) return t(lang, "authErrorWrongCode");
  if (m.includes("expired")) return t(lang, "authErrorExpiredCode");
  if (m.includes("invalid login") || m.includes("invalid credentials") || m.includes("wrong password")) return t(lang, "authErrorWrongPassword");
  if (m.includes("email") && m.includes("valid")) return t(lang, "authErrorInvalidEmail");
  if (m.includes("network") || m.includes("fetch")) return t(lang, "authErrorNetwork");
  return t(lang, "authErrorGeneric");
}

function StepAuth({ onSuccess, authLoading, lang, loginMode }: { onSuccess: () => void; authLoading: boolean; lang: string; loginMode?: boolean }) {
  const { sendOtp, verifyOtp, signIn, signUp } = useAuth();

  const [screen, setScreen] = useState<AuthScreen>("capture");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!loginMode && !firstName.trim()) { setError(t(lang, "authValidFirstName")); return; }
    if (!isValidEmail(email)) { setError(t(lang, "authValidEmail")); return; }
    setSubmitting(true);
    const { error: err } = await sendOtp(email.trim(), firstName.trim());
    setSubmitting(false);
    if (err) { setError(friendlyAuthError(err, lang)); return; }
    setScreen("otp");
    setResendCooldown(30);
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const token = otp.replace(/\s/g, "");
    if (!/^\d{6,10}$/.test(token)) { setError(t(lang, "authValidCode")); return; }
    setSubmitting(true);
    const { error: err } = await verifyOtp(email.trim(), token);
    setSubmitting(false);
    if (err) { setError(friendlyAuthError(err, lang)); return; }
    onSuccess();
  }

  async function handleResendOtp() {
    if (resendCooldown > 0) return;
    setError(null);
    const { error: err } = await sendOtp(email.trim(), firstName.trim());
    if (err) { setError(friendlyAuthError(err, lang)); return; }
    setResendCooldown(30);
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!loginMode && !firstName.trim()) { setError(t(lang, "authValidFirstName")); return; }
    if (!isValidEmail(email)) { setError(t(lang, "authValidEmail")); return; }
    if (password.length < 6) { setError(t(lang, "authValidPassword")); return; }
    setSubmitting(true);
    // Try sign-in first; if user not found, sign up
    const { error: signInErr } = await signIn(email.trim(), password);
    if (!signInErr) { onSuccess(); return; }
    if (signInErr.toLowerCase().includes("invalid") || signInErr.toLowerCase().includes("credentials") || signInErr.toLowerCase().includes("wrong")) {
      setSubmitting(false);
      setError(friendlyAuthError(signInErr, lang));
      return;
    }
    // Likely a new user — try sign up
    const { error: signUpErr } = await signUp(email.trim(), password, firstName.trim());
    setSubmitting(false);
    if (signUpErr) { setError(friendlyAuthError(signUpErr, lang)); return; }
    onSuccess();
  }

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <section className="px-4 pb-12 pt-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-sm">
        <div className="mb-8 text-center">
          <img src="/cvlingo-logo.svg" alt="CVLingo" className="mx-auto mb-4 h-14 w-14 rounded-full" />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {loginMode ? "Welcome back" : t(lang, "authHeading")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {loginMode ? "Enter your email to receive a login code." : t(lang, "authSubtitle")}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">

          {/* ── OTP verification screen ── */}
          {screen === "otp" && (
            <form onSubmit={handleVerifyOtp} noValidate>
              <p className="mb-1 text-sm font-medium text-foreground">
                {t(lang, "authOtpSent")}
              </p>
              <p className="mb-5 truncate text-sm font-semibold text-primary">{email}</p>

              <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="otp-input">
                {t(lang, "authEnterCode")}
              </label>
              <input
                id="otp-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={10}
                value={otp}
                onChange={(e) => { setOtp(e.target.value.replace(/[^0-9]/g, "")); setError(null); }}
                placeholder="12345678"
                className="mb-1 w-full rounded-xl border border-border bg-background px-4 py-3 text-center text-2xl font-semibold tracking-[0.3em] text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                autoFocus
              />

              {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

              <button
                type="submit"
                disabled={submitting || !/^\d{6,10}$/.test(otp)}
                className="mt-4 inline-flex min-h-[52px] w-full items-center justify-center rounded-xl bg-primary px-6 font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? t(lang, "authVerifying") : t(lang, "authConfirm")}
              </button>

              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0}
                  className="underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {resendCooldown > 0 ? t(lang, "authResendIn", { n: String(resendCooldown) }) : t(lang, "authResend")}
                </button>
                <button
                  type="button"
                  onClick={() => { setScreen("capture"); setOtp(""); setError(null); }}
                  className="underline-offset-2 hover:underline"
                >
                  {t(lang, "authChangeEmail")}
                </button>
              </div>
            </form>
          )}

          {/* ── Capture / password screens ── */}
          {screen !== "otp" && (
            <form onSubmit={screen === "password" ? handlePassword : handleSendOtp} noValidate>
              {!loginMode && (
                <div className="mb-4">
                  <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="auth-firstname">
                    {t(lang, "authFirstName")}
                  </label>
                  <input
                    id="auth-firstname"
                    type="text"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => { setFirstName(e.target.value); setError(null); }}
                    placeholder={t(lang, "authFirstNamePlaceholder")}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    autoFocus
                  />
                </div>
              )}

              <div className="mb-1">
                <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="auth-email">
                  {t(lang, "authEmailAddress")}
                </label>
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null); }}
                  placeholder="you@example.com"
                  autoFocus={loginMode}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <p className="mb-4 text-xs text-muted-foreground">
                {t(lang, "authNoPassword")}
              </p>

              {screen === "password" && (
                <div className="mb-4">
                  <label className="mb-1 block text-sm font-medium text-foreground" htmlFor="auth-password">
                    {t(lang, "authPassword")}
                  </label>
                  <div className="relative">
                    <input
                      id="auth-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(null); }}
                      placeholder={t(lang, "authPasswordPlaceholder")}
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 pr-12 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? t(lang, "authHidePassword") : t(lang, "authShowPassword")}
                    </button>
                  </div>
                </div>
              )}

              {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-[52px] w-full items-center justify-center rounded-xl bg-primary px-6 font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting
                  ? t(lang, "authVerifying")
                  : screen === "password"
                  ? t(lang, "authConfirm")
                  : t(lang, "authContinueOtp")}
              </button>

              {screen === "password" ? (
                <button
                  type="button"
                  onClick={() => { setScreen("capture"); setPassword(""); setError(null); }}
                  className="mt-3 block w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  {t(lang, "authForgotPassword")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => { setScreen("password"); setError(null); }}
                  className="mt-3 block w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  {t(lang, "authUsePassword")}
                </button>
              )}
            </form>
          )}
        </div>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          {t(lang, "authTermsPrefix")}{" "}
          <a href="/terms" className="underline underline-offset-2 hover:text-foreground">{t(lang, "authTerms")}</a>
          {" "}{t(lang, "authTermsAnd")}{" "}
          <a href="/privacy" className="underline underline-offset-2 hover:text-foreground">{t(lang, "authPrivacy")}</a>.
        </p>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

type StepProps = {
  data: CVData;
  update: <K extends keyof CVData>(key: K, value: CVData[K]) => void;
  displayLang: string;
  originalLang: string;
  onToggleLang: () => void;
  onBack?: () => void;
  onNext: () => void;
};

type Step1Props = {
  data: CVData;
  update: <K extends keyof CVData>(key: K, value: CVData[K]) => void;
  onNext: () => void;
};

function LangToggle({
  displayLang,
  originalLang,
  onToggle,
}: {
  displayLang: string;
  originalLang: string;
  onToggle: () => void;
}) {
  if (!originalLang || originalLang === "en") return null;
  const otherCode = displayLang === "en" ? originalLang : "en";
  const otherLang = languages.find((l) => l.code === otherCode);
  const label = otherCode === "en" ? "English" : otherLang?.native ?? otherLang?.name ?? otherCode;
  return (
    <div className="sticky top-2 z-30 -mt-2 mb-2 flex justify-end px-1 sm:absolute sm:right-4 sm:top-4 sm:mb-0 sm:mt-0 sm:px-0">
      <button
        type="button"
        onClick={onToggle}
        aria-label={`Switch to ${label}`}
        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-border bg-background/95 px-3 py-2 text-xs font-medium text-foreground shadow-sm backdrop-blur transition hover:bg-muted"
      >
        <span aria-hidden="true">🌐</span>
        <span>{label}</span>
      </button>
    </div>
  );
}

function StepShell({
  step,
  title,
  subtitle,
  nextDisabled,
  onBack,
  onNext,
  qLang,
  originalLang,
  onToggleLang,
  children,
}: {
  step: number;
  title: string;
  subtitle: string;
  nextDisabled?: boolean;
  onBack?: () => void;
  onNext: () => void;
  qLang?: string;
  originalLang?: string;
  onToggleLang?: () => void;
  children: React.ReactNode;
}) {
  const dir = qLang && ["ar", "ur", "fa", "ku"].includes(qLang) ? "rtl" : "ltr";
  return (
    <section className="relative px-4 pb-28 pt-8 sm:px-6 sm:pb-8 lg:px-8" dir={dir}>
      {originalLang && originalLang !== "en" && onToggleLang && (
        <LangToggle displayLang={qLang || "en"} originalLang={originalLang} onToggle={onToggleLang} />
      )}
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-2" aria-label={t(qLang, "stepOf", { n: step, total: 7 })}>
            {Array.from({ length: 7 }, (_, index) => (
              <div
                key={index}
                className={`h-2 flex-1 rounded-full ${index + 1 <= step ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>
          <p className="mb-2 text-sm font-medium text-muted-foreground">{t(qLang, "stepOf", { n: step, total: 7 })}</p>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground sm:text-4xl">{title}</h1>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">{subtitle}</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">{children}</div>

        <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mt-6 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-border bg-background px-5 py-3 font-medium text-foreground transition hover:bg-muted"
            >
              {t(qLang, "back")}
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled}
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t(qLang, "continue")}
          </button>
        </div>
      </div>
    </section>
  );
}

function Step1Language({ data, update, onNext }: Step1Props) {
  const [showModal, setShowModal] = useState(false);
  const selectedLang = languages.find((l) => l.code === data.languageCode);

  const handleContinue = () => {
    if (!selectedLang) return;
    if (selectedLang.code === "en") {
      update("questionLanguageCode", "en");
      onNext();
    } else {
      setShowModal(true);
    }
  };

  const choose = (code: string) => {
    update("questionLanguageCode", code);
    setShowModal(false);
    onNext();
  };

  return (
    <>
      <StepShell
        step={1}
        title="What language would you like to use?"
        subtitle="Answer in the language that feels easiest for you."
        onNext={handleContinue}
        nextDisabled={!data.languageCode}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {languages.map((language) => {
            const selected = data.languageCode === language.code;
            return (
              <button
                key={language.code}
                type="button"
                onClick={() => {
                  update("languageCode", language.code);
                  update("language", language.name);
                  if (language.code === "en") {
                    update("questionLanguageCode", "en");
                    onNext();
                  } else {
                    setShowModal(true);
                  }
                }}
                className={`rounded-xl border p-4 text-left transition ${
                  selected ? "border-primary bg-primary/10 ring-2 ring-primary/30" : "border-border bg-background hover:bg-muted"
                }`}
              >
                <span className="block text-2xl" aria-hidden="true">{language.flag}</span>
                <span className="mt-2 block font-medium text-foreground">{language.name}</span>
                <span className="block text-sm text-muted-foreground">{language.native}</span>
              </button>
            );
          })}
          <ComingSoonCard />
        </div>
      </StepShell>
      {showModal && selectedLang && (
        <LanguageChoiceModal
          lang={selectedLang}
          onChoose={choose}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

function ComingSoonCard() {
  return (
    <div
      aria-disabled="true"
      className="flex flex-col items-start justify-center rounded-xl border-2 border-dashed border-border bg-muted/40 p-4 text-left opacity-70"
    >
      <Clock className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      <span className="mt-2 block font-medium text-muted-foreground">More languages</span>
      <span className="block text-sm text-muted-foreground">coming soon…</span>
    </div>
  );
}

function LanguageChoiceModal({
  lang,
  onChoose,
  onClose,
}: {
  lang: { code: string; name: string; native: string };
  onChoose: (code: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-foreground">
          {t(lang.code, "modalQuestion").replace("{lang}", lang.native)}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your CV will always be generated in both {lang.name} and English.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => onChoose(lang.code)}
            className="flex-1 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground transition hover:opacity-90"
          >
            {lang.native}
          </button>
          <button
            type="button"
            onClick={() => onChoose("en")}
            className="flex-1 rounded-xl border border-border bg-background px-4 py-3 font-medium text-foreground transition hover:bg-muted"
          >
            English
          </button>
        </div>
      </div>
    </div>
  );
}

function Step2JobType({ data, update, displayLang, originalLang, onToggleLang, onBack, onNext }: StepProps) {
  const toggle = (id: string) => {
    const selected = new Set(data.jobTypes);
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    update("jobTypes", Array.from(selected));
  };

  return (
    <StepShell
      step={2}
      qLang={displayLang}
      originalLang={originalLang}
      onToggleLang={onToggleLang}
      title={t(displayLang, "step2Title")}
      subtitle={t(displayLang, "step2Subtitle")}
      onBack={onBack}
      onNext={onNext}
      nextDisabled={data.jobTypes.length === 0}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {jobs.map((job) => {
          const selected = data.jobTypes.includes(job.id);
          return (
            <button
              key={job.id}
              type="button"
              onClick={() => toggle(job.id)}
              className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                selected ? "border-primary bg-primary/10 ring-2 ring-primary/30" : "border-border bg-background hover:bg-muted"
              }`}
            >
              <span className="text-2xl" aria-hidden="true">{job.emoji}</span>
              <span className="font-medium text-foreground">{t(displayLang, job.tKey)}</span>
            </button>
          );
        })}
      </div>

      {data.jobTypes.includes("other") && (
        <TextField
          className="mt-4"
          label={t(displayLang, "otherWorkType")}
          value={data.otherJobType}
          onChange={(value) => update("otherJobType", value)}
          placeholder={t(displayLang, "otherWorkPlaceholder")}
        />
      )}
    </StepShell>
  );
}

function isValidUKPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s-]/g, "");
  if (/^07\d{9}$/.test(cleaned)) return true;
  if (/^\+44\d{10}$/.test(cleaned)) return true;
  return false;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function Step3PersonalDetails({ data, update, displayLang, originalLang, onToggleLang, onBack, onNext }: StepProps) {
  const personal = data.personalDetails;
  const setPersonal = (key: keyof PersonalDetails, value: string) => {
    update("personalDetails", { ...personal, [key]: value });
  };
  const isOther = personal.rightToWork.startsWith("Other:") || personal.rightToWork === "Other / not sure";
  const otherDetail = personal.rightToWork.startsWith("Other:") ? personal.rightToWork.slice(6).trim() : "";
  const phoneValid = isValidUKPhone(personal.phone);
  const emailValid = isValidEmail(personal.email);
  const valid = Boolean(
    personal.name &&
      phoneValid &&
      emailValid &&
      personal.city &&
      personal.rightToWork &&
      (!isOther || otherDetail.length > 0),
  );

  return (
    <StepShell
      step={3}
      qLang={displayLang}
      originalLang={originalLang}
      onToggleLang={onToggleLang}
      title={t(displayLang, "step3Title")}
      subtitle={t(displayLang, "step3Subtitle")}
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!valid}
    >
      <div className="space-y-4">
        <TextField label={t(displayLang, "fullName")} value={personal.name} onChange={(value) => setPersonal("name", value)} placeholder={t(displayLang, "namePlaceholder")} />
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">{t(displayLang, "phoneNumber")}</label>
          <div className={`flex items-center rounded-xl border bg-background focus-within:ring-2 focus-within:ring-primary/30 ${personal.phone && !phoneValid ? "border-destructive" : "border-border focus-within:border-primary"}`}>
            <span className="pl-4 pr-2 text-lg select-none" aria-hidden="true">🇬🇧</span>
            <input
              type="tel"
              value={personal.phone}
              onChange={(e) => setPersonal("phone", e.target.value)}
              placeholder="07… or +44…"
              className="w-full bg-transparent py-3 pr-4 text-foreground outline-none"
            />
          </div>
          {personal.phone && !phoneValid && (
            <p className="mt-1 text-sm text-destructive">{t(displayLang, "invalidPhone")}</p>
          )}
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">{t(displayLang, "email")}</label>
          <input
            type="email"
            value={personal.email}
            onChange={(e) => setPersonal("email", e.target.value)}
            placeholder="you@example.com"
            className={`w-full rounded-xl border bg-background px-4 py-3 text-foreground outline-none focus:ring-2 focus:ring-primary/30 ${personal.email && !emailValid ? "border-destructive" : "border-border focus:border-primary"}`}
          />
          {personal.email && !emailValid && (
            <p className="mt-1 text-sm text-destructive">{t(displayLang, "invalidEmail")}</p>
          )}
        </div>
        <TextField label={t(displayLang, "cityUk")} value={personal.city} onChange={(value) => setPersonal("city", value)} placeholder={t(displayLang, "cityPlaceholder")} />
        <TextField label={t(displayLang, "postcodeOptional")} value={personal.postcode} onChange={(value) => setPersonal("postcode", value)} placeholder={t(displayLang, "postcodePlaceholder")} />

        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">{t(displayLang, "rightToWork")}</label>
          <div className="grid gap-2 sm:grid-cols-2">
            {rightToWorkOptions.map((option) => {
              const selected =
                option.value === "Other / not sure" ? isOther : personal.rightToWork === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setPersonal(
                      "rightToWork",
                      option.value === "Other / not sure" ? "Other:" : option.value,
                    )
                  }
                  className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                    selected
                      ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  {t(displayLang, option.tKey)}
                </button>
              );
            })}
          </div>
          {isOther && (
            <div className="mt-3">
              <TextField
                label={t(displayLang, "describeStatus")}
                value={otherDetail}
                onChange={(value) => setPersonal("rightToWork", `Other: ${value}`)}
                placeholder={t(displayLang, "describeStatusPlaceholder")}
              />
            </div>
          )}
        </div>
      </div>
    </StepShell>
  );
}

function Step4Experience({ data, update, displayLang, originalLang, onToggleLang, onBack, onNext }: StepProps) {
  const [showError, setShowError] = useState(false);
  const requiresEntries = data.experienceType && data.experienceType !== "none";

  useEffect(() => {
    if (requiresEntries && data.experience.length === 0) {
      update("experience", [{ title: "", place: "", country: "", duration: "", description: "" }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.experienceType]);

  const addExperience = () => {
    update("experience", [...data.experience, { title: "", place: "", country: "", duration: "", description: "" }]);
  };
  const updateExperience = (index: number, key: keyof Experience, value: string) => {
    update(
      "experience",
      data.experience.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)),
    );
  };
  const removeExperience = (index: number) => {
    update("experience", data.experience.filter((_, itemIndex) => itemIndex !== index));
  };

  const hasValidEntry = data.experience.some((e) => e.title.trim() && e.duration.trim());
  const valid = Boolean(
    data.experienceType && (data.experienceType === "none" || hasValidEntry),
  );

  const handleNext = () => {
    if (!valid) {
      setShowError(true);
      return;
    }
    setShowError(false);
    onNext();
  };

  return (
    <StepShell
      step={4}
      qLang={displayLang}
      originalLang={originalLang}
      onToggleLang={onToggleLang}
      title={t(displayLang, "step4Title")}
      subtitle={t(displayLang, "step4Subtitle")}
      onBack={onBack}
      onNext={handleNext}
      nextDisabled={!valid}
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {experienceTypes.map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => {
                update("experienceType", type.id);
                if (type.id === "none") update("experience", []);
                setShowError(false);
              }}
              className={`rounded-xl border p-4 text-left transition ${
                data.experienceType === type.id
                  ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                  : "border-border bg-background hover:bg-muted"
              }`}
            >
              <span className="block font-medium text-foreground">{t(displayLang, type.tKey)}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{t(displayLang, type.descKey)}</span>
            </button>
          ))}
        </div>

        {requiresEntries && (
          <div className="space-y-4">
            {data.experience.map((experience, index) => (
              <div key={index} className="rounded-xl border border-border bg-background p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="font-medium text-foreground">{t(displayLang, "experienceN", { n: index + 1 })}</h2>
                  <button type="button" onClick={() => removeExperience(index)} className="text-sm font-medium text-muted-foreground hover:text-foreground">
                    {t(displayLang, "remove")}
                  </button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label={t(displayLang, "roleOrActivity")} value={experience.title} onChange={(value) => updateExperience(index, "title", value)} placeholder={t(displayLang, "rolePlaceholder")} />
                  <TextField label={t(displayLang, "company")} value={experience.place} onChange={(value) => updateExperience(index, "place", value)} placeholder={t(displayLang, "placePlaceholder")} />
                  <CountrySelect label={t(displayLang, "country")} value={experience.country} onChange={(value) => updateExperience(index, "country", value)} placeholder={t(displayLang, "selectCountry")} />
                  <TextField label={t(displayLang, "dates")} value={experience.duration} onChange={(value) => updateExperience(index, "duration", value)} placeholder="2022–2024" />
                  <TextField label={t(displayLang, "whatYouDid")} value={experience.description} onChange={(value) => updateExperience(index, "description", value)} placeholder={t(displayLang, "descriptionPlaceholder")} />
                </div>
              </div>
            ))}
            {showError && !valid && (
              <p className="text-sm font-medium text-destructive">{t(displayLang, "pleaseAddExperience")}</p>
            )}
            <button type="button" onClick={addExperience} className="rounded-xl border border-border bg-background px-4 py-3 font-medium text-foreground transition hover:bg-muted">
              {t(displayLang, "addExperience")}
            </button>
          </div>
        )}
      </div>
    </StepShell>
  );
}

function Step5Education({ data, update, displayLang, originalLang, onToggleLang, onBack, onNext }: StepProps) {
  const valid =
    data.hasEducation === "no" ||
    (data.hasEducation === "yes" && data.education.some((e) => e.qualification.trim()));

  return (
    <StepShell
      step={5}
      qLang={displayLang}
      originalLang={originalLang}
      onToggleLang={onToggleLang}
      title={t(displayLang, "educationTitle")}
      subtitle={t(displayLang, "educationSubtitle")}
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!valid}
    >
      <div className="space-y-5">
        <h2 className="font-medium text-foreground">{t(displayLang, "educationQuestion")}</h2>
        <div className="grid grid-cols-2 gap-3 sm:max-w-xs">
          <button
            type="button"
            onClick={() => {
              update("hasEducation", "yes");
              if (data.education.length === 0) {
                update("education", [{ qualification: "", institution: "", country: "", year: "" }]);
              }
            }}
            className={`rounded-xl border p-3 text-center font-medium transition ${
              data.hasEducation === "yes"
                ? "border-primary bg-primary/10 text-foreground ring-2 ring-primary/30"
                : "border-border bg-background text-foreground hover:bg-muted"
            }`}
          >
            {t(displayLang, "yes")}
          </button>
          <button
            type="button"
            onClick={() => {
              update("hasEducation", "no");
              update("education", []);
            }}
            className={`rounded-xl border p-3 text-center font-medium transition ${
              data.hasEducation === "no"
                ? "border-primary bg-primary/10 text-foreground ring-2 ring-primary/30"
                : "border-border bg-background text-foreground hover:bg-muted"
            }`}
          >
            {t(displayLang, "no")}
          </button>
        </div>

        {data.hasEducation === "no" && (
          <p className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
            {t(displayLang, "noEducationMessage")}
          </p>
        )}

        {data.hasEducation === "yes" && (
          <div className="space-y-4">
            {data.education.map((edu, index) => (
              <div key={index} className="rounded-xl border border-border bg-background p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="font-medium text-foreground">{t(displayLang, "educationN", { n: index + 1 })}</h3>
                  <button
                    type="button"
                    onClick={() => update("education", data.education.filter((_, i) => i !== index))}
                    className="text-sm font-medium text-muted-foreground hover:text-foreground"
                  >
                    {t(displayLang, "remove")}
                  </button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    label={t(displayLang, "qualificationName")}
                    value={edu.qualification}
                    onChange={(v) => update("education", data.education.map((e, i) => i === index ? { ...e, qualification: v } : e))}
                    placeholder="e.g. GCSE Maths, NVQ Level 2, Diploma in Care, Secondary School"
                  />
                  <TextField
                    label={t(displayLang, "institution")}
                    value={edu.institution}
                    onChange={(v) => update("education", data.education.map((e, i) => i === index ? { ...e, institution: v } : e))}
                    placeholder="e.g. City College, Birmingham Adult Education"
                  />
                  <CountrySelect
                    label={t(displayLang, "country")}
                    value={edu.country}
                    onChange={(v) => update("education", data.education.map((e, i) => i === index ? { ...e, country: v } : e))}
                    placeholder={t(displayLang, "selectCountry")}
                  />
                  <TextField
                    label={t(displayLang, "yearCompleted")}
                    value={edu.year}
                    onChange={(v) => update("education", data.education.map((e, i) => i === index ? { ...e, year: v } : e))}
                    placeholder={t(displayLang, "yearPlaceholder")}
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => update("education", [...data.education, { qualification: "", institution: "", country: "", year: "" }])}
              className="rounded-xl border border-border bg-background px-4 py-3 font-medium text-foreground transition hover:bg-muted"
            >
              {t(displayLang, "addQualification")}
            </button>
          </div>
        )}
      </div>
    </StepShell>
  );
}

function Step6Skills({ data, update, displayLang, originalLang, onToggleLang, onBack, onNext }: StepProps) {
  const [customSkill, setCustomSkill] = useState("");
  const toggleValue = (key: "skills" | "availability", value: string) => {
    const selected = new Set(data[key]);
    if (selected.has(value)) selected.delete(value);
    else selected.add(value);
    update(key, Array.from(selected));
  };
  const addCustomSkill = () => {
    const skill = customSkill.trim();
    if (!skill || data.skills.includes(skill)) return;
    update("skills", [...data.skills, skill]);
    setCustomSkill("");
  };

  const suggestedValues = suggestedSkills.map((s) => s.value);

  return (
    <StepShell
      step={6}
      qLang={displayLang}
      originalLang={originalLang}
      onToggleLang={onToggleLang}
      title={t(displayLang, "step5Title")}
      subtitle={t(displayLang, "step5Subtitle")}
      onBack={onBack}
      onNext={onNext}
      nextDisabled={data.skills.length === 0 || data.availability.length === 0}
    >
      <div className="space-y-6">
        <div>
          <h2 className="mb-3 font-medium text-foreground">{t(displayLang, "skills")}</h2>
          <div className="flex flex-wrap gap-2">
            {suggestedSkills.map((skill) => (
              <Chip key={skill.value} selected={data.skills.includes(skill.value)} onClick={() => toggleValue("skills", skill.value)}>
                {t(displayLang, skill.tKey)}
              </Chip>
            ))}
            {data.skills
              .filter((skill) => !suggestedValues.includes(skill))
              .map((skill) => (
                <Chip key={skill} selected onClick={() => toggleValue("skills", skill)}>
                  {skill}
                </Chip>
              ))}
          </div>
          <div className="mt-4 flex gap-2">
            <input
              value={customSkill}
              onChange={(event) => setCustomSkill(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCustomSkill();
                }
              }}
              placeholder={t(displayLang, "addAnotherSkill")}
              className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-3 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
            <button type="button" onClick={addCustomSkill} className="rounded-xl bg-secondary px-4 py-3 font-medium text-secondary-foreground transition hover:opacity-90">
              {t(displayLang, "add")}
            </button>
          </div>
        </div>
        <div>
          <h2 className="mb-3 font-medium text-foreground">{t(displayLang, "availability")}</h2>
          <div className="flex flex-wrap gap-2">
            {availabilityOptions.map((option) => (
              <Chip key={option.value} selected={data.availability.includes(option.value)} onClick={() => toggleValue("availability", option.value)}>
                {t(displayLang, option.tKey)}
              </Chip>
            ))}
          </div>
        </div>
      </div>


    </StepShell>
  );
}

function Step7Review({ data, update, displayLang, originalLang, onToggleLang, onBack, onEdit }: {
  data: CVData;
  update: <K extends keyof CVData>(key: K, value: CVData[K]) => void;
  displayLang: string;
  originalLang: string;
  onToggleLang: () => void;
  onBack: () => void;
  onEdit: (step: number) => void;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);

  const handleGenerate = async () => {
    if (!consent || data.candidatePoolConsent === null) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await generateCV(data);
      sessionStorage.setItem("cvlingo:result", JSON.stringify(result));
      sessionStorage.setItem("cvlingo:input", JSON.stringify(data));
      localStorage.removeItem("cvlingo_form_data");

      // Record the CV document for logged-in users
      if (user) {
        const title = data.jobTypes.length > 0
          ? `${data.personalDetails.name} — ${data.jobTypes[0]}`
          : data.personalDetails.name || "My CV";
        void supabase
          .from("cv_documents")
          .insert({ user_id: user.id, title, status: "draft" });
      }

      if (data.candidatePoolConsent === true) {
        const referralSource = (() => {
          try {
            return localStorage.getItem("cvlingo_referral") || null;
          } catch { return null; }
        })();
        const entry = {
          email: data.personalDetails.email,
          name: data.personalDetails.name,
          jobTypes: data.jobTypes,
          language: data.language,
          rightToWork: data.personalDetails.rightToWork,
          city: data.personalDetails.city,
          postcode: data.personalDetails.postcode || null,
          referralSource,
          timestamp: new Date().toISOString(),
        };
        addCandidate(entry);
        void notifyCandidate(entry);
      }
      navigate({ to: "/result" });
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : t(displayLang, "somethingWrong"));
      setGenerating(false);
    }
  };


  const jobLabels = useMemo(
    () =>
      data.jobTypes
        .map((id) => {
          if (id === "other") return data.otherJobType || t(displayLang, "job_other");
          const job = jobs.find((j) => j.id === id);
          return job ? t(displayLang, job.tKey) : null;
        })
        .filter(Boolean)
        .join(", "),
    [data.jobTypes, data.otherJobType, displayLang],
  );

  const skillLabels = useMemo(
    () =>
      data.skills
        .map((s) => {
          const found = suggestedSkills.find((x) => x.value === s);
          return found ? t(displayLang, found.tKey) : s;
        })
        .join(", "),
    [data.skills, displayLang],
  );

  const availabilityLabels = useMemo(
    () =>
      data.availability
        .map((a) => {
          const found = availabilityOptions.find((x) => x.value === a);
          return found ? t(displayLang, found.tKey) : a;
        })
        .join(", "),
    [data.availability, displayLang],
  );

  const rtwLabel = useMemo(() => {
    const v = data.personalDetails.rightToWork;
    if (!v) return "";
    if (v.startsWith("Other:")) {
      return `${t(displayLang, "rtw_other")}: ${v.slice(6).trim()}`;
    }
    const found = rightToWorkOptions.find((x) => x.value === v);
    return found ? t(displayLang, found.tKey) : v;
  }, [data.personalDetails.rightToWork, displayLang]);

  const experienceTypeLabel = useMemo(() => {
    const found = experienceTypes.find((x) => x.id === data.experienceType);
    return found ? t(displayLang, found.tKey) : "";
  }, [data.experienceType, displayLang]);

  const dir = ["ar", "ur", "fa", "ku"].includes(displayLang) ? "rtl" : "ltr";

  return (
    <section className="relative px-4 pb-28 pt-8 sm:px-6 sm:pb-8 lg:px-8" dir={dir}>
      {originalLang && originalLang !== "en" && (
        <LangToggle displayLang={displayLang} originalLang={originalLang} onToggle={onToggleLang} />
      )}
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <p className="mb-2 text-sm font-medium text-muted-foreground">{t(displayLang, "stepOf", { n: 7, total: 7 })}</p>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground sm:text-4xl">{t(displayLang, "step6Title")}</h1>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">{t(displayLang, "step6Subtitle")}</p>
        </div>
        <div className="space-y-4">
          <LanguageReviewSection
            currentName={data.language}
            displayLang={displayLang}
            onSelect={(lang) => {
              update("languageCode", lang.code);
              update("language", lang.name);
            }}
          />
          <ReviewSection title={t(displayLang, "workWanted")} editLabel={t(displayLang, "edit")} onEdit={() => onEdit(2)}>{jobLabels || t(displayLang, "notSelected")}</ReviewSection>
          <ReviewSection title={t(displayLang, "personalDetails")} editLabel={t(displayLang, "edit")} onEdit={() => onEdit(3)}>
            <p>{data.personalDetails.name || t(displayLang, "nameMissing")}</p>
            <p>{data.personalDetails.phone || t(displayLang, "phoneMissing")}</p>
            <p>{data.personalDetails.email || t(displayLang, "emailMissing")}</p>
            <p>{data.personalDetails.city || t(displayLang, "cityMissing")}</p>
            <p>{rtwLabel || t(displayLang, "rtwMissing")}</p>
          </ReviewSection>
          <ReviewSection title={t(displayLang, "experience")} editLabel={t(displayLang, "edit")} onEdit={() => onEdit(4)}>
            {data.experienceType === "none" ? (
              <p>{t(displayLang, "noExperienceYet")}</p>
            ) : (
              <>
                {experienceTypeLabel && <p className="mb-2 font-medium text-foreground">{experienceTypeLabel}</p>}
                {data.experience.length ? (
                  <ul className="space-y-2">
                    {data.experience.map((item, index) => (
                      <li key={index}>
                        <span className="font-medium text-foreground">{item.title || t(displayLang, "roleOrActivity")}</span>
                        {item.place && ` — ${item.place}`}
                        {item.country && `, ${item.country}`}
                        {item.duration && ` (${item.duration})`}
                        {item.description && <span className="block text-sm text-muted-foreground">{item.description}</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>{t(displayLang, "notAdded")}</p>
                )}
              </>
            )}
          </ReviewSection>
          <ReviewSection title={t(displayLang, "skillsAndAvailability")} editLabel={t(displayLang, "edit")} onEdit={() => onEdit(6)}>
            <p>{skillLabels || t(displayLang, "noSkills")}</p>
            <p>{availabilityLabels || t(displayLang, "noAvailability")}</p>
          </ReviewSection>
          <ReviewSection title={t(displayLang, "education")} editLabel={t(displayLang, "edit")} onEdit={() => onEdit(5)}>
            {data.education.length === 0 ? (
              <p>{t(displayLang, "noEducation")}</p>
            ) : (
              <ul className="space-y-1">
                {data.education.map((e, i) => (
                  <li key={i}>
                    <span className="font-medium text-foreground">{e.qualification || t(displayLang, "qualificationName")}</span>
                    {e.institution && ` — ${e.institution}`}
                    {e.country && `, ${e.country}`}
                    {e.year && ` (${e.year})`}
                  </li>
                ))}
              </ul>
            )}
          </ReviewSection>


        </div>
        {error && (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <p className="font-medium">{t(displayLang, "somethingWrong")}</p>
            <p className="mt-1 opacity-80">{error}</p>
            <button type="button" onClick={handleGenerate} className="mt-3 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:opacity-90">
              {t(displayLang, "retry")}
            </button>
          </div>
        )}
        <div className="mt-6 rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold text-foreground">{t(displayLang, "poolHeading")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t(displayLang, "poolSubtext")}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => update("candidatePoolConsent", true)}
              className={`inline-flex items-center rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                data.candidatePoolConsent === true
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-muted"
              }`}
            >
              {t(displayLang, "poolYes")}
            </button>
            <button
              type="button"
              onClick={() => update("candidatePoolConsent", false)}
              className={`inline-flex items-center rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                data.candidatePoolConsent === false
                  ? "border-muted-foreground bg-muted text-foreground"
                  : "border-border bg-background text-foreground hover:bg-muted"
              }`}
            >
              {t(displayLang, "poolNo")}
            </button>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-border bg-card p-4">
          <label className="flex items-start gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 accent-primary"
            />
            <span>
              {t(displayLang, "consentText")}{" "}
              <Link to="/privacy" className="text-primary underline hover:opacity-80">
                {t(displayLang, "readPrivacyPolicy")}
              </Link>
              .
            </span>
          </label>
        </div>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <span aria-hidden="true">🔒</span>
          <span>{t(displayLang, "privacyLock")}</span>
        </p>
        <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mt-4 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
          <button type="button" onClick={onBack} className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-border bg-background px-5 py-3 font-medium text-foreground transition hover:bg-muted">
            {t(displayLang, "back")}
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !consent || data.candidatePoolConsent === null}
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? t(displayLang, "generating") : t(displayLang, "generateCv")}
          </button>
        </div>
      </div>
      {generating && <GeneratingOverlay lang={originalLang} />}
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-2 block text-sm font-medium text-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
      />
    </div>
  );
}

const COUNTRIES = [
  "United Kingdom", "Poland", "Romania", "India", "Pakistan", "Portugal", "Spain",
  "Saudi Arabia", "Bangladesh", "France", "Turkey", "Nigeria", "Somalia", "China",
  "Iran", "Ukraine", "Kosovo", "Sri Lanka", "Ethiopia", "Eritrea", "Afghanistan",
  "Albania", "Algeria", "Angola", "Argentina", "Australia", "Austria", "Azerbaijan",
  "Bahrain", "Belarus", "Belgium", "Bolivia", "Bosnia", "Brazil", "Bulgaria",
  "Cambodia", "Cameroon", "Canada", "Chile", "Colombia", "Congo", "Croatia", "Cuba",
  "Czech Republic", "Denmark", "Dominican Republic", "Ecuador", "Egypt", "El Salvador",
  "Finland", "Georgia", "Germany", "Ghana", "Greece", "Guatemala", "Guinea", "Haiti",
  "Honduras", "Hungary", "Indonesia", "Iraq", "Ireland", "Israel", "Italy",
  "Ivory Coast", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kuwait",
  "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Libya", "Lithuania", "Macedonia",
  "Madagascar", "Malawi", "Malaysia", "Mali", "Mexico", "Moldova", "Mongolia",
  "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nepal", "Netherlands",
  "New Zealand", "Nicaragua", "Niger", "North Korea", "Norway", "Oman", "Palestine",
  "Panama", "Paraguay", "Peru", "Philippines", "Qatar", "Russia", "Rwanda", "Senegal",
  "Serbia", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "South Africa",
  "South Korea", "South Sudan", "Sudan", "Sweden", "Switzerland", "Syria", "Taiwan",
  "Tajikistan", "Tanzania", "Thailand", "Togo", "Tunisia", "Turkmenistan", "Uganda",
  "United Arab Emirates", "United States", "Uruguay", "Uzbekistan", "Venezuela",
  "Vietnam", "Yemen", "Zambia", "Zimbabwe", "Other",
];

function CountrySelect({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = query
    ? COUNTRIES.filter((c) => c.toLowerCase().includes(query.toLowerCase()))
    : COUNTRIES;

  return (
    <div className="relative">
      <label className="mb-2 block text-sm font-medium text-foreground">{label}</label>
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setQuery(""); }}
        className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-left text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>{value || placeholder}</span>
        <span className="ml-2 text-muted-foreground">▾</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <div className="p-2">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
          <ul className="max-h-52 overflow-y-auto">
            {filtered.map((country) => (
              <li key={country}>
                <button
                  type="button"
                  onClick={() => { onChange(country); setOpen(false); setQuery(""); }}
                  className={`w-full px-4 py-2 text-left text-sm transition hover:bg-muted ${value === country ? "bg-primary/10 font-medium text-primary" : "text-foreground"}`}
                >
                  {country}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-4 py-3 text-sm text-muted-foreground">No results</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
        selected ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

function ReviewSection({ title, editLabel, onEdit, children }: { title: string; editLabel?: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-semibold text-foreground">{title}</h2>
        <button type="button" onClick={onEdit} className="text-sm font-medium text-primary hover:opacity-80">
          {editLabel ?? "Edit"}
        </button>
      </div>
      <div className="text-sm leading-6 text-muted-foreground">{children}</div>
    </section>
  );
}

type LangOption = (typeof languages)[number];

function LanguageReviewSection({ currentName, displayLang, onSelect }: { currentName: string; displayLang?: string; onSelect: (lang: LangOption) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-semibold text-foreground">{t(displayLang, "language")}</h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="text-sm font-medium text-primary hover:opacity-80"
        >
          {open ? t(displayLang, "close") : t(displayLang, "edit")}
        </button>
      </div>
      <div className="text-sm leading-6 text-muted-foreground">{currentName || t(displayLang, "notSelected")}</div>
      {open && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {languages.map((lang) => {
            const selected = lang.name === currentName;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => {
                  onSelect(lang);
                  setOpen(false);
                }}
                className={`flex items-center gap-2 rounded-xl border p-3 text-left transition ${
                  selected ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-muted"
                }`}
              >
                <span className="text-xl" aria-hidden="true">{lang.flag}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">{lang.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{lang.native}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

export const Route = createFileRoute("/build")({
  codeSplitGroupings: [],
  head: () => ({
    meta: [
      { title: "Build Your CV — CVLingo" },
      { name: "description", content: "Build your professional UK CV in your own language, one simple question at a time." },
      { property: "og:title", content: "Build Your CV — CVLingo" },
      { property: "og:description", content: "Build your professional UK CV in your own language, one simple question at a time." },
    ],
  }),
  component: BuildPage,
});
