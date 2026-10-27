import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// ── Types ──────────────────────────────────────────────────────────────────────
export interface MyPartnerRole {
  partner_id: string;
  partner_name: string;
  referral_code: string;
  role: "owner" | "manager" | "mentor";
  is_manager: boolean;
}

export interface ManagerDashData {
  partner_id: string;
  partner_name: string;
  partner_logo_url?: string | null;
  referral_code: string;
  member_role: string;
  member_count: number;
  total_cvs: number;
  month_cvs: number;
  active_this_month: number;
  total_candidates: number;
  lang_breakdown: Record<string, number>;
  job_breakdown: Record<string, number>;
}

export interface MentorDashData {
  partner_id: string;
  partner_name: string;
  partner_logo_url?: string | null;
  referral_code: string;
  member_role: string;
  my_assigned: number;
  my_closed: number;
}

// ── Context ────────────────────────────────────────────────────────────────────
interface PartnerContextValue {
  roleInfo: MyPartnerRole | null;
  dashData: ManagerDashData | MentorDashData | null;
  unassignedCount: number;
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refreshBadges: () => void;
}

const PartnerContext = createContext<PartnerContextValue>({
  roleInfo: null,
  dashData: null,
  unassignedCount: 0,
  unreadCount: 0,
  loading: true,
  error: null,
  refreshBadges: () => {},
});

export function usePartner() {
  return useContext(PartnerContext);
}

const BADGE_THROTTLE_MS = 60_000;

export function PartnerProvider({ children }: { children: React.ReactNode }) {
  const [roleInfo, setRoleInfo] = useState<MyPartnerRole | null>(null);
  const [dashData, setDashData] = useState<ManagerDashData | MentorDashData | null>(null);
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastBadgeFetch = useRef(0);
  const roleRef = useRef<MyPartnerRole | null>(null);

  const fetchBadges = useCallback(async (role?: MyPartnerRole) => {
    const r = role ?? roleRef.current;
    if (!r) return;
    lastBadgeFetch.current = Date.now();
    const { data: cd } = await supabase.rpc("get_partner_clients_page", {
      p_limit: 1, p_offset: 0, p_filter: "unassigned",
      p_mentor_user_id: null, p_search: null,
    });
    if (cd) {
      const d = cd as { rows: unknown[]; total: number; unassigned_count: number | null };
      setUnassignedCount(d.unassigned_count ?? 0);
    }
    if (r.is_manager) {
      const { data: nd } = await supabase.rpc("get_partner_notifications");
      if (nd) {
        const d = nd as { rows: unknown[]; unread_count: number };
        setUnreadCount(d.unread_count ?? 0);
      }
    }
  }, []);

  const refreshBadges = useCallback(() => {
    if (Date.now() - lastBadgeFetch.current < BADGE_THROTTLE_MS) return;
    void fetchBadges();
  }, [fetchBadges]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const [{ data: roleRaw, error: roleErr }, { data: dashRaw, error: dashErr }] = await Promise.all([
        supabase.rpc("get_my_partner_role"),
        supabase.rpc("get_partner_dashboard_data"),
      ]);
      setLoading(false);
      if (roleErr || !roleRaw) { setError(roleErr?.message ?? "Not a partner member"); return; }
      const role = roleRaw as MyPartnerRole;
      setRoleInfo(role);
      roleRef.current = role;
      if (dashErr || !dashRaw) { setError(dashErr?.message ?? "Failed to load dashboard data"); return; }
      setDashData(dashRaw as ManagerDashData | MentorDashData);
      void fetchBadges(role);
    })();
  }, [fetchBadges]);

  // Poll every minute
  useEffect(() => {
    if (!roleInfo) return;
    const t = setInterval(() => void fetchBadges(), BADGE_THROTTLE_MS);
    return () => clearInterval(t);
  }, [roleInfo, fetchBadges]);

  // Refetch on tab focus (if throttle allows)
  useEffect(() => {
    function onFocus() {
      if (Date.now() - lastBadgeFetch.current >= BADGE_THROTTLE_MS) void fetchBadges();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchBadges]);

  return (
    <PartnerContext.Provider value={{ roleInfo, dashData, unassignedCount, unreadCount, loading, error, refreshBadges }}>
      {children}
    </PartnerContext.Provider>
  );
}
