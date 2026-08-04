import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────
interface ProfileRow {
  id: string;
  created_at: string;
  preferred_ui_language: string | null;
  role: string | null;
}
interface CVDocRow {
  id: string;
  title: string;
  created_at: string;
}
interface FeedbackRow {
  id: string;
  user_id: string | null;
  rating: number | null;
  comment: string | null;
  job_outcome: string | null;
  created_at: string;
}
interface ReferralRow {
  id: string;
  referral_code: string;
  created_at: string;
}
interface DownloadRow {
  language: string | null;
}
interface AdminData {
  profiles: ProfileRow[];
  cvDocs: CVDocRow[];
  downloadCount: number;
  downloads: DownloadRow[];
  feedback: FeedbackRow[];
  referrals: ReferralRow[];
  candidateCount: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function groupBy<T>(arr: T[], key: (row: T) => string): Record<string, number> {
  return arr.reduce(
    (acc, row) => {
      const k = key(row) || "Unknown";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
}

function toBarData(counts: Record<string, number>, limit = 20) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

function parseJobType(title: string): string {
  const parts = title.split(" — ");
  return parts.length > 1 ? parts[parts.length - 1].trim() : "Unknown";
}

function MetricCard({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const inner = (
    <div className="rounded-xl bg-white border border-gray-200 p-5 h-full">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
  if (href) {
    return (
      <a href={href} className="block hover:opacity-80 transition-opacity">
        {inner}
      </a>
    );
  }
  return inner;
}

// ── Main component ─────────────────────────────────────────────────────────
interface PendingJobRequest { title: string; request_count: number; }

function AdminIndexPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [data, setData] = useState<AdminData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingJobRequests, setPendingJobRequests] = useState<{ count: number; top: PendingJobRequest | null }>({ count: 0, top: null });

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
      .select("title, request_count")
      .eq("status", "pending")
      .order("request_count", { ascending: false })
      .then(({ data: rows }) => {
        if (!rows || rows.length === 0) return;
        const typed = rows as PendingJobRequest[];
        setPendingJobRequests({ count: typed.length, top: typed[0] });
      });
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    async function load() {
      try {
        const [profilesRes, cvsRes, dlRes, feedbackRes, referralsRes, candidatesRes] =
          await Promise.all([
            supabase.from("profiles").select("id, created_at, preferred_ui_language, role").order("created_at"),
            supabase.from("cv_documents").select("id, title, created_at").order("created_at"),
            supabase.from("downloads").select("language"),
            supabase.from("feedback").select("id, user_id, rating, comment, job_outcome, created_at").order("created_at", { ascending: false }),
            supabase.from("partner_referrals").select("id, referral_code, created_at").order("created_at"),
            supabase.from("candidates").select("id", { count: "exact", head: true }).eq("is_active", true),
          ]);

        if (profilesRes.error) throw profilesRes.error;
        if (cvsRes.error) throw cvsRes.error;

        setData({
          profiles: (profilesRes.data as ProfileRow[]) ?? [],
          cvDocs: (cvsRes.data as CVDocRow[]) ?? [],
          downloadCount: (dlRes.data as DownloadRow[])?.length ?? 0,
          downloads: (dlRes.data as DownloadRow[]) ?? [],
          feedback: (feedbackRes.data as FeedbackRow[]) ?? [],
          referrals: (referralsRes.data as ReferralRow[]) ?? [],
          candidateCount: candidatesRes.count ?? 0,
        });
      } catch (err) {
        console.error("Admin load error:", err);
        setLoadError("Failed to load data. Check RLS policies and run the migration.");
      }
    }
    load();
  }, [isAdmin]);

  if (authLoading || isAdmin === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAdmin) return null;

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-xl border border-red-200 p-6 max-w-md text-center">
          <p className="text-red-700 font-medium">Admin data error</p>
          <p className="text-sm text-gray-600 mt-2">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const avgRating = (() => {
    const rated = data.feedback.filter((f) => f.rating !== null);
    if (!rated.length) return "—";
    const avg = rated.reduce((s, f) => s + (f.rating ?? 0), 0) / rated.length;
    return avg.toFixed(1) + " / 5";
  })();

  const signupsByDay = (() => {
    const counts = groupBy(data.profiles, (p) => p.created_at.slice(0, 10));
    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));
  })();

  const langData = toBarData(groupBy(data.profiles, (p) => p.preferred_ui_language || "en"));
  const downloadLangData = toBarData(groupBy(data.downloads, (d) => d.language || "unknown"));
  const jobTypeData = toBarData(groupBy(data.cvDocs, (cv) => parseJobType(cv.title)));
  const referralData = toBarData(groupBy(data.referrals, (r) => r.referral_code));

  const profileMap = data.profiles.reduce(
    (acc, p) => { acc[p.id] = p; return acc; },
    {} as Record<string, ProfileRow>,
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">CVLingo Admin</h1>
        <div className="flex items-center gap-4">
          <a href="/admin/candidates" className="text-sm text-primary hover:underline">Candidates ↗</a>
          <a href="/admin/partners" className="text-sm text-primary hover:underline">Partners ↗</a>
          <a href="/admin/job-requests" className="text-sm text-primary hover:underline">Job Requests ↗</a>
          <a href="/dashboard" className="text-sm text-gray-500 hover:underline">← Dashboard</a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">

        {/* 0. Pending job-title requests nudge — only shown when there are pending items */}
        {pendingJobRequests.count > 0 && (
          <a href="/admin/job-requests" className="block group">
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 flex items-center justify-between gap-4 hover:bg-amber-100 transition-colors">
              <div>
                <p className="font-semibold text-amber-900 text-sm">
                  {pendingJobRequests.count} pending job title {pendingJobRequests.count === 1 ? "request" : "requests"}
                  {pendingJobRequests.top && (
                    <> — most requested: "{pendingJobRequests.top.title}" ({pendingJobRequests.top.request_count}×)</>
                  )}
                </p>
                <p className="text-xs text-amber-700 mt-0.5">Click to review, approve &amp; generate translations →</p>
              </div>
              <span className="shrink-0 text-amber-600 group-hover:translate-x-0.5 transition-transform text-lg">→</span>
            </div>
          </a>
        )}

        {/* 1. Top-line metrics */}
        <section>
          <h2 className="text-base font-semibold text-gray-500 uppercase tracking-wide mb-4">Overview</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MetricCard label="Total signups" value={data.profiles.length} />
            <MetricCard label="CVs built" value={data.cvDocs.length} />
            <MetricCard label="Downloads" value={data.downloadCount} />
            <MetricCard label="Avg rating" value={avgRating} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MetricCard label="Candidates opted in" value={data.candidateCount} href="/admin/candidates" />
          </div>
        </section>

        {/* 2. Signups over time */}
        <section>
          <h2 className="text-base font-semibold text-gray-500 uppercase tracking-wide mb-4">Signups over time</h2>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            {signupsByDay.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No signup data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={signupsByDay} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={(v: number) => [v, "Signups"]} labelFormatter={(l: string) => `Date: ${l}`} />
                  <Line type="monotone" dataKey="count" stroke="#0D6E6E" strokeWidth={2} dot={signupsByDay.length < 30} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* 3. Language breakdown */}
        <section>
          <h2 className="text-base font-semibold text-gray-500 uppercase tracking-wide mb-4">Language breakdown (UI language)</h2>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            {langData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={langData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={(v: number) => [v, "Users"]} />
                  <Bar dataKey="count" fill="#0D6E6E" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* 4. Downloads by language */}
        <section>
          <h2 className="text-base font-semibold text-gray-500 uppercase tracking-wide mb-4">Downloads by language</h2>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            {downloadLangData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No downloads yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={downloadLangData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={(v: number) => [v, "Downloads"]} />
                  <Bar dataKey="count" fill="#0D6E6E" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* 5. Job/role type breakdown */}
        <section>
          <h2 className="text-base font-semibold text-gray-500 uppercase tracking-wide mb-4">Job type breakdown (from CV titles)</h2>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            {jobTypeData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No CVs built yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={jobTypeData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={(v: number) => [v, "CVs"]} />
                  <Bar dataKey="count" fill="#0D6E6E" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* 6. Referral/partner performance */}
        <section>
          <h2 className="text-base font-semibold text-gray-500 uppercase tracking-wide mb-4">Partner referrals</h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {referralData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No referrals yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Partner code</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Signups</th>
                  </tr>
                </thead>
                <tbody>
                  {referralData.map((r) => (
                    <tr key={r.name} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* 7. Feedback list */}
        <section>
          <h2 className="text-base font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Feedback ({data.feedback.length})
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {data.feedback.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No feedback yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Rating</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Comment</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Got job?</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">User</th>
                  </tr>
                </thead>
                <tbody>
                  {data.feedback.map((f) => {
                    const profile = f.user_id ? profileMap[f.user_id] : null;
                    return (
                      <tr key={f.id} className="border-b border-gray-50 last:border-0 align-top">
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{f.created_at.slice(0, 10)}</td>
                        <td className="px-4 py-3 text-yellow-500">
                          {f.rating ? "★".repeat(f.rating) + "☆".repeat(5 - f.rating) : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-700 max-w-xs">{f.comment || <span className="text-gray-400">—</span>}</td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          {f.job_outcome === "yes" ? "✅ Yes" : f.job_outcome === "no" ? "❌ No" : f.job_outcome === "not_yet" ? "⏳ Not yet" : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {profile?.preferred_ui_language ?? (f.user_id ? f.user_id.slice(0, 8) + "…" : "anon")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}

export const Route = createFileRoute("/admin/")({
  codeSplitGroupings: [],
  component: AdminIndexPage,
});
