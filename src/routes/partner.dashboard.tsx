import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import emailjs from "@emailjs/browser";
import { QRCodeCanvas } from "qrcode.react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined;
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY  as string | undefined;

// ── Types ──────────────────────────────────────────────────────────────────────
interface PartnerDashboardData {
  partner_id: string;
  partner_name: string;
  referral_code: string;
  member_role: "owner" | "editor";
  member_count: number;
  total_cvs: number;
  month_cvs: number;
  total_candidates: number;
  lang_breakdown: Record<string, number>;
  job_breakdown: Record<string, number>;
  recent_candidates: Array<{
    display_name: string;
    language: string;
    opted_in_at: string;
    job_types: string[];
  }>;
}

// ── Email helper ───────────────────────────────────────────────────────────────
async function sendTeamInviteEmail(partnerName: string, inviteeEmail: string) {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    console.warn("[team invite] EmailJS env vars missing — skipping email");
    return;
  }
  const subject = `You've been invited to view ${partnerName}'s CVLingo dashboard`;
  const message = [
    `Hi,`,
    "",
    `You've been added as a team member on ${partnerName}'s CVLingo partner dashboard.`,
    "",
    "To access the dashboard:",
    "Go to cvlingo.com, click Log in, and enter this email address to receive a one-time login code. You can set a password later from your dashboard if you'd prefer not to use a code each time.",
    "",
    "The CVLingo team",
  ].join("\n");
  await emailjs.send(
    SERVICE_ID,
    TEMPLATE_ID,
    { to_email: inviteeEmail, subject, message, name: partnerName },
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

function currentMonthLabel() {
  return new Date().toLocaleString("en-GB", { month: "long", year: "numeric" });
}

function impactSummary(data: PartnerDashboardData): string {
  const topLangs = Object.entries(data.lang_breakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([lang]) => lang);
  const langStr =
    topLangs.length > 0
      ? ` in ${topLangs.length === 1 ? topLangs[0] : topLangs.slice(0, -1).join(", ") + " and " + topLangs[topLangs.length - 1]}`
      : "";
  return `In ${currentMonthLabel()}, ${data.month_cvs === 0 ? "no" : data.month_cvs} CV${data.month_cvs !== 1 ? "s" : ""} ${data.month_cvs === 1 ? "was" : "were"} built through ${data.partner_name}'s link${langStr}. ${data.total_candidates > 0 ? `${data.total_candidates} candidate${data.total_candidates !== 1 ? "s are" : " is"} in the talent pool.` : ""}`;
}

// ── Stat card ──────────────────────────────────────────────────────────────────
function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-6 py-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold text-foreground">{value}</p>
    </div>
  );
}

