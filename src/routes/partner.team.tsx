import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { usePartner } from "@/context/PartnerContext";
import type { TeamMember } from "@/components/partner-shared";
import {
  EmptyState,
  PageSpinner,
  fmtDate,
  roleLabel,
  sendTeamInviteEmail,
} from "@/components/partner-shared";

export const Route = createFileRoute("/partner/team")({
  codeSplitGroupings: [],
  component: TeamScreen,
});

function TeamScreen() {
  const { roleInfo, loading: ctxLoading } = usePartner();
  const navigate = useNavigate();

  useEffect(() => {
    if (!ctxLoading && roleInfo && !roleInfo.is_manager) {
      void navigate({ to: "/partner/clients", search: { filter: "all", mentor: "", q: "", page: 1, pageSize: 25 }, replace: true });
    }
  }, [ctxLoading, roleInfo, navigate]);

  if (ctxLoading || !roleInfo) return <PageSpinner />;
  if (!roleInfo.is_manager) return null;

  return <TeamScreenInner />;
}

function NamePromptDialog({ onSave }: { onSave: (name: string) => void }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const { error: err } = await supabase.from("profiles").update({ full_name: trimmed }).eq("id", user.id);
    if (err) { setError("Could not save name. Please try again."); setSaving(false); return; }
    onSave(trimmed);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="font-semibold text-foreground mb-1">What is your name?</h2>
        <p className="text-sm text-muted-foreground mb-4">Your colleagues will see it when assigning clients.</p>
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            required
            autoFocus
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 min-h-[44px]"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      </div>
    </div>
  );
}

function friendlyError(msg: string): string {
  if (msg.includes("owner_only")) return "Only the owner can do this.";
  if (msg.includes("last_manager")) return "There must always be at least one manager.";
  if (msg.includes("cannot remove the owner")) return "The owner cannot be removed. Transfer ownership first.";
  if (msg.includes("domain")) return "That email domain is not allowed for this partner.";
  return "Something went wrong. Please try again.";
}

