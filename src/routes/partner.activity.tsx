import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { usePartner } from "@/context/PartnerContext";
import type { PartnerNotification } from "@/components/partner-shared";
import { PageSpinner, fmtDate } from "@/components/partner-shared";

export const Route = createFileRoute("/partner/activity")({
  codeSplitGroupings: [],
  component: ActivityScreen,
});

function ActivityScreen() {
  const { roleInfo, loading: ctxLoading, refreshBadges } = usePartner();
  const navigate = useNavigate();

  useEffect(() => {
    if (!ctxLoading && roleInfo && !roleInfo.is_manager) {
      void navigate({ to: "/partner/clients", search: { filter: "all", mentor: "", q: "", page: 1, pageSize: 25 }, replace: true });
    }
  }, [ctxLoading, roleInfo, navigate]);

  if (ctxLoading || !roleInfo) return <PageSpinner />;
  if (!roleInfo.is_manager) return null;

  return <ActivityScreenInner refreshBadges={refreshBadges} />;
}

const MAX_NOTIFICATIONS = 50;
const TEAM_PAGE_SIZE = 25;

type ActivityTab = "notifications" | "team";

interface TeamActivityRow {
  id: string;
  action: string;
  created_at: string;
  actor_name: string;
  target_name: string;
  summary: string;
}

function ActivityScreenInner({ refreshBadges }: { refreshBadges: () => void }) {
  const [tab, setTab] = useState<ActivityTab>("notifications");

  // ── Notifications tab ────────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState<PartnerNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nLoading, setNLoading] = useState(true);
  const [nError, setNError] = useState<string | null>(null);

  async function loadNotifications() {
    setNLoading(true); setNError(null);
    const { data, error: err } = await supabase.rpc("get_partner_notifications");
    setNLoading(false);
    if (err) { setNError("Could not load notifications. Please try again."); return; }
    const d = data as { rows: PartnerNotification[]; unread_count: number };
    setNotifications(d.rows ?? []);
    setUnreadCount(d.unread_count ?? 0);
  }

  useEffect(() => {
    void loadNotifications();
    void supabase.rpc("mark_partner_notifications_seen").then(() => { refreshBadges(); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Team activity tab ────────────────────────────────────────────────────────
  const [teamRows, setTeamRows] = useState<TeamActivityRow[]>([]);
  const [teamTotal, setTeamTotal] = useState(0);
  const [teamPage, setTeamPage] = useState(0);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);
  const teamLoadedRef = useRef(false);

  async function loadTeamActivity(page: number) {
    setTeamLoading(true); setTeamError(null);
    const offset = page * TEAM_PAGE_SIZE;
    const { data, error: err } = await supabase.rpc("get_partner_activity", {
      p_limit: TEAM_PAGE_SIZE,
      p_offset: offset,
    });
    setTeamLoading(false);
    if (err) { setTeamError("Could not load team activity. Please try again."); return; }
    const d = data as { rows: TeamActivityRow[]; total: number };
    setTeamRows(d.rows ?? []);
    setTeamTotal(d.total ?? 0);
    setTeamPage(page);
  }

  function handleTabChange(next: ActivityTab) {
    setTab(next);
    if (next === "team" && !teamLoadedRef.current) {
      teamLoadedRef.current = true;
      void loadTeamActivity(0);
    }
  }

  const totalTeamPages = Math.max(1, Math.ceil(teamTotal / TEAM_PAGE_SIZE));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-2 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">Activity</h1>
        {unreadCount > 0 && tab === "notifications" && (
          <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
            {unreadCount} new
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-border">
        <TabButton active={tab === "notifications"} onClick={() => handleTabChange("notifications")}>
          Notifications
        </TabButton>
        <TabButton active={tab === "team"} onClick={() => handleTabChange("team")}>
          Team activity
        </TabButton>
      </div>

      {/* Notifications tab */}
      {tab === "notifications" && (
        <>
          <p className="mb-6 text-sm text-muted-foreground">
            You will see a message here when someone closes or reopens a case.
          </p>

          {nLoading && <PageSpinner />}

          {!nLoading && nError && (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-6 py-6 text-center">
              <p className="mb-3 text-sm text-destructive">{nError}</p>
              <button type="button" onClick={() => void loadNotifications()}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted min-h-[44px]">
                Retry
              </button>
            </div>
          )}

          {!nLoading && !nError && notifications.length === 0 && (
            <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center">
              <p className="text-sm font-medium text-foreground mb-1">Nothing here yet</p>
              <p className="text-sm text-muted-foreground">Events will appear here when cases are closed or reopened.</p>
            </div>
          )}

          {!nLoading && !nError && notifications.length > 0 && (
            <div className="space-y-2">
              {notifications.map((n) => (
                <NotificationRow key={n.id} notification={n} />
              ))}
              {notifications.length >= MAX_NOTIFICATIONS && (
                <p className="pt-4 text-center text-xs text-muted-foreground">
                  Showing the latest {MAX_NOTIFICATIONS} events
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* Team activity tab */}
      {tab === "team" && (
        <>
          <p className="mb-6 text-sm text-muted-foreground">
            Team membership changes, role updates, ownership transfers, and invite emails.
          </p>

          {teamLoading && <PageSpinner />}

          {!teamLoading && teamError && (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-6 py-6 text-center">
              <p className="mb-3 text-sm text-destructive">{teamError}</p>
              <button type="button" onClick={() => void loadTeamActivity(teamPage)}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted min-h-[44px]">
                Retry
              </button>
            </div>
          )}

          {!teamLoading && !teamError && teamRows.length === 0 && (
            <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center">
              <p className="text-sm font-medium text-foreground mb-1">No team activity yet</p>
              <p className="text-sm text-muted-foreground">Team events will appear here as people are added, removed, or assigned.</p>
            </div>
          )}

          {!teamLoading && !teamError && teamRows.length > 0 && (
            <>
              <div className="space-y-2">
                {teamRows.map((row) => (
                  <TeamActivityRow key={row.id} row={row} />
                ))}
              </div>

              {/* Pagination */}
              {totalTeamPages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  <button
                    type="button"
                    disabled={teamPage === 0 || teamLoading}
                    onClick={() => void loadTeamActivity(teamPage - 1)}
                    className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40 min-h-[44px]"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-muted-foreground">
                    Page {teamPage + 1} of {totalTeamPages}
                    {teamTotal > 0 && <> &middot; {teamTotal} total</>}
                  </span>
                  <button
                    type="button"
                    disabled={teamPage >= totalTeamPages - 1 || teamLoading}
                    onClick={() => void loadTeamActivity(teamPage + 1)}
                    className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40 min-h-[44px]"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function NotificationRow({ notification }: { notification: PartnerNotification }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-sm text-foreground">{notification.message}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{fmtDate(notification.created_at)}</p>
    </div>
  );
}

function TeamActivityRow({ row }: { row: TeamActivityRow }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-sm text-foreground">{row.summary}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{fmtDate(row.created_at)}</p>
    </div>
  );
}