// ── Breakdown bar ──────────────────────────────────────────────────────────────
function BreakdownBar({ label, items }: { label: string; items: Record<string, number> }) {
  const entries = Object.entries(items).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (entries.length === 0) return null;
  const max = entries[0][1];
  return (
    <div className="rounded-2xl border border-border bg-card px-6 py-5">
      <p className="mb-4 text-sm font-semibold text-foreground">{label}</p>
      <div className="space-y-2">
        {entries.map(([key, count]) => (
          <div key={key} className="flex items-center gap-3">
            <span className="w-32 shrink-0 truncate text-xs text-muted-foreground">{key}</span>
            <div className="flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{ width: `${Math.max(4, (count / max) * 100)}%` }}
              />
            </div>
            <span className="w-6 shrink-0 text-right text-xs font-medium text-foreground">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── QR download ────────────────────────────────────────────────────────────────
function QRDownloadButton({ url, partnerName }: { url: string; partnerName: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  function handleDownload() {
    const canvas = document.querySelector<HTMLCanvasElement>("#partner-qr canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${partnerName.toLowerCase().replace(/\s+/g, "-")}-cvlingo-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div id="partner-qr" className="rounded-xl bg-white p-3 shadow-sm">
        <QRCodeCanvas value={url} size={160} level="M" ref={canvasRef} />
      </div>
      <button
        type="button"
        onClick={handleDownload}
        className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
      >
        Download QR PNG
      </button>
    </div>
  );
}

// ── Owner-only: invite team member ─────────────────────────────────────────────
const MEMBER_CAP = 2;

function InviteTeamMember({
  partnerId,
  partnerName,
  memberCount,
}: {
  partnerId: string;
  partnerName: string;
  memberCount: number;
}) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    setInviteError(null);
    setInviteSuccess(false);
    setInviting(true);
    try {
      const { error } = await supabase.rpc("invite_partner_member", {
        p_partner_id: partnerId,
        p_email: email,
      });
      if (error) {
        setInviteError(
          error.message.includes("already a member")
            ? "That email is already a team member."
            : error.message.includes("Only owners")
            ? "Only owners can invite team members."
            : error.message,
        );
        return;
      }
      // Send invite email — fire-and-forget
      void sendTeamInviteEmail(partnerName, email).catch((err: unknown) =>
        console.error("[team invite] email send failed", err),
      );
      setInviteEmail("");
      setInviteSuccess(true);
      setTimeout(() => setInviteSuccess(false), 5000);
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card px-6 py-6">
      <h2 className="mb-1 font-semibold text-foreground">Invite a team member</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Editors can view this dashboard. Only owners can invite others.
      </p>
      {memberCount >= MEMBER_CAP ? (
        <p className="rounded-xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          You've reached the team member limit ({MEMBER_CAP}) for now. Revoke an existing member to invite someone new.
        </p>
      ) : (
      <form onSubmit={(e) => void handleInvite(e)} className="flex flex-wrap gap-3">
        <input
          type="email"
          placeholder="colleague@example.org"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          className="flex-1 min-w-0 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={inviting || !inviteEmail.trim()}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
        >
          {inviting ? "Sending…" : "Send invite"}
        </button>
      </form>
      )}
      {inviteError && <p className="mt-2 text-sm text-destructive">{inviteError}</p>}
      {inviteSuccess && (
        <p className="mt-2 text-sm text-emerald-600 font-medium">
          Invite sent — they'll receive login instructions by email.
        </p>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
function PartnerDashboardPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<PartnerDashboardData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate({ to: "/build" }); return; }
    supabase.rpc("get_partner_dashboard_data").then(({ data: raw, error }) => {
      if (error) { setLoadError(error.message); return; }
      if (!raw) { navigate({ to: "/dashboard" }); return; }
      setData(raw as PartnerDashboardData);
    });
  }, [authLoading, user, navigate]);

  if (authLoading || (!data && !loadError)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex flex-1 items-center justify-center px-5">
          <p className="text-sm text-destructive">Failed to load dashboard: {loadError}</p>
        </main>
        <Footer />
      </div>
    );
  }

  const referralUrl = `https://www.cvlingo.com/?ref=${data!.referral_code}`;

  function copyLink() {
    void navigator.clipboard.writeText(referralUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">Partner Dashboard</p>
            <h1 className="mt-1 font-serif text-3xl text-foreground md:text-4xl">{data!.partner_name}</h1>
            <p className="mt-1 text-xs text-muted-foreground capitalize">{data!.member_role}</p>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            Sign out
          </button>
        </div>

        {/* Referral link + QR */}
        <div className="mb-8 rounded-2xl border border-border bg-card px-6 py-6">
          <p className="mb-3 text-sm font-semibold text-foreground">Your referral link</p>
          <div className="flex flex-col gap-4 md:flex-row md:items-start">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted px-4 py-3">
                <span className="flex-1 truncate font-mono text-sm text-foreground">{referralUrl}</span>
                <button
                  type="button"
                  onClick={copyLink}
                  className="shrink-0 rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Share this link with your members — CVs they build will be tracked here.
              </p>
            </div>
            <QRDownloadButton url={referralUrl} partnerName={data!.partner_name} />
          </div>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3">
          <StatCard label="Total CVs built" value={data!.total_cvs} />
          <StatCard label={`CVs in ${currentMonthLabel()}`} value={data!.month_cvs} />
          <StatCard label="Candidates in pool" value={data!.total_candidates} />
        </div>

        {/* Monthly impact summary */}
        <div className="mb-8 rounded-2xl border border-primary/20 bg-primary/5 px-6 py-5">
          <p className="text-sm font-semibold text-primary">Monthly impact</p>
          <p className="mt-1 text-sm text-foreground">{impactSummary(data!)}</p>
        </div>

        {/* Breakdowns */}
        <div className="mb-8 grid gap-4 md:grid-cols-2">
          <BreakdownBar label="Languages" items={data!.lang_breakdown} />
          <BreakdownBar label="Job types" items={data!.job_breakdown} />
        </div>

        {/* Candidates table */}
        {data!.recent_candidates.length > 0 && (
          <div className="mb-8 rounded-2xl border border-border bg-card">
            <div className="border-b border-border px-6 py-4">
              <h2 className="font-semibold text-foreground">Candidates from your link</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Names are partially masked to protect candidate privacy.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Language</th>
                    <th className="px-4 py-2">Job types</th>
                    <th className="px-4 py-2">Date opted in</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.recent_candidates.map((c, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-4 py-2 font-medium">{c.display_name}</td>
                      <td className="px-4 py-2 text-muted-foreground">{c.language}</td>
                      <td className="px-4 py-2 text-muted-foreground">{c.job_types.join(", ")}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{fmtDate(c.opted_in_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {data!.recent_candidates.length === 0 && data!.total_cvs === 0 && (
          <div className="mb-8 rounded-2xl border border-border bg-card px-6 py-10 text-center">
            <p className="font-medium text-foreground">No activity yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Share your referral link to start tracking CVs and candidates.
            </p>
          </div>
        )}

        {/* Owner-only: invite team member */}
        {data!.member_role === "owner" && (
          <InviteTeamMember
            partnerId={data!.partner_id}
            partnerName={data!.partner_name}
            memberCount={data!.member_count}
          />
        )}
      </main>

      <div className="text-center py-4">
        <a
          href="mailto:hello@cvlingo.com?subject=CVLingo%20Support%20Request"
          className="text-sm text-gray-500 hover:text-primary transition-colors"
        >
          Need help? Contact us
        </a>
      </div>
      <Footer />
    </div>
  );
}

export const Route = createFileRoute("/partner/dashboard")({
  codeSplitGroupings: [],
  component: PartnerDashboardPage,
});
