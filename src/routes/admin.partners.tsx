import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import emailjs from "@emailjs/browser";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined;
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY  as string | undefined;

// ── Types ──────────────────────────────────────────────────────────────────────
interface Partner {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  referral_code: string;
  is_active: boolean;
  created_at: string;
  referral_count?: number;
}

// ── Email helper ───────────────────────────────────────────────────────────────
async function sendPartnerInviteEmail(partner: {
  name: string;
  email: string;
  referral_code: string;
}) {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    console.warn("[partner invite] EmailJS env vars missing — skipping email");
    return;
  }
  const referralUrl = `https://www.cvlingo.com/?ref=${partner.referral_code}`;
  const subject = "You're a CVLingo Partner — here's your referral link";
  const message = [
    `Hi ${partner.name},`,
    "",
    "Welcome to CVLingo! Here's your partner referral link:",
    referralUrl,
    "",
    "Share this link with your members — every CV they build will be tracked in your partner dashboard, so you can see your impact at a glance.",
    "",
    "To access your dashboard:",
    "Go to cvlingo.com, click Log in, and enter this email address to receive a one-time login code. You can set a password later from your dashboard if you'd prefer not to use a code each time.",
    "",
    "Feel free to share the referral link however works best for your organisation — by email, WhatsApp, printed in a newsletter, or anything else.",
    "",
    "Any questions? Just reply to this email.",
    "",
    "The CVLingo team",
  ].join("\n");
  await emailjs.send(
    SERVICE_ID,
    TEMPLATE_ID,
    { to_email: partner.email, subject, message, name: partner.name },
    { publicKey: PUBLIC_KEY },
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Main component ─────────────────────────────────────────────────────────────
function AdminPartnersPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Invite form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Per-row busy states
  const [toggling, setToggling] = useState<Record<string, boolean>>({});
  const [resending, setResending] = useState<Record<string, boolean>>({});
  const [resendResult, setResendResult] = useState<Record<string, "ok" | "err">>({});

  // ── Auth guard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate({ to: "/build" }); return; }
    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data: p }) => {
        if (p?.role === "admin") {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
          navigate({ to: "/dashboard" });
        }
      });
  }, [authLoading, user, navigate]);

  // ── Load partners + referral counts ─────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin) return;
    void loadPartners();
  }, [isAdmin]);

  async function loadPartners() {
    setLoadError(null);
    const [{ data: rows, error }, referralCounts] = await Promise.all([
      supabase.from("partners").select("*").order("created_at", { ascending: false }),
      supabase
        .from("partner_referrals")
        .select("referral_code")
        .then(({ data }) => {
          const map: Record<string, number> = {};
          for (const r of data ?? []) {
            map[r.referral_code] = (map[r.referral_code] ?? 0) + 1;
          }
          return map;
        }),
    ]);
    if (error) { setLoadError(error.message); return; }
    setPartners(
      (rows ?? []).map((p) => ({
        ...(p as Partner),
        referral_count: referralCounts[p.referral_code] ?? 0,
      })),
    );
  }

  // ── Invite partner (create + email) ─────────────────────────────────────────
  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    if (!name.trim() || !email.trim() || !referralCode.trim()) {
      setCreateError("All fields are required.");
      return;
    }
    const code = referralCode.trim().toLowerCase().replace(/\s+/g, "-");
    const trimmedName  = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    setCreating(true);
    const { error } = await supabase
      .from("partners")
      .insert({ name: trimmedName, email: trimmedEmail, referral_code: code });
    if (error) {
      setCreating(false);
      setCreateError(
        error.message.includes("duplicate") || error.message.includes("unique")
          ? "That email or referral code is already in use."
          : error.message,
      );
      return;
    }
    // Send invite email — fire-and-forget, don't block the UI on email success
    void sendPartnerInviteEmail({ name: trimmedName, email: trimmedEmail, referral_code: code }).catch(
      (err: unknown) => console.error("[partner invite] email send failed", err),
    );
    setName("");
    setEmail("");
    setReferralCode("");
    setCreating(false);
    void loadPartners();
  }

  // ── Resend invite ────────────────────────────────────────────────────────────
  async function handleResend(p: Partner) {
    setResending((r) => ({ ...r, [p.id]: true }));
    setResendResult((r) => { const n = { ...r }; delete n[p.id]; return n; });
    try {
      await sendPartnerInviteEmail(p);
      setResendResult((r) => ({ ...r, [p.id]: "ok" }));
    } catch (err) {
      console.error("[resend invite] failed", err);
      setResendResult((r) => ({ ...r, [p.id]: "err" }));
    } finally {
      setResending((r) => { const n = { ...r }; delete n[p.id]; return n; });
    }
    // Auto-clear result badge after 4 s
    setTimeout(() => setResendResult((r) => { const n = { ...r }; delete n[p.id]; return n; }), 4000);
  }

  // ── Toggle active ────────────────────────────────────────────────────────────
  async function handleToggleActive(p: Partner) {
    setToggling((t) => ({ ...t, [p.id]: true }));
    await supabase.from("partners").update({ is_active: !p.is_active }).eq("id", p.id);
    setPartners((prev) =>
      prev.map((r) => (r.id === p.id ? { ...r, is_active: !p.is_active } : r)),
    );
    setToggling((t) => { const n = { ...t }; delete n[p.id]; return n; });
  }

  // ── Loading / auth states ────────────────────────────────────────────────────
  if (authLoading || isAdmin === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!isAdmin) return null;

  const inputCls =
    "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4 flex items-center gap-3">
        <a href="/admin" className="text-sm text-gray-500 hover:underline">← Admin</a>
        <span className="text-gray-300">/</span>
        <h1 className="text-lg font-bold text-gray-900">Partners</h1>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
        {/* Invite form */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="mb-1 text-base font-semibold text-gray-900">Invite a partner</h2>
          <p className="mb-4 text-xs text-gray-500">
            Creates the partner account and sends them a welcome email with their referral link and login instructions.
          </p>
          <form onSubmit={(e) => void handleInvite(e)} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Organisation name</label>
                <input
                  className={inputCls}
                  placeholder="Wiltshire Refugee Network"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Login email</label>
                <input
                  className={inputCls}
                  type="email"
                  placeholder="partner@example.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Referral code</label>
                <input
                  className={inputCls}
                  placeholder="wiltshire"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                />
                <p className="mt-0.5 text-xs text-gray-400">
                  Lowercase, no spaces (hyphens ok). Becomes ?ref=code in the URL.
                </p>
              </div>
            </div>
            {createError && <p className="text-sm text-red-600">{createError}</p>}
            <button
              type="submit"
              disabled={creating}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {creating ? "Sending invite…" : "Send invite"}
            </button>
          </form>
        </div>

        {/* Partners table */}
        {loadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            Failed to load: {loadError}
          </div>
        )}

        {partners.length === 0 && !loadError ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-400">
            No partners yet. Send the first invite above.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Organisation</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Referral code</th>
                  <th className="px-4 py-3">Referred</th>
                  <th className="px-4 py-3">Claimed</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((p) => (
                  <tr
                    key={p.id}
                    className={`border-t border-gray-100 ${!p.is_active ? "opacity-50" : ""}`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3 text-gray-600">{p.email}</td>
                    <td className="px-4 py-3">
                      <code className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                        {p.referral_code}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-gray-900">
                      {p.referral_count ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      {p.user_id ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Yes
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-400">
                      {fmtDate(p.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={!!toggling[p.id]}
                        onClick={() => void handleToggleActive(p)}
                        className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 whitespace-nowrap ${
                          p.is_active
                            ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        }`}
                      >
                        {toggling[p.id] ? "…" : p.is_active ? "Revoke access" : "Reactivate"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!!resending[p.id]}
                          onClick={() => void handleResend(p)}
                          className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors whitespace-nowrap"
                        >
                          {resending[p.id] ? "Sending…" : "Resend invite"}
                        </button>
                        {resendResult[p.id] === "ok" && (
                          <span className="text-xs text-emerald-600 font-medium">Sent ✓</span>
                        )}
                        {resendResult[p.id] === "err" && (
                          <span className="text-xs text-red-600 font-medium">Failed</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

export const Route = createFileRoute("/admin/partners")({
  codeSplitGroupings: [],
  component: AdminPartnersPage,
});
