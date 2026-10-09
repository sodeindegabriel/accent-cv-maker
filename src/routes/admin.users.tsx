import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

// ── Types ──────────────────────────────────────────────────────────────────────
interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  preferred_ui_language: string | null;
  role: string;
  referral_code: string | null;
  cv_count: number;
  cover_letter_count: number;
}

interface UsersData {
  rows: UserRow[];
  total: number;
}

interface SignupStats {
  today: number;
  last_7_days: number;
  last_30_days: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isNewUser(created_at: string) {
  return Date.now() - new Date(created_at).getTime() < 24 * 60 * 60 * 1000;
}

const PAGE_SIZE = 25;

// ── Main component ─────────────────────────────────────────────────────────────
function AdminUsersPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const [stats, setStats] = useState<SignupStats | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<UsersData | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Auth guard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate({ to: "/build" }); return; }
    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data: p }) => {
        if (p?.role === "admin" || p?.role === "super_admin") {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
          navigate({ to: "/dashboard" });
        }
      });
  }, [authLoading, user, navigate]);

  // ── Load stats once on mount ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin) return;
    supabase.rpc("users_signup_stats").then(({ data: d }) => {
      if (d) setStats(d as SignupStats);
    });
  }, [isAdmin]);

  // ── Load users on debouncedSearch / page change ──────────────────────────────
  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    supabase
      .rpc("list_users", {
        p_search: debouncedSearch,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
      })
      .then(({ data: d }) => {
        setData((d as UsersData | null) ?? null);
        setLoading(false);
      });
  }, [isAdmin, debouncedSearch, page]);

  // ── Debounce search ───────────────────────────────────────────────────────────
  function handleSearchChange(val: string) {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(0);
    }, 300);
  }

  // ── CSV export ────────────────────────────────────────────────────────────────
  async function handleExport() {
    setExporting(true);
    const allRows: UserRow[] = [];
    let offset = 0;
    while (true) {
      const { data: chunk } = await supabase.rpc("list_users", {
        p_search: debouncedSearch,
        p_limit: 100,
        p_offset: offset,
      });
      const parsed = chunk as UsersData | null;
      if (!parsed?.rows?.length) break;
      allRows.push(...parsed.rows);
      if (allRows.length >= parsed.total) break;
      offset += 100;
    }
    const header = ["Name", "Email", "Signed up", "Last seen", "Language", "Referral", "CVs", "Cover letters"];
    const csvRows = allRows.map((r) =>
      [
        r.full_name ?? "",
        r.email,
        r.created_at,
        r.last_sign_in_at ?? "",
        r.preferred_ui_language ?? "",
        r.referral_code ?? "Organic",
        r.cv_count,
        r.cover_letter_count,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [header.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cvlingo-users-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExporting(false);
  }

  // ── Loading / auth states ────────────────────────────────────────────────────
  if (authLoading || isAdmin === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!isAdmin) return null;

  const total = data?.total ?? 0;
  const rows = data?.rows ?? [];
  const showFrom = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const showTo = Math.min((page + 1) * PAGE_SIZE, total);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4 flex items-center gap-3">
        <a href="/admin" className="text-sm text-gray-500 hover:underline">← Admin</a>
        <span className="text-gray-300">/</span>
        <h1 className="text-lg font-bold text-gray-900">Users</h1>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">

        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Today", value: stats?.today ?? "—" },
            { label: "Last 7 days", value: stats?.last_7_days ?? "—" },
            { label: "Last 30 days", value: stats?.last_30_days ?? "—" },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-sm text-gray-500">{card.label}</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">{card.value}</p>
            </div>
          ))}
        </div>

        {/* Search + Export */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary"
          />
          <button
            type="button"
            disabled={exporting}
            onClick={() => void handleExport()}
            className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-16 text-center text-sm text-gray-400">No users found.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Signed up</th>
                  <th className="px-4 py-3">Last seen</th>
                  <th className="px-4 py-3">Language</th>
                  <th className="px-4 py-3">Referral</th>
                  <th className="px-4 py-3 text-right">CVs</th>
                  <th className="px-4 py-3 text-right">Cover letters</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className={`border-t border-gray-100 ${isNewUser(r.created_at) ? "bg-amber-50" : ""}`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {r.full_name ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.email}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500">{fmtDate(r.created_at)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500">{fmtDate(r.last_sign_in_at)}</td>
                    <td className="px-4 py-3 text-gray-600">{r.preferred_ui_language ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{r.referral_code ?? "Organic"}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{r.cv_count}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{r.cover_letter_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            {total === 0
              ? "No results"
              : `Showing ${showFrom}–${showTo} of ${total}`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={(page + 1) * PAGE_SIZE >= total}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        </div>

      </main>
    </div>
  );
}

export const Route = createFileRoute("/admin/users")({
  codeSplitGroupings: [],
  component: AdminUsersPage,
});
