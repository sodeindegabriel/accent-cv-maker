import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { usePartner } from "@/context/PartnerContext";
import type { TeamMember } from "@/components/partner-shared";
import {
  EmptyState,
  ErrorState,
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

  // Redirect mentors to clients screen
  useEffect(() => {
    if (!ctxLoading && roleInfo && !roleInfo.is_manager) {
      void navigate({ to: "/partner/clients", search: { filter: "all", mentor: "", q: "", page: 1, pageSize: 25 }, replace: true });
    }
  }, [ctxLoading, roleInfo, navigate]);

  if (ctxLoading || !roleInfo) return <PageSpinner />;
  if (!roleInfo.is_manager) return null;

  return <TeamScreenInner />;
}

function TeamScreenInner() {
  const { roleInfo } = usePartner();
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

  const activeCount = members.filter((m) => m.status === "active").length;
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
    setMembers(Array.isArray(data) ? (data as TeamMember[]) : []);
  }

  useEffect(() => { void loadMembers(); }, []);

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
      if (err.message.includes("domain")) {
        setInviteError("That email domain is not allowed for this partner.");
      } else {
        setInviteError(err.message);
      }
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
    if (err) { alert("Could not change role. Please try again."); return; }
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
      setRemoveError(err.message.includes("only manager") ? "Cannot remove the only manager." : "Could not remove member. Please try again.");
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
    if (err) { alert("Could not cancel invite. Please try again."); return; }
    void loadMembers();
  }

  const activeMentors = members.filter((m) => m.status === "active" && m.member_user_id && m.member_id !== removeDialog?.member_id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Team</h1>
        <button
          type="button"
          onClick={() => setAddOpen((o) => !o)}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity min-h-[44px]"
        >
          {addOpen ? "Cancel" : "Add people"}
        </button>
      </div>

      {/* Second-manager banner — only after successful load */}
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
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "manager" | "mentor")}
                className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary min-h-[44px]"
              >
                <option value="mentor">Mentor</option>
                <option value="manager">Manager</option>
              </select>
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
      {!loading && !error && members.length === 0 && <EmptyState message="No team members yet" />}

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
      {!loading && !error && members.length > 0 && (
        <div className="space-y-3">
          {members.map((m) => (
            <MemberCard
              key={m.member_id}
              member={m}
              isSelf={m.member_user_id === null /* fallback */ || false}
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

function MemberCard({ member, managerCount, roleChanging, cancellingInvite, onRoleChange, onRemove, onCancelInvite }: {
  member: TeamMember;
  isSelf: boolean;
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

  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-foreground">{member.name || <span className="italic text-muted-foreground">Name pending</span>}</p>
          <p className="text-sm text-muted-foreground">{member.email}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isInvited ? "Invite pending" : `Joined ${fmtDate(member.created_at)}`}
            {" · "}
            {member.assigned_count} assigned · {member.closed_count} closed
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Role badge / selector */}
          {isOwner ? (
            <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">Owner</span>
          ) : isInvited ? (
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
          {isInvited ? (
            <button type="button" onClick={onCancelInvite} disabled={cancellingInvite}
              className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50 min-h-[44px]">
              {cancellingInvite ? "Cancelling…" : "Cancel invite"}
            </button>
          ) : !isOwner ? (
            <button type="button" onClick={onRemove} disabled={isLastManager}
              title={isLastManager ? "Cannot remove the only manager" : undefined}
              className="rounded-xl border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/5 disabled:opacity-40 min-h-[44px]">
              Remove
            </button>
          ) : null}
        </div>
      </div>
      {/* Login message for invited users */}
      {isInvited && (
        <p className="mt-2 text-xs text-muted-foreground">
          They can log in at cvlingo.com using this email to accept the invitation.
        </p>
      )}
    </div>
  );
}
