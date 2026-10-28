import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

const MAX_ROWS = 50;

function ActivityScreenInner({ refreshBadges }: { refreshBadges: () => void }) {
  const [notifications, setNotifications] = useState<PartnerNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    // get_partner_notifications takes NO parameters — DB returns latest 50
    const { data, error: err } = await supabase.rpc("get_partner_notifications");
    setLoading(false);
    if (err) { setError("Could not load activity. Please try again."); return; }
    const d = data as { rows: PartnerNotification[]; unread_count: number };
    setNotifications(d.rows ?? []);
    setUnreadCount(d.unread_count ?? 0);
  }

  useEffect(() => {
    void load();
    void supabase.rpc("mark_partner_notifications_seen").then(() => { refreshBadges(); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <PageSpinner />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">Activity</h1>
        {unreadCount > 0 && (
          <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
            {unreadCount} new
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-6 py-6 text-center">
          <p className="mb-3 text-sm text-destructive">{error}</p>
          <button type="button" onClick={() => void load()}
            className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted min-h-[44px]">
            Retry
          </button>
        </div>
      )}

      {!error && notifications.length === 0 && (
        <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">No activity yet. Events appear here as your candidates use CVLingo.</p>
        </div>
      )}

      {!error && notifications.length > 0 && (
        <div className="space-y-2">
          {notifications.map((n) => (
            <NotificationRow key={n.id} notification={n} />
          ))}
          {notifications.length >= MAX_ROWS && (
            <p className="pt-4 text-center text-xs text-muted-foreground">
              Showing the latest {MAX_ROWS} events
            </p>
          )}
        </div>
      )}
    </div>
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
