import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { generateJobTranslationsServer } from "@/lib/job-requests.functions";

// ── Types ─────────────────────────────────────────────────────────────────────
interface JobTitleRequest {
  id: string;
  title: string;
  normalized_title: string;
  request_count: number;
  first_requested_at: string;
  last_requested_at: string;
  status: "pending" | "approved" | "rejected";
  translations: Record<string, string> | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ── Main component ────────────────────────────────────────────────────────────
function JobRequestsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<JobTitleRequest[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, "approving" | "rejecting">>({});
  const [actionError, setActionError] = useState<Record<string, string>>({});

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate({ to: "/build" }); return; }
    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data: p }) => {
        if (p?.role === "admin") {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
          navigate({ to: "/dashboard" });
        }
      });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from("job_title_requests")
      .select("*")
      .eq("status", "pending")
      .order("request_count", { ascending: false })
      .then(({ data, error }) => {
        if (error) { setLoadError(error.message); return; }
        setRows((data as JobTitleRequest[]) ?? []);
      });
  }, [isAdmin]);

  async function handleApprove(row: JobTitleRequest) {
    setBusy((b) => ({ ...b, [row.id]: "approving" }));
    setActionError((e) => ({ ...e, [row.id]: "" }));
    try {
      // 1. Generate translations server-side (API key stays server-only)
      const translations = await generateJobTranslationsServer({ data: { title: row.title } });

      // 2. Persist approval + translations to DB
      const { error } = await supabase
        .from("job_title_requests")
        .update({ status: "approved", translations })
        .eq("id", row.id);
      if (error) throw new Error(error.message);

      // 3. Remove from local list
      setRows((r) => r.filter((x) => x.id !== row.id));
    } catch (e) {
      setActionError((err) => ({ ...err, [row.id]: e instanceof Error ? e.message : "Unknown error" }));
    } finally {
      setBusy((b) => { const n = { ...b }; delete n[row.id]; return n; });
    }
  }

  async function handleReject(id: string) {
    setBusy((b) => ({ ...b, [id]: "rejecting" }));
    setActionError((e) => ({ ...e, [id]: "" }));
    try {
      const { error } = await supabase
        .from("job_title_requests")
        .update({ status: "rejected" })
        .eq("id", id);
      if (error) throw new Error(error.message);
      setRows((r) => r.filter((x) => x.id !== id));
    } catch (e) {
      setActionError((err) => ({ ...err, [id]: e instanceof Error ? e.message : "Unknown error" }));
    } finally {
      setBusy((b) => { const n = { ...b }; delete n[id]; return n; });
    }
  }

  // ── Loading / auth states ──────────────────────────────────────────────────
  if (authLoading || isAdmin === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/admin" className="text-sm text-gray-500 hover:underline">← Admin</a>
          <span className="text-gray-300">/</span>
          <h1 className="text-lg font-bold text-gray-900">Job Title Requests</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Intent banner */}
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <p className="font-semibold mb-1">Approving does NOT make a job title live in the app.</p>
          <p>
            The searchable job list is defined in code (<code className="font-mono text-xs bg-amber-100 px-1 rounded">buildTranslations.ts</code> + <code className="font-mono text-xs bg-amber-100 px-1 rounded">build.tsx</code>).
            Approving here generates pre-translated labels and stores them — ready for you to ask Claude Code to add to the live list in a future prompt.
            Think of it as demand-ranked, pre-translated research, not instant publishing.
          </p>
        </div>

        {loadError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            Failed to load: {loadError}
          </div>
        )}

        {rows.length === 0 && !loadError ? (
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-400">
            No pending job title requests.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.id} className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-base truncate">"{row.title}"</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      normalized: <span className="font-mono">{row.normalized_title}</span>
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                      <span>
                        <span className="font-semibold text-primary text-sm">{row.request_count}</span>{" "}
                        {row.request_count === 1 ? "request" : "requests"}
                      </span>
                      <span>First: {fmtDate(row.first_requested_at)}</span>
                      <span>Last: {fmtDate(row.last_requested_at)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={!!busy[row.id]}
                      onClick={() => void handleApprove(row)}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                      {busy[row.id] === "approving" ? "Translating…" : "Approve"}
                    </button>
                    <button
                      type="button"
                      disabled={!!busy[row.id]}
                      onClick={() => void handleReject(row.id)}
                      className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      {busy[row.id] === "rejecting" ? "Rejecting…" : "Reject"}
                    </button>
                  </div>
                </div>
                {actionError[row.id] && (
                  <p className="mt-2 text-xs text-red-600">{actionError[row.id]}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export const Route = createFileRoute("/admin/job-requests")({
  codeSplitGroupings: [],
  component: JobRequestsPage,
});
