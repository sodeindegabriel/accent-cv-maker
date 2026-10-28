import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export const Route = createFileRoute("/partner/login")({
  codeSplitGroupings: [],
  component: PartnerLogin,
});

function PartnerLogin() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "otp" | "claiming" | "no-team">("email");
  const [otp, setOtp] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);

  // If already signed in as a partner member, redirect to dashboard
  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data } = await supabase.rpc("claim_partner_account");
        if (data) {
          void navigate({ to: "/partner/dashboard", replace: true });
          return;
        }
      }
      setChecking(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  async function sendOtp(emailAddr: string) {
    setSending(true); setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: emailAddr,
      options: { shouldCreateUser: true },
    });
    setSending(false);
    if (err) { setError("Could not send a code. Please check the email and try again."); return; }
    setStep("otp");
    setResendCountdown(60);
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    await sendOtp(trimmed);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const token = otp.trim();
    if (token.length < 6) return;
    setVerifying(true); setError(null);
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token,
      type: "email",
    });
    if (err) {
      setError("That code is incorrect or has expired. Please try again.");
      setVerifying(false); return;
    }
    setStep("claiming");
    const { data } = await supabase.rpc("claim_partner_account");
    if (data) {
      void navigate({ to: "/partner/dashboard", replace: true });
    } else {
      setStep("no-team");
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src="/cvlingo-logo.svg" alt="CVLingo" className="mx-auto mb-4 h-12 w-12 rounded-full" />
          <h1 className="text-2xl font-bold text-foreground">Partner sign-in</h1>
        </div>

        {step === "email" && (
          <>
            <p className="mb-6 text-center text-sm text-muted-foreground">
              Enter the work email your manager invited. We will email you a code. No password needed.
            </p>
            <form onSubmit={(e) => void handleSendOtp(e)} className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <button
                type="submit"
                disabled={sending || !email.trim()}
                className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 min-h-[44px]"
              >
                {sending ? "Sending…" : "Send code"}
              </button>
            </form>
          </>
        )}

        {step === "otp" && (
          <>
            <p className="mb-6 text-center text-sm text-muted-foreground">
              We sent a 6-digit code to{" "}
              <strong className="text-foreground">{email}</strong>. Check your spam folder if it
              does not arrive within a minute.
            </p>
            <form onSubmit={(e) => void handleVerify(e)} className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">6-digit code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  required
                  autoFocus
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-center text-lg tracking-widest text-foreground outline-none focus:border-primary"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <button
                type="submit"
                disabled={verifying || otp.length < 6}
                className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 min-h-[44px]"
              >
                {verifying ? "Verifying…" : "Verify code"}
              </button>
            </form>
            <div className="mt-4 flex flex-col items-center gap-2">
              {resendCountdown > 0 ? (
                <p className="text-xs text-muted-foreground">Resend available in {resendCountdown}s</p>
              ) : (
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => void sendOtp(email.trim().toLowerCase())}
                  className="text-sm text-primary hover:opacity-80 disabled:opacity-50"
                >
                  {sending ? "Sending…" : "Resend code"}
                </button>
              )}
              <button
                type="button"
                onClick={() => { setStep("email"); setOtp(""); setError(null); }}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Use a different email
              </button>
            </div>
          </>
        )}

        {step === "claiming" && (
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Looking up your partner account…</p>
          </div>
        )}

        {step === "no-team" && (
          <div className="text-center">
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-5 text-left">
              <p className="mb-2 text-sm font-medium text-foreground">
                We could not find a partner team for this email.
              </p>
              <p className="text-sm text-muted-foreground">
                Ask your manager to invite you, and check that they used exactly this email
                address:{" "}
                <strong className="text-foreground">{email}</strong>
              </p>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Need help?{" "}
              <a href="mailto:hello@cvlingo.com" className="text-primary hover:underline">
                hello@cvlingo.com
              </a>
            </p>
            <button
              type="button"
              onClick={() => { setStep("email"); setEmail(""); setOtp(""); setError(null); }}
              className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 min-h-[44px]"
            >
              Try another email
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
