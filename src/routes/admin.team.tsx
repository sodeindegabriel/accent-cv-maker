import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import emailjs from "@emailjs/browser";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined;
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY  as string | undefined;

interface AdminUser {
  id: string;
  email: string;
  role: "admin" | "super_admin";
}

interface PendingInvite {
  id: string;
  email: string;
  role: "admin" | "super_admin";
  created_at: string;
}

async function sendAdminInviteEmail(email: string, role: string) {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) return;
  const subject = role === "super_admin"
    ? "You've been added as a Super Admin on CVLingo"
    : "You've been added as an Admin on CVLingo";
  const message = [
    `Hi,`,
    "",
    `You've been invited to join CVLingo as ${role === "super_admin" ? "a super admin" : "an admin"}.`,
    "",
    "To access the admin panel:",
    "Go to cvlingo.com/admin and enter this email address to receive a one-time login code.",
    "",
    "The CVLingo team",
  ].join("\n");
  await emailjs.send(
    SERVICE_ID,
    TEMPLATE_ID,
    { to_email: email, subject, message, name: "Admin" },
    { publicKey: PUBLIC_KEY },
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function AdminTeamPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin]           = useState<boolean | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [admins, setAdmins]     = useState<AdminUser[]>([]);
  const [invites, setInvites]   = useState<PendingInvite[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole]   = useState<"admin" | "super_admin">("admin");
  const [inviting, setInviting]       = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // Per-row busy
  const [demoting, setDemoting]     = useState<Record<string, boolean>>({});
  const [cancelling, setCancelling] = useState<Record<string, boolean>>({});

  // Direct role setter
  type FoundUser = { id: string; current_role: string };
  const [setRoleEmail, setSetRoleEmail]     = useState("");
  const [lookingUp, setLookingUp]           = useState(false);
  // undefined = not yet searched, null = not found, object = found
  const [foundUser, setFoundUser]           = useState<FoundUser | null | undefined>(undefined);
  const [newRole, setNewRole]               = useState<"user" | "admin" | "super_admin">("admin");
  const [settingRole, setSettingRole]       = useState(false);
  const [setRoleError, setSetRoleError]     = useState<string | null>(null);
  const [setRoleSuccess, setSetRoleSuccess] = useState(false);

  // ── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate({ to: "/build" }); return; }
    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data: p }) => {
        const r = p?.role;
        if (r === "admin" || r === "super_admin") {
          setIsAdmin(true);
          setIsSuperAdmin(r === "super_admin");
        } else {
          setIsAdmin(false);
          navigate({ to: "/dashboard" });
        }
      });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    void loadData();
  }, [isAdmin]);

  async function loadData() {
    setLoadError(null);
    const [adminsRes, invitesRes] = await Promise.all([
      supabase.rpc("list_admins"),
      supabase.from("pending_admin_invites").select("*").order("created_at", { ascending: false }),
    ]);
    if (adminsRes.error) { setLoadError(adminsRes.error.message); return; }
    if (invitesRes.error) { setLoadError(invitesRes.error.message); return; }
    setAdmins((adminsRes.data ?? []) as AdminUser[]);
    setInvites((invitesRes.data ?? []) as PendingInvite[]);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(null);
    setInviteSuccess(false);
    const email = inviteEmail.trim().toLowerCase();
    if (!email) { setInviteError("Email is required."); return; }
    setInviting(true);
    const { error } = await supabase.rpc("invite_admin", { p_email: email, p_role: inviteRole });
    if (error) {
      setInviting(false);
      setInviteError(error.message);
      return;
    }
    void sendAdminInviteEmail(email, inviteRole).catch(
      (err: unknown) => console.error("[admin invite] email failed", err),
    );
    setInviteEmail("");
    setInviteRole("admin");
    setInviting(false);
    setInviteSuccess(true);
    setTimeout(() => setInviteSuccess(false), 4000);
    void loadData();
  }

  async function handleCancelInvite(inv: PendingInvite) {
    setCancelling((c) => ({ ...c, [inv.id]: true }));
    await supabase.from("pending_admin_invites").delete().eq("id", inv.id);
    setCancelling((c) => { const n = { ...c }; delete n[inv.id]; return n; });
    void loadData();
  }

  async function handleDemote(admin: AdminUser) {
    if (!confirm(`Remove admin access for ${admin.email}?`)) return;
    setDemoting((d) => ({ ...d, [admin.id]: true }));
    const { error } = await supabase.rpc("demote_admin", { p_target_id: admin.id });
    setDemoting((d) => { const n = { ...d }; delete n[admin.id]; return n; });
    if (error) { alert(error.message); return; }
    void loadData();
  }

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setLookingUp(true);
    setFoundUser(undefined);
    setSetRoleError(null);
    setSetRoleSuccess(false);
    const email = setRoleEmail.trim().toLowerCase();
    const { data, error } = await supabase.rpc("find_user_by_email", { p_email: email });
    setLookingUp(false);
    if (error) { setSetRoleError(error.message); return; }
    const rows = (data ?? []) as FoundUser[];
    if (rows.length === 0) {
      setFoundUser(null);
    } else {
      setFoundUser(rows[0]);
      setNewRole(rows[0].current_role as "user" | "admin" | "super_admin");
    }
  }

  async function handleSetRole() {
    if (!foundUser) return;
    setSettingRole(true);
    setSetRoleError(null);
    const { error } = await supabase.rpc("set_user_role", {
      p_target_email: setRoleEmail.trim().toLowerCase(),
      p_new_role: newRole,
    });
    setSettingRole(false);
    if (error) { setSetRoleError(error.message); return; }
    setSetRoleSuccess(true);
    setFoundUser(undefined);
    setSetRoleEmail("");
    setTimeout(() => setSetRoleSuccess(false), 4000);
    void loadData();
  }

  // ── Loading / auth states ─────────────────────────────────────────────────
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
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-lg font-bold text-gray-900">Team</h1>
        <p className="text-xs text-gray-500 mt-0.5">Manage admin access to CVLingo.</p>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-8">
        {loadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            Failed to load: {loadError}
          </div>
        )}

        {/* Current admins */}
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Current admins</h2>
          </div>
          {admins.length === 0 ? (
            <p className="px-6 py-8 text-sm text-center text-gray-400">No admins found.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  {isSuperAdmin && <th className="px-4 py-3">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => (
                  <tr key={a.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 text-gray-900">{a.email}</td>
                    <td className="px-4 py-3">
                      {a.role === "super_admin" ? (
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                          Super Admin
                        </span>
                      ) : (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                          Admin
                        </span>
                      )}
                    </td>
                    {isSuperAdmin && (
                      <td className="px-4 py-3">
                        {a.id !== user?.id && (
                          <button
                            type="button"
                            disabled={!!demoting[a.id]}
                            onClick={() => void handleDemote(a)}
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
                          >
                            {demoting[a.id] ? "…" : "Remove access"}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pending invites */}
        {invites.length > 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Pending invites</h2>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Sent</th>
                  {isSuperAdmin && <th className="px-4 py-3">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => (
                  <tr key={inv.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 text-gray-900">{inv.email}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        inv.role === "super_admin"
                          ? "bg-violet-100 text-violet-700"
                          : "bg-blue-100 text-blue-700"
                      }`}>
                        {inv.role === "super_admin" ? "Super Admin" : "Admin"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                      {fmtDate(inv.created_at)}
                    </td>
                    {isSuperAdmin && (
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={!!cancelling[inv.id]}
                          onClick={() => void handleCancelInvite(inv)}
                          className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                        >
                          {cancelling[inv.id] ? "…" : "Cancel"}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Invite form — super_admin only */}
        {isSuperAdmin && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="mb-1 text-base font-semibold text-gray-900">Invite an admin</h2>
            <p className="mb-4 text-xs text-gray-500">
              They&apos;ll receive a login code via email. If they don&apos;t have a CVLingo account yet,
              one will be created on first login.
            </p>
            <form onSubmit={(e) => void handleInvite(e)} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Email</label>
                  <input
                    type="email"
                    required
                    className={inputCls}
                    placeholder="colleague@cvlingo.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Role</label>
                  <select
                    className={inputCls}
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as "admin" | "super_admin")}
                  >
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
              </div>
              {inviteError && <p className="text-sm text-red-600">{inviteError}</p>}
              {inviteSuccess && (
                <p className="text-sm text-emerald-600">Invite sent successfully.</p>
              )}
              <button
                type="submit"
                disabled={inviting}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {inviting ? "Sending…" : "Send invite"}
              </button>
            </form>
          </div>
        )}

        {/* Set role directly — super_admin only */}
        {isSuperAdmin && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="mb-1 text-base font-semibold text-gray-900">Set role directly</h2>
            <p className="mb-4 text-xs text-gray-500">
              For accounts that already exist. Look up an email, then assign any role immediately —
              no invite or OTP flow needed.
            </p>

            <form onSubmit={(e) => void handleLookup(e)} className="flex gap-2">
              <input
                type="email"
                required
                className={`${inputCls} flex-1`}
                placeholder="user@example.com"
                value={setRoleEmail}
                onChange={(e) => {
                  setSetRoleEmail(e.target.value);
                  setFoundUser(undefined);
                  setSetRoleError(null);
                }}
              />
              <button
                type="submit"
                disabled={lookingUp}
                className="shrink-0 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {lookingUp ? "Looking up…" : "Look up"}
              </button>
            </form>

            {/* Not found */}
            {foundUser === null && (
              <p className="mt-3 text-sm text-amber-700 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5">
                No account found for this email yet — ask them to sign up first, then you can set
                their role here.
              </p>
            )}

            {/* Found — show current role + picker */}
            {foundUser !== null && foundUser !== undefined && (
              <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 space-y-3">
                <p className="text-sm text-gray-700">
                  Current role:{" "}
                  <span className="font-semibold">
                    {foundUser.current_role === "super_admin"
                      ? "Super Admin"
                      : foundUser.current_role === "admin"
                      ? "Admin"
                      : "User"}
                  </span>
                </p>
                <div className="flex items-center gap-3">
                  <select
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as "user" | "admin" | "super_admin")}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                  <button
                    type="button"
                    disabled={settingRole || newRole === foundUser.current_role}
                    onClick={() => void handleSetRole()}
                    className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {settingRole ? "Applying…" : "Apply"}
                  </button>
                </div>
              </div>
            )}

            {setRoleError && (
              <p className="mt-2 text-sm text-red-600">{setRoleError}</p>
            )}
            {setRoleSuccess && (
              <p className="mt-2 text-sm text-emerald-600">Role updated successfully.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export const Route = createFileRoute("/admin/team")({
  codeSplitGroupings: [],
  component: AdminTeamPage,
});
