import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { sanitizeCvHtml } from "@/lib/sanitize";

const PAGE_SIZE = 10;

type Candidate = {
  id: string;
  name: string;
  city: string;
  right_to_work: string;
  language: string;
  job_types: string[];
  skills: string[];
  availability: string[];
  cv_english: { html: string } | null;
  cv_native: { html: string } | null;
  email: string;
  phone: string | null;
  opted_in_at: string;
  is_active: boolean;
};

function maskName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "—";
  const first = parts[0];
  const last = parts[parts.length - 1];
  if (parts.length === 1) return first;
  return `${first} ${last.charAt(0)}.`;
}

function CandidatesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactReveal, setContactReveal] = useState<Record<string, boolean>>({});
  const [cvModal, setCvModal] = useState<{ candidate: Candidate; tab: "english" | "native" } | null>(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  // Filters
  const [filterCity, setFilterCity] = useState("");
  const [filterJobType, setFilterJobType] = useState("");
  const [filterRtw, setFilterRtw] = useState("");
  const [filterLang, setFilterLang] = useState("");

  // Reset page on any filter change
  useEffect(() => { setPage(0); }, [filterCity, filterJobType, filterRtw, filterLang]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate({ to: "/build" }); return; }
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data?.role !== "admin") { setIsAdmin(false); return; }
      setIsAdmin(true);
    });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (isAdmin !== true) return;
    setLoading(true);
    let query = supabase
      .from("candidates")
      .select("id,name,city,right_to_work,language,job_types,skills,availability,cv_english,cv_native,email,phone,opted_in_at,is_active", { count: "exact" })
      .eq("is_active", true)
      .order("opted_in_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (filterCity.trim()) query = query.ilike("city", `%${filterCity.trim()}%`);
    if (filterLang.trim()) query = query.ilike("language", `%${filterLang.trim()}%`);
    if (filterRtw.trim()) query = query.ilike("right_to_work", `%${filterRtw.trim()}%`);
    if (filterJobType.trim()) query = query.filter("job_types", "cs", JSON.stringify([filterJobType.trim()]));

    query.then(({ data: rows, count }) => {
      setCandidates((rows ?? []) as Candidate[]);
      setTotal(count ?? 0);
      setLoading(false);
    });
  }, [isAdmin, page, filterCity, filterLang, filterRtw, filterJobType]);

  if (authLoading || isAdmin === null) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (isAdmin === false) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Access denied.</div>;

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min((page + 1) * PAGE_SIZE, total);

  const inputCls = "rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Candidate Pool</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total === 0 ? "No active candidates" : `Showing ${from}–${to} of ${total} active candidate${total !== 1 ? "s" : ""}`}
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-3">
          <input className={inputCls} placeholder="Filter by city…" value={filterCity} onChange={(e) => setFilterCity(e.target.value)} />
          <input className={inputCls} placeholder="Filter by job type…" value={filterJobType} onChange={(e) => setFilterJobType(e.target.value)} />
          <input className={inputCls} placeholder="Filter by right to work…" value={filterRtw} onChange={(e) => setFilterRtw(e.target.value)} />
          <input className={inputCls} placeholder="Filter by language…" value={filterLang} onChange={(e) => setFilterLang(e.target.value)} />
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading candidates…</p>
        ) : candidates.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">No candidates match your filters.</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {candidates.map((c) => (
                <div key={c.id} className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground">{maskName(c.name)}</p>
                      <p className="text-xs text-muted-foreground">{c.city} · {c.language}</p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{c.right_to_work}</span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.job_types.map((jt) => (
                      <span key={jt} className="rounded-lg bg-muted px-2 py-0.5 text-xs text-foreground">{jt}</span>
                    ))}
                  </div>

                  {c.skills.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {c.skills.slice(0, 4).map((sk) => (
                        <span key={sk} className="rounded-lg border border-border px-2 py-0.5 text-xs text-muted-foreground">{sk}</span>
                      ))}
                      {c.skills.length > 4 && <span className="text-xs text-muted-foreground">+{c.skills.length - 4} more</span>}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {(c.cv_english || c.cv_native) && (
                      <button
                        type="button"
                        onClick={() => setCvModal({ candidate: c, tab: c.cv_english ? "english" : "native" })}
                        className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                      >
                        View CV
                      </button>
                    )}
                    {contactReveal[c.id] ? (
                      <div className="text-sm text-foreground">
                        <p>{c.email}</p>
                        {c.phone && <p className="text-muted-foreground">{c.phone}</p>}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setContactReveal((prev) => ({ ...prev, [c.id]: true }))}
                        className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
                      >
                        Contact
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Showing {from}–{to} of {total}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="min-h-[44px] rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40 transition-colors"
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i).filter((i) => {
                    return i === 0 || i === totalPages - 1 || Math.abs(i - page) <= 1;
                  }).reduce<(number | "...")[]>((acc, i, idx, arr) => {
                    if (idx > 0 && typeof arr[idx - 1] === "number" && (i as number) - (arr[idx - 1] as number) > 1) {
                      acc.push("...");
                    }
                    acc.push(i);
                    return acc;
                  }, []).map((item, idx) =>
                    item === "..." ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">…</span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setPage(item as number)}
                        className={`min-h-[44px] min-w-[44px] rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                          page === item
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-foreground hover:bg-muted"
                        }`}
                      >
                        {(item as number) + 1}
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="min-h-[44px] rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* CV Modal */}
      {cvModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-10">
          <div className="relative w-full max-w-3xl rounded-2xl border border-border bg-card shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-3">
              <div className="flex gap-2">
                {cvModal.candidate.cv_english && (
                  <button
                    type="button"
                    onClick={() => setCvModal((m) => m ? { ...m, tab: "english" } : m)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium ${cvModal.tab === "english" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
                  >
                    English
                  </button>
                )}
                {cvModal.candidate.cv_native && (
                  <button
                    type="button"
                    onClick={() => setCvModal((m) => m ? { ...m, tab: "native" } : m)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium ${cvModal.tab === "native" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
                  >
                    {cvModal.candidate.language}
                  </button>
                )}
              </div>
              <button type="button" onClick={() => setCvModal(null)} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">Close</button>
            </div>
            <div
              className="p-5"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{
                __html: sanitizeCvHtml(
                  cvModal.tab === "english"
                    ? (cvModal.candidate.cv_english?.html ?? "")
                    : (cvModal.candidate.cv_native?.html ?? "")
                ),
              }}
            />
          </div>
        </div>
      )}
    </main>
  );
}

export const Route = createFileRoute("/candidates")({
  component: CandidatesPage,
  head: () => ({
    meta: [
      { title: "Candidate Pool — CVLingo" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