function TeamScreenInner() {
  const { roleInfo, refreshRole } = usePartner();
  const isOwner = roleInfo?.role === "owner";
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"manager" | "mentor">("mentor");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [removeDialog, setRemoveDialog] = useState<TeamMember | null>(null);
  const [reassignTo, setReassignTo] = useState("");
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [roleChanging, setRoleChanging] = useState<string | null>(null);
  const [cancellingInvite, setCancellingInvite] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const managerCount = members.filter((m) => m.status === "active" && (m.role === "owner" || m.role === "manager")).length;

  async function loadMembers() {
    setError(null);
    const { data, error: err } = await supabase.rpc("list_partner_team", {
      p_limit: 200,
      p_offset: 0,
      p_search: null,
    });
    setLoading(false);
    if (err) { setError("Could not load team. Please try again."); return; }
    const d = data as { rows: TeamMember[]; total: number } | null;
    setMembers(d?.rows ?? []);
  }

  useEffect(() => {
    void loadMembers();
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      if (!profile?.full_name) setShowNamePrompt(true);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredMembers = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter((m) =>
      (m.name ?? "").toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  }, [members, search]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    setInviting(true); setInviteError(null);
    const { error: err } = await supabase.rpc("invite_partner_members", {
      p_emails: [email],
      p_role: inviteRole,
    });
    if (err) {
      setInviteError(friendlyError(err.message));
      setInviting(false); return;
    }
    try {
      if (roleInfo) await sendTeamInviteEmail(roleInfo.partner_name, email);
    } catch { /* non-fatal */ }
    setInviteEmail(""); setAddOpen(false);
    setInviting(false);
    void loadMembers();
  }

  async function handleRoleChange(member: TeamMember, newRole: "manager" | "mentor") {
    setRoleChanging(member.member_id);
    const { error: err } = await supabase.rpc("set_partner_member_role", {
      p_member_user_id: member.member_user_id,
      p_role: newRole,
    });
    setRoleChanging(null);
    if (err) { setError(friendlyError(err.message)); return; }
    void loadMembers();
  }

  async function handleRemove(reassignUserId?: string) {
    if (!removeDialog) return;
    setRemoving(true); setRemoveError(null);
    const { error: err } = await supabase.rpc("remove_partner_member", {
      p_member_user_id: removeDialog.member_user_id,
      p_reassign_to: reassignUserId ?? null,
    });
    if (err) {
      setRemoveError(friendlyError(err.message));
      setRemoving(false); return;
    }
    setRemoving(false); setRemoveDialog(null); setReassignTo("");
    void loadMembers();
  }

  async function handleCancelInvite(member: TeamMember) {
    setCancellingInvite(member.member_id);
    const { error: err } = await supabase.rpc("cancel_partner_invite", {
      p_member_id: member.member_id,
    });
    setCancellingInvite(null);
    if (err) { setError(friendlyError(err.message)); return; }
    void loadMembers();
  }

  const activeMentors = members.filter((m) => m.status === "active" && m.member_user_id && m.member_id !== removeDialog?.member_id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {showNamePrompt && (
        <NamePromptDialog onSave={() => setShowNamePrompt(false)} />
      )}

      {transferOpen && (
        <TransferOwnershipDialog
          members={members}
          onClose={() => setTransferOpen(false)}
          onSuccess={async () => {
            setTransferOpen(false);
            await refreshRole();
            void loadMembers();
          }}
        />
      )}

      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Team</h1>
        <div className="flex items-center gap-2">
          {isOwner && (
            <button
              type="button"
              onClick={() => setTransferOpen(true)}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors min-h-[44px]"
            >
              Transfer ownership
            </button>
          )}
          <button
            type="button"
            onClick={() => setAddOpen((o) => !o)}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity min-h-[44px]"
          >
            {addOpen ? "Cancel" : "Add people"}
          </button>
        </div>
      </div>

      {/* Role explanation */}
      <p className="mb-4 text-sm text-muted-foreground">
        Managers can add and remove mentors and assign clients. Only the owner can add, remove or change managers and transfer ownership.
      </p>

      {/* Second-manager banner */}
      {!loading && !error && managerCount === 1 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Add at least one other manager so the team can continue if you lose access.
        </div>
      )}

      {/* Add people panel */}
      {addOpen && (
        <div className="mb-6 rounded-2xl border border-border bg-card px-6 py-5">
          <h2 className="mb-4 text-base font-semibold text-foreground">Invite a team member</h2>
          <form onSubmit={(e) => void handleInvite(e)} className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Email address</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                required
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Role</label>
              {isOwner ? (
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "manager" | "mentor")}
                  className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary min-h-[44px]"
                >
                  <option value="mentor">Mentor</option>
                  <option value="manager">Manager</option>
                </select>
              ) : (
                <div className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-muted-foreground min-h-[44px] flex items-center">
                  Mentor <span className="ml-2 text-xs text-muted-foreground/70">(only the owner can add managers)</span>
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 min-h-[44px]"
            >
              {inviting ? "Inviting…" : "Send invite"}
            </button>
          </form>
          {inviteError && <p className="mt-2 text-sm text-destructive">{inviteError}</p>}
        </div>
      )}

      {/* Search box */}
      {!loading && !error && members.length > 1 && (
        <div className="mb-4">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary sm:max-w-xs"
          />
        </div>
      )}

      {loading && <PageSpinner />}
      {error && !loading && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-6 py-6 text-center">
          <p className="mb-3 text-sm text-destructive">{error}</p>
          <button type="button" onClick={() => { setLoading(true); void loadMembers(); }}
            className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted min-h-[44px]">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && filteredMembers.length === 0 && members.length === 0 && (
        <EmptyState message={'No team members yet. Use "Add people" to invite someone.'} />
      )}
      {!loading && !error && filteredMembers.length === 0 && members.length > 0 && (
        <p className="text-sm text-muted-foreground">No results for &ldquo;{search}&rdquo;</p>
      )}

      {/* Remove/reassign dialog */}
      {removeDialog && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="font-semibold text-foreground mb-2">Remove {removeDialog.name || removeDialog.email}?</h2>
            {removeDialog.assigned_count > 0 && (
              <p className="text-sm text-muted-foreground mb-4">
                They have {removeDialog.assigned_count} active client{removeDialog.assigned_count !== 1 ? "s" : ""}.
                Optionally reassign before removing.
              </p>
            )}
            {removeDialog.assigned_count > 0 && activeMentors.length > 0 && (
              <div className="mb-4">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Reassign clients to (optional)</label>
                <select value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary">
                  <option value="">Leave unassigned</option>
                  {activeMentors.map((m) => (
                    <option key={m.member_id} value={m.member_user_id!}>{m.name || m.email}</option>
                  ))}
                </select>
              </div>
            )}
            {removeError && <p className="mb-3 text-sm text-destructive">{removeError}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={() => void handleRemove(reassignTo || undefined)} disabled={removing}
                className="flex-1 rounded-xl bg-destructive px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 min-h-[44px]">
                {removing ? "Removing…" : "Remove"}
              </button>
              <button type="button" onClick={() => { setRemoveDialog(null); setReassignTo(""); setRemoveError(null); }} disabled={removing}
                className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted min-h-[44px]">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Members list */}
      {!loading && !error && filteredMembers.length > 0 && (
        <div className="space-y-3">
          {filteredMembers.map((m) => (
            <MemberCard
              key={m.member_id}
              member={m}
              isViewerOwner={isOwner ?? false}
              managerCount={managerCount}
              roleChanging={roleChanging === m.member_id}
              cancellingInvite={cancellingInvite === m.member_id}
              onRoleChange={(role) => void handleRoleChange(m, role)}
              onRemove={() => { setRemoveDialog(m); setRemoveError(null); }}
              onCancelInvite={() => void handleCancelInvite(m)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MemberCard({ member, isViewerOwner, managerCount, roleChanging, cancellingInvite, onRoleChange, onRemove, onCancelInvite }: {
  member: TeamMember;
  isViewerOwner: boolean;
  managerCount: number;
  roleChanging: boolean;
  cancellingInvite: boolean;
  onRoleChange: (role: "manager" | "mentor") => void;
  onRemove: () => void;
  onCancelInvite: () => void;
}) {
  const isInvited = member.status === "invited";
  const isOwner = member.role === "owner";
  const isLastManager = managerCount <= 1 && (member.role === "manager" || member.role === "owner");

  const showRoleSelector = isViewerOwner && !isOwner && !isInvited;
  const showRemove = !isOwner && (isViewerOwner || member.role === "mentor");
  const showCancelInvite = isInvited && (isViewerOwner || member.role === "mentor");

  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-foreground">{member.name || <span className="italic text-muted-foreground">Name pending</span>}</p>
          <p className="text-sm text-muted-foreground">{member.email}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isInvited
              ? <span className="text-amber-600 font-medium">Added: not signed in yet</span>
              : <span className="text-green-700 font-medium">Active</span>}
            {" · "}
            {isInvited ? `Added ${fmtDate(member.created_at)}` : `Joined ${fmtDate(member.created_at)}`}
            {" · "}
            {member.assigned_count} assigned · {member.closed_count} closed
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Role badge / selector */}
          {isOwner ? (
            <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">Owner</span>
          ) : isInvited || !showRoleSelector ? (
            <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">{roleLabel(member.role)}</span>
          ) : (
            <select
              value={member.role}
              disabled={roleChanging || isLastManager}
              onChange={(e) => onRoleChange(e.target.value as "manager" | "mentor")}
              title={isLastManager ? "Cannot change role of the only manager" : undefined}
              className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground outline-none focus:border-primary disabled:opacity-50 min-h-[44px]"
            >
              <option value="manager">Manager</option>
              <option value="mentor">Mentor</option>
            </select>
          )}
          {/* Actions */}
          {showCancelInvite ? (
            <button type="button" onClick={onCancelInvite} disabled={cancellingInvite}
              className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50 min-h-[44px]">
              {cancellingInvite ? "Cancelling…" : "Cancel invite"}
            </button>
          ) : showRemove ? (
            <button type="button" onClick={onRemove} disabled={isLastManager}
              title={isLastManager ? "Cannot remove the only manager" : undefined}
              className="rounded-xl border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/5 disabled:opacity-40 min-h-[44px]">
              Remove
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TransferOwnershipDialog({ members, onClose, onSuccess }: {
  members: TeamMember[];
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const activeManagers = members.filter((m) => m.status === "active" && m.role === "manager" && m.member_user_id);
  const [selectedId, setSelectedId] = useState(activeManagers[0]?.member_user_id ?? "");
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return activeManagers;
    const q = search.toLowerCase();
    return activeManagers.filter((m) =>
      (m.name ?? "").toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, search]);

  async function handleTransfer() {
    if (confirm !== "TRANSFER" || !selectedId) return;
    setTransferring(true); setError(null);
    const { error: err } = await supabase.rpc("transfer_partner_ownership", {
      p_new_owner_user_id: selectedId,
    });
    if (err) {
      setError(friendlyError(err.message));
      setTransferring(false); return;
    }
    await onSuccess();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="font-semibold text-foreground mb-1">Transfer ownership</h2>
        <p className="text-sm text-muted-foreground mb-4">
          The selected manager will become the owner and you will become a manager.
        </p>

        {activeManagers.length === 0 ? (
          <p className="text-sm text-muted-foreground mb-4">There are no active managers to transfer ownership to.</p>
        ) : (
          <>
            {activeManagers.length > 3 && (
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search managers…"
                className="mb-3 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              />
            )}
            <div className="mb-4 max-h-48 overflow-y-auto space-y-2">
              {filtered.map((m) => (
                <label key={m.member_id} className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 cursor-pointer hover:bg-muted">
                  <input
                    type="radio"
                    name="transfer-target"
                    value={m.member_user_id!}
                    checked={selectedId === m.member_user_id}
                    onChange={() => setSelectedId(m.member_user_id!)}
                    className="accent-primary"
                  />
                  <span className="text-sm font-medium text-foreground">{m.name || m.email}</span>
                  {m.name && <span className="text-xs text-muted-foreground">{m.email}</span>}
                </label>
              ))}
              {filtered.length === 0 && <p className="text-sm text-muted-foreground">No results.</p>}
            </div>

            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Type <span className="font-mono font-semibold">TRANSFER</span> to confirm
            </label>
            <input
              type="text"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="TRANSFER"
              className="mb-4 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary"
            />
          </>
        )}

        {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => void handleTransfer()}
            disabled={transferring || confirm !== "TRANSFER" || !selectedId}
            className="flex-1 rounded-xl bg-destructive px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 min-h-[44px]"
          >
            {transferring ? "Transferring…" : "Transfer ownership"}
          </button>
          <button type="button" onClick={onClose} disabled={transferring}
            className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted min-h-[44px]">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
