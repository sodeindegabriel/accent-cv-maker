import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

type AdminRole = "admin" | "super_admin";
type UserRole = AdminRole | "other" | null;

const NAV = [
  { label: "Overview",     to: "/admin",             superAdminOnly: false },
  { label: "Candidates",   to: "/admin/candidates",  superAdminOnly: false },
  { label: "Job Requests", to: "/admin/job-requests", superAdminOnly: false },
  { label: "Partners",     to: "/admin/partners",    superAdminOnly: false },
  { label: "Team",         to: "/admin/team",        superAdminOnly: true },
  { label: "Billing",      to: "/admin/billing",     superAdminOnly: true },
];

function AdminLayout() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [userRole, setUserRole]       = useState<UserRole>(null);
  const [loginEmail, setLoginEmail]   = useState("");
  const [loginStep, setLoginStep]     = useState<"email" | "code">("email");
  const [loginCode, setLoginCode]     = useState("");
  const [sending, setSending]         = useState(false);
  const [verifying, setVerifying]     = useState(false);
  const [loginError, setLoginError]   = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setUserRole(null); return; }
    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data: p }) => {
        const r = p?.role;
        if (r === "admin" || r === "super_admin") setUserRole(r as AdminRole);
        else setUserRole("other");
      });
  }, [authLoading, user]);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setLoginError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: loginEmail.trim().toLowerCase(),
      options: { shouldCreateUser: false },
    });
    setSending(false);
    if (error) { setLoginError(error.message); return; }
    setLoginStep("code");
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setVerifying(true);
    setLoginError(null);
    const { error } = await supabase.auth.verifyOtp({
      email: loginEmail.trim().toLowerCase(),
      token: loginCode.trim(),
      type: "email",
    });
    if (error) { setVerifying(false); setLoginError(error.message); return; }
    // Claim a pending admin invite if one exists (no-op for existing admins)
    await supabase.rpc("claim_admin_account");
    setVerifying(false);
    // AuthContext fires onAuthStateChange → useEffect above updates userRole
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (authLoading || (user && userRole === null)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // ── Not logged in → inline OTP login widget ───────────────────────────────
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="mb-1 text-xl font-bold text-gray-900">Admin login</h1>
          <p className="mb-6 text-sm text-gray-500">
            Enter your admin email to receive a one-time code.
          </p>

          {loginStep === "email" ? (
            <form onSubmit={(e) => void handleSendCode(e)} className="space-y-4">
              <input
                type="email"
                required
                placeholder="admin@cvlingo.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
              />
              {loginError && <p className="text-sm text-red-600">{loginError}</p>}
              <button
                type="submit"
                disabled={sending}
                className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {sending ? "Sending…" : "Send code"}
              </button>
            </form>
          ) : (
            <form onSubmit={(e) => void handleVerify(e)} className="space-y-4">
              <p className="text-sm text-gray-600">
                Code sent to <span className="font-medium">{loginEmail}</span>.{" "}
                <button
                  type="button"
                  onClick={() => { setLoginStep("email"); setLoginError(null); }}
                  className="text-primary underline"
                >
                  Change
                </button>
              </p>
              <input
                type="text"
                inputMode="numeric"
                required
                placeholder="6-digit code"
                value={loginCode}
                onChange={(e) => setLoginCode(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary tracking-widest text-center"
              />
              {loginError && <p className="text-sm text-red-600">{loginError}</p>}
              <button
                type="submit"
                disabled={verifying}
                className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {verifying ? "Verifying…" : "Verify code"}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ── Logged in but not an admin ────────────────────────────────────────────
  if (userRole === "other") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <p className="mb-4 text-lg font-medium text-gray-900">
            You don&apos;t have admin access.
          </p>
          <a href="/" className="text-sm text-primary underline">
            Go home
          </a>
        </div>
      </div>
    );
  }

  // ── Admin shell with persistent left sidebar ──────────────────────────────
  const isSuperAdmin = userRole === "super_admin";
  const visibleNav = NAV.filter((n) => !n.superAdminOnly || isSuperAdmin);

  function isActive(to: string) {
    return to === "/admin"
      ? location.pathname === "/admin" || location.pathname === "/admin/"
      : location.pathname.startsWith(to);
  }

  const sidebarContent = (
    <nav className="flex flex-col gap-1 p-3">
      <div className="mb-3 px-3 py-2">
        <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
          CVLingo Admin
        </span>
        {isSuperAdmin && (
          <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
            Super
          </span>
        )}
      </div>
      {visibleNav.map((n) => (
        <button
          key={n.to}
          type="button"
          onClick={() => {
            setSidebarOpen(false);
            void navigate({ to: n.to as never });
          }}
          className={`w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
            isActive(n.to)
              ? "bg-primary text-primary-foreground"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          {n.label}
        </button>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-56 md:shrink-0 flex-col border-r border-gray-200 bg-white">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-56 border-r border-gray-200 bg-white transition-transform duration-200 md:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <span className="text-sm font-semibold text-gray-900">Menu</span>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {sidebarContent}
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="text-gray-600 hover:text-gray-900"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-gray-900">CVLingo Admin</span>
        </div>

        <div className="flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/admin")({
  codeSplitGroupings: [],
  component: AdminLayout,
});
