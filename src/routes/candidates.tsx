import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

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

  // Filters
  const [filterCity, setFilterCity] = useState("");
  const [filterJobType, setFilterJobType] = useState("");
  const [filterRtw, setFilterRtw] = useState("");
  const [filterLang, setFilterLang] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate({ to: "/build" }); return; }
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data?.role !== "admin") { setIsAdmin(false); return; }
      setIsAdmin(true);
      supabase
        .from("candidates")
        .select("id,name,city,right_to_work,language,job_types,skills,availability,cv_english,cv_native,email,phone,opted_in_at,is_active")
        .eq("is_active", true)
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
    if (filterCity && !c.city.toLowerCase().includes(filterCity.toLowerCase())) return false;
    if (filterJobType && !c.job_types.some((j) => j.toLowerCase().includes(filterJobType.toLowerCase()))) return false;
    if (filterRtw && !c.right_to_work.toLowerCase().includes(filterRtw.toLowerCase())) return false;
    if (filterLang && !c.language.toLowerCase().includes(filterLang.toLowerCase())) return false;
    return true;
  });

  const inputCls = "rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Candidate Pool</h1>
          <p className="mt-1 text-sm text-muted-foreground">{filtered.length} active candidate{filtered.length !== 1 ? "s" : ""}</p>
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
        ) : filtered.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">No candidates match your filters.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map((c) => (
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
                __html: cvModal.tab === "english"
                  ? (cvModal.candidate.cv_english?.html ?? "")
                  : (cvModal.candidate.cv_native?.html ?? ""),
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
