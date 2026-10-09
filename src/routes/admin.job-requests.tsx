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

const ALL_LANGUAGES = [
  "English", "Polish", "Romanian", "Bulgarian", "Latvian", "Lithuanian",
  "Slovak", "Czech", "Hungarian", "Punjabi", "Urdu", "Hindi", "Arabic",
  "Portuguese", "Spanish", "French", "Italian", "Ukrainian", "Russian",
  "Kurdish", "Farsi",
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ── Approved row component ────────────────────────────────────────────────────
function ApprovedRow({
  row,
  onUnpublish,
}: {
  row: JobTitleRequest;
  onUnpublish: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [edited, setEdited] = useState<Record<string, string>>(row.translations ?? {});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [unpublishError, setUnpublishError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    try {
      const { error } = await supabase
        .from("job_title_requests")
        .update({ translations: edited })
        .eq("id", row.id);
      if (error) throw new Error(error.message);
      setSaveOk(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  async function handleUnpublish() {
    setUnpublishing(true);
    setUnpublishError(null);
    try {
      const { error } = await supabase
        .from("job_title_requests")
        .update({ status: "pending" })
        .eq("id", row.id);
      if (error) throw new Error(error.message);
      onUnpublish(row.id);
    } catch (e) {
      setUnpublishError(e instanceof Error ? e.message : "Unknown error");
      setUnpublishing(false);
    }
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 text-base truncate">"{row.title}"</p>
          <p className="text-xs text-gray-400 mt-0.5">
            normalized: <span className="font-mono">{row.normalized_title}</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
            <span>
              <span className="font-semibold text-emerald-600 text-sm">{row.request_count}</span>{" "}
              {row.request_count === 1 ? "request" : "requests"}
            </span>
            <span>First: {fmtDate(row.first_requested_at)}</span>
            <span>Last: {fmtDate(row.last_requested_at)}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 items-end">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {expanded ? "Hide translations" : "Edit translations"}
          </button>
          <button
            type="button"
            disabled={unpublishing}
            onClick={() => void handleUnpublish()}
            className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50 transition-colors"
          >
            {unpublishing ? "Unpublishing…" : "Unpublish"}
          </button>
        </div>
      </div>

      {unpublishError && (
        <p className="mt-2 text-xs text-red-600">{unpublishError}</p>
      )}

      {expanded && (
        <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
          {ALL_LANGUAGES.map((lang) => (
            <div key={lang} className="flex items-center gap-3">
              <label className="w-28 shrink-0 text-xs font-medium text-gray-600">{lang}</label>
              <input
                type="text"
                value={edited[lang] ?? ""}
                onChange={(e) => setEdited((prev) => ({ ...prev, [lang]: e.target.value }))}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder={`${lang} translation…`}
              />
            </div>
          ))}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : "Save translations"}
            </button>
            {saveOk && <span className="text-xs text-emerald-600">Saved!</span>}
            {saveError && <span className="text-xs text-red-600">{saveError}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
function JobRequestsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [pendingRows, setPendingRows] = useState<JobTitleRequest[]>([]);
  const [approvedRows, setApprovedRows] = useState<JobTitleRequest[]>([]);
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
        if (p?.role === "admin" || p?.role === "super_admin") {
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
      .in("status", ["pending", "approved"])
      .order("status", { ascending: true })   // "approved" < "pending" alphabetically
      .order("request_count", { ascending: false })
      .then(({ data, error }) => {
        if (error) { setLoadError(error.message); return; }
        const all = (data as JobTitleRequest[]) ?? [];
        setPendingRows(all.filter((r) => r.status === "pending"));
        setApprovedRows(all.filter((r) => r.status === "approved"));
      });
  }, [isAdmin]);

  async function handleApprove(row: JobTitleRequest) {
    setBusy((b) => ({ ...b, [row.id]: "approving" }));
    setActionError((e) => ({ ...e, [row.id]: "" }));
    try {
      const translations = await generateJobTranslationsServer({ data: { title: row.title } });
      const { error } = await supabase
        .from("job_title_requests")
        .update({ status: "approved", translations })
        .eq("id", row.id);
      if (error) throw new Error(error.message);
      // Move from pending to approved in local state
      const approvedRow: JobTitleRequest = { ...row, status: "approved", translations };
      setPendingRows((r) => r.filter((x) => x.id !== row.id));
      setApprovedRows((r) => [approvedRow, ...r]);
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
      setPendingRows((r) => r.filter((x) => x.id !== id));
    } catch (e) {
      setActionError((err) => ({ ...err, [id]: e instanceof Error ? e.message : "Unknown error" }));
    } finally {
      setBusy((b) => { const n = { ...b }; delete n[id]; return n; });
    }
  }

  function handleUnpublish(id: string) {
    const row = approvedRows.find((r) => r.id === id);
    if (!row) return;
    setApprovedRows((r) => r.filter((x) => x.id !== id));
    setPendingRows((r) => [{ ...row, status: "pending" }, ...r]);
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
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
          <p className="font-semibold mb-1">Approved titles appear in the job type selector immediately</p>
          <p>Users will see them on their next page load.</p>
        </div>

        {loadError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            Failed to load: {loadError}
          </div>
        )}

        {/* ── Pending section ── */}
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Pending ({pendingRows.length})
        </h2>
        {pendingRows.length === 0 && !loadError ? (
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-400 mb-8">
            No pending job title requests.
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {pendingRows.map((row) => (
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

        {/* ── Approved section ── */}
        {approvedRows.length > 0 && (
          <>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Approved &amp; Live ({approvedRows.length})
            </h2>
            <div className="space-y-3">
              {approvedRows.map((row) => (
                <ApprovedRow key={row.id} row={row} onUnpublish={handleUnpublish} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export const Route = createFileRoute("/admin/job-requests")({
  codeSplitGroupings: [],
  component: JobRequestsPage,
});
