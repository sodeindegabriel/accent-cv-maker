import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { usePartner } from "@/context/PartnerContext";
import type { PartnerNotification } from "@/components/partner-shared";
import { ErrorState, PageSpinner, fmtDate } from "@/components/partner-shared";

export const Route = createFileRoute("/partner/activity")({
  codeSplitGroupings: [],
  component: ActivityScreen,
});

const PAGE_SIZE = 20;

function ActivityScreen() {
  const { roleInfo, loading: ctxLoading, refreshBadges } = usePartner();
  const navigate = useNavigate();

  useEffect(() => {
    if (!ctxLoading && roleInfo && !roleInfo.is_manager) {
      void navigate({ to: "/partner/clients", replace: true });
    }
  }, [ctxLoading, roleInfo, navigate]);

  if (ctxLoading || !roleInfo) return <PageSpinner />;
  if (!roleInfo.is_manager) return null;

  return <ActivityScreenInner refreshBadges={refreshBadges} />;
}

function ActivityScreenInner({ refreshBadges }: { refreshBadges: () => void }) {
  const [notifications, setNotifications] = useState<PartnerNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  async function load(o: number, append = false) {
    if (!append) setLoading(true); else setLoadingMore(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("get_partner_notifications", {
      p_limit: PAGE_SIZE,
      p_offset: o,
    } as Record<string, unknown>);
    setLoading(false); setLoadingMore(false);
    if (err) { setError(err.message); return; }
    const d = data as { rows: PartnerNotification[]; unread_count: number };
    const rows = d.rows ?? [];
    if (append) setNotifications((prev) => [...prev, ...rows]);
    else setNotifications(rows);
    setUnreadCount(d.unread_count ?? 0);
    setHasMore(rows.length === PAGE_SIZE);
  }

  useEffect(() => {
    void load(0);
    // Mark seen
    void supabase.rpc("mark_partner_notifications_seen").then(() => { refreshBadges(); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadMore() {
    const next = offset + PAGE_SIZE;
    setOffset(next);
    void load(next, true);
  }

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

      {error && <ErrorState message={error} />}

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
          {hasMore && (
            <div className="pt-4 flex justify-center">
              <button type="button" onClick={loadMore} disabled={loadingMore}
                className="rounded-xl border border-border px-6 py-2.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 min-h-[44px]">
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
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
