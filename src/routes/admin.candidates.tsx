import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

type Candidate = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  city: string;
  postcode: string | null;
  right_to_work: string;
  language: string;
  job_types: string[];
  skills: string[];
  availability: string[];
  referral_source: string | null;
  opted_in_at: string;
  is_active: boolean;
};

function toCSV(rows: Candidate[]): string {
  const headers = ["opted_in_at", "name", "email", "phone", "city", "postcode", "right_to_work", "language", "job_types", "skills", "availability", "referral_source", "is_active"];
  const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const data = rows.map((r) =>
    [
      r.opted_in_at,
      r.name,
      r.email,
      r.phone ?? "",
      r.city,
      r.postcode ?? "",
      r.right_to_work,
      r.language,
      r.job_types.join("; "),
      r.skills.join("; "),
      r.availability.join("; "),
      r.referral_source ?? "",
      r.is_active ? "yes" : "no",
    ].map((v) => esc(String(v))).join(",")
  );
  return [headers.join(","), ...data].join("\n");
}

function AdminCandidatesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  // Filters
  const [filterSearch, setFilterSearch] = useState("");
  const [filterJobType, setFilterJobType] = useState("");
  const [filterLang, setFilterLang] = useState("");
  const [filterRtw, setFilterRtw] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate({ to: "/build" }); return; }
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data?.role !== "admin") { setIsAdmin(false); return; }
      setIsAdmin(true);
      supabase
        .from("candidates")
        .select("id,name,email,phone,city,postcode,right_to_work,language,job_types,skills,availability,referral_source,opted_in_at,is_active")
        .order("opted_in_at", { ascending: false })
        .then(({ data: rows }) => {
          setCandidates((rows ?? []) as Candidate[]);
          setLoading(false);
        });
    });
  }, [authLoading, user, navigate]);

  if (authLoading || isAdmin === null) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (isAdmin === false) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Access denied.</div>;

  const filtered = candidates.filter((c) => {
    if (!showInactive && !c.is_active) return false;
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !c.email.toLowerCase().includes(q) && !c.city.toLowerCase().includes(q)) return false;
    }
    if (filterJobType && !c.job_types.some((j) => j.toLowerCase().includes(filterJobType.toLowerCase()))) return false;
    if (filterLang && !c.language.toLowerCase().includes(filterLang.toLowerCase())) return false;
    if (filterRtw && !c.right_to_work.toLowerCase().includes(filterRtw.toLowerCase())) return false;
    return true;
  });

  function downloadCSV() {
    const csv = toCSV(filtered);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cvlingo-candidates-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from("candidates").update({ is_active: !current }).eq("id", id);
    setCandidates((prev) => prev.map((c) => c.id === id ? { ...c, is_active: !current } : c));
  }

  const inputCls = "rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary";

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Candidates — Admin</h1>
            <p className="mt-1 text-sm text-muted-foreground">{filtered.length} of {candidates.length} total</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={downloadCSV}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Export CSV
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-3">
          <input className={inputCls} placeholder="Search name / email / city…" value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} />
          <input className={inputCls} placeholder="Job type…" value={filterJobType} onChange={(e) => setFilterJobType(e.target.value)} />
          <input className={inputCls} placeholder="Language…" value={filterLang} onChange={(e) => setFilterLang(e.target.value)} />
          <input className={inputCls} placeholder="Right to work…" value={filterRtw} onChange={(e) => setFilterRtw(e.target.value)} />
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded" />
            Show removed
          </label>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">No candidates found.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Phone</th>
                  <th className="px-3 py-2">City</th>
                  <th className="px-3 py-2">RTW</th>
                  <th className="px-3 py-2">Language</th>
                  <th className="px-3 py-2">Job Types</th>
                  <th className="px-3 py-2">Skills</th>
                  <th className="px-3 py-2">Referral</th>
                  <th className="px-3 py-2">Active</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className={`border-t border-border ${!c.is_active ? "opacity-50" : ""}`}>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{new Date(c.opted_in_at).toLocaleDateString()}</td>
                    <td className="px-3 py-2 font-medium">{c.name}</td>
                    <td className="px-3 py-2">{c.email}</td>
                    <td className="px-3 py-2">{c.phone ?? "—"}</td>
                    <td className="px-3 py-2">{c.city}{c.postcode ? `, ${c.postcode}` : ""}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{c.right_to_work}</td>
                    <td className="px-3 py-2">{c.language}</td>
                    <td className="px-3 py-2">{c.job_types.join(", ")}</td>
                    <td className="px-3 py-2 max-w-[180px] truncate">{c.skills.join(", ")}</td>
                    <td className="px-3 py-2">{c.referral_source ?? "—"}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => toggleActive(c.id, c.is_active)}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${c.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}
                      >
                        {c.is_active ? "Active" : "Removed"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

export const Route = createFileRoute("/admin/candidates")({
  component: AdminCandidatesPage,
  head: () => ({
    meta: [
      { title: "Candidates Admin — CVLingo" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
