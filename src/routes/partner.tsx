import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { PartnerProvider, usePartner } from "@/context/PartnerContext";

export const Route = createFileRoute("/partner")({
  codeSplitGroupings: [],
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login" });
  },
  component: PartnerLayout,
});

interface NavItem {
  label: string;
  to: "/partner/dashboard" | "/partner/clients" | "/partner/team" | "/partner/activity";
  badge?: number;
}

function PartnerLayout() {
  return (
    <PartnerProvider>
      <PartnerLayoutInner />
    </PartnerProvider>
  );
}

function PartnerLayoutInner() {
  const { roleInfo, dashData, loading, error, unassignedCount, unreadCount } = usePartner();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false); }, [currentPath]);

  // Close sidebar on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setSidebarOpen(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !roleInfo || !dashData) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <p className="mb-2 font-semibold text-foreground">Partner access required</p>
          <p className="text-sm text-muted-foreground">{error ?? "You are not a member of any partner organisation."}</p>
        </div>
      </div>
    );
  }

  const isManager = roleInfo.is_manager;
  const partnerName = dashData.partner_name;
  const logoUrl = "partner_logo_url" in dashData ? (dashData.partner_logo_url ?? null) : null;

  const navItems: NavItem[] = isManager
    ? [
        { label: "Overview", to: "/partner/dashboard" },
        { label: "Clients", to: "/partner/clients", badge: unassignedCount > 0 ? unassignedCount : undefined },
        { label: "Team", to: "/partner/team" },
        { label: "Activity", to: "/partner/activity", badge: unreadCount > 0 ? unreadCount : undefined },
      ]
    : [
        { label: "My clients", to: "/partner/clients" },
        { label: "Overview", to: "/partner/dashboard" },
      ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-card transition-transform duration-200",
          "lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
        aria-label="Partner navigation"
      >
        {/* Partner logo + name */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-5">
          {logoUrl ? (
            <img src={logoUrl} alt={partnerName} className="h-9 w-9 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              {partnerName.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="truncate text-sm font-semibold text-foreground">{partnerName}</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul role="list" className="space-y-0.5">
            {navItems.map((item) => {
              const active = currentPath === item.to || currentPath.startsWith(item.to + "/");
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "flex min-h-[44px] items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                      active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted",
                    ].join(" ")}
                  >
                    <span>{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Account menu footer */}
        <div className="border-t border-border px-3 py-3">
          <AccountMenu
            roleInfo={roleInfo}
            partnerName={isManager ? partnerName : undefined}
            referralCode={isManager ? dashData.referral_code : undefined}
            onNavigateAway={() => void navigate({ to: "/" })}
          />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation menu"
            className="rounded-lg p-2 text-foreground hover:bg-muted transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="truncate text-sm font-semibold text-foreground">{partnerName}</span>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// ── AccountMenu ────────────────────────────────────────────────────────────────
interface AccountMenuProps {
  roleInfo: { role: string; is_manager: boolean };
  partnerName?: string;
  referralCode?: string;
  onNavigateAway: () => void;
}

function AccountMenu({ roleInfo, partnerName, referralCode, onNavigateAway }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmSignOutAll, setConfirmSignOutAll] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "");
      const meta = data.user?.user_metadata as Record<string, string> | undefined;
      setDisplayName(meta?.full_name ?? "");
    });
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function saveName() {
    const trimmed = nameValue.trim();
    if (!trimmed) { setNameError("Name cannot be empty."); return; }
    setSavingName(true); setNameError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase.from("profiles").update({ full_name: trimmed }).eq("id", user.id);
      if (error) { setNameError(error.message); setSavingName(false); return; }
    }
    setDisplayName(trimmed);
    setEditingName(false); setSavingName(false);
  }

  async function savePassword() {
    if (password.length < 6) { setPasswordError("Password must be at least 6 characters."); return; }
    if (password !== passwordConfirm) { setPasswordError("Passwords do not match."); return; }
    setSavingPassword(true); setPasswordError(null); setPasswordMsg(null);
    const { error } = await supabase.auth.updateUser({ password });
    setSavingPassword(false);
    if (error) { setPasswordError(error.message); return; }
    setPasswordMsg("Password updated. You can now use it to sign in.");
    setPassword(""); setPasswordConfirm(""); setShowPassword(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    onNavigateAway();
  }

  async function handleSignOutAll() {
    await supabase.auth.signOut({ scope: "global" });
    onNavigateAway();
  }

  const roleDisplay = roleInfo.role === "owner" ? "Manager" : roleInfo.is_manager ? "Manager" : "Mentor";

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full min-h-[44px] items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
          {(displayName || email).charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          {displayName && <p className="truncate text-xs font-medium text-foreground">{displayName}</p>}
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}><polyline points="6 9 12 15 18 9"/></svg>
      </button>

      {/* Dropdown panel — renders above the button */}
      {open && (
        <div
          role="dialog"
          aria-label="Account menu"
          className="absolute bottom-full left-0 right-0 z-50 mb-1 rounded-2xl border border-border bg-card shadow-xl"
        >
          <div className="p-4 space-y-4">
            {/* Name */}
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Your name</p>
              {editingName ? (
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    autoFocus
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                    placeholder="Your name"
                  />
                  {nameError && <p className="text-xs text-destructive">{nameError}</p>}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => void saveName()} disabled={savingName}
                      className="flex-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 min-h-[44px]">
                      {savingName ? "Saving…" : "Save"}
                    </button>
                    <button type="button" onClick={() => { setEditingName(false); setNameError(null); }}
                      className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted min-h-[44px]">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-sm text-foreground">{displayName || <span className="italic text-muted-foreground">Not set</span>}</span>
                  <button type="button" onClick={() => { setNameValue(displayName); setEditingName(true); setNameError(null); }}
                    className="text-xs text-primary hover:underline min-h-[44px]">Edit</button>
                </div>
              )}
            </div>

            {/* Email (read-only) */}
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Email</p>
              <p className="text-sm text-foreground break-all">{email}</p>
            </div>

            {/* Role */}
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Role</p>
              <p className="text-sm text-foreground">{roleDisplay}</p>
            </div>

            {/* Manager-only: partner name + referral code */}
            {partnerName && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Organisation</p>
                <p className="text-sm text-foreground">{partnerName}</p>
                {referralCode && (
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">Referral code: {referralCode}</p>
                )}
              </div>
            )}

            {/* Password */}
            <div>
              <button type="button" onClick={() => { setShowPassword((s) => !s); setPasswordMsg(null); setPasswordError(null); }}
                className="text-xs font-medium text-primary hover:underline min-h-[44px]">
                {showPassword ? "Hide password options" : "Set or change password"}
              </button>
              {showPassword && (
                <div className="mt-2 flex flex-col gap-2">
                  <p className="text-xs text-muted-foreground">A password is optional — you can always sign in with an emailed one-time code instead.</p>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password (min 6 chars)"
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
                  <input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} placeholder="Confirm password"
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
                  {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
                  {passwordMsg && <p className="text-xs text-emerald-600">{passwordMsg}</p>}
                  <button type="button" onClick={() => void savePassword()} disabled={savingPassword || !password}
                    className="rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 min-h-[44px]">
                    {savingPassword ? "Saving…" : "Save password"}
                  </button>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-border" />

            {/* Sign out */}
            <div className="flex flex-col gap-1">
              <button type="button" onClick={() => void handleSignOut()}
                className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-muted transition-colors min-h-[44px]">
                Sign out
              </button>
              {confirmSignOutAll ? (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3">
                  <p className="mb-2 text-xs text-foreground">Sign out of all devices? You will need to log in again everywhere.</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => void handleSignOutAll()}
                      className="flex-1 rounded-xl bg-destructive px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 min-h-[44px]">Confirm</button>
                    <button type="button" onClick={() => setConfirmSignOutAll(false)}
                      className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted min-h-[44px]">Cancel</button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmSignOutAll(true)}
                  className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-muted transition-colors min-h-[44px]">
                  Sign out of all devices
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
