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

// ── Nav items ──────────────────────────────────────────────────────────────────
interface NavItem {
  label: string;
  to: "/partner/dashboard" | "/partner/clients" | "/partner/team" | "/partner/activity";
  badge?: number;
  managerOnly?: boolean;
  mentorFirst?: boolean;
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
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false); }, [currentPath]);

  // Close sidebar on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setSidebarOpen(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    void navigate({ to: "/" });
  }

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
  const userEmail = roleInfo ? undefined : undefined;

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
          ref={overlayRef}
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
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-muted",
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

        {/* Bottom: email + sign out */}
        <div className="border-t border-border px-4 py-4">
          <UserEmailRow onSignOut={() => void handleSignOut()} />
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

function UserEmailRow({ onSignOut }: { onSignOut: () => void }) {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => { setEmail(data.user?.email ?? null); });
  }, []);
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        {email && <p className="truncate text-xs text-muted-foreground">{email}</p>}
      </div>
      <button
        type="button"
        onClick={onSignOut}
        className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors min-h-[44px]"
      >
        Sign out
      </button>
    </div>
  );
}
