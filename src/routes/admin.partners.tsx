import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Partner {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  referral_code: string;
  is_active: boolean;
  created_at: string;
  referral_count?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Main component ─────────────────────────────────────────────────────────────
function AdminPartnersPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Create form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Toggle busy state per partner id
  const [toggling, setToggling] = useState<Record<string, boolean>>({});

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
        if (p?.role === "admin") {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
          navigate({ to: "/dashboard" });
        }
      });
  }, [authLoading, user, navigate]);

  // ── Load partners + referral counts ─────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin) return;
    void loadPartners();
  }, [isAdmin]);

  async function loadPartners() {
    setLoadError(null);
    const [{ data: rows, error }, referralCounts] = await Promise.all([
      supabase.from("partners").select("*").order("created_at", { ascending: false }),
      supabase
        .from("partner_referrals")
        .select("referral_code")
        .then(({ data }) => {
          const map: Record<string, number> = {};
          for (const r of data ?? []) {
            map[r.referral_code] = (map[r.referral_code] ?? 0) + 1;
          }
          return map;
        }),
    ]);
    if (error) { setLoadError(error.message); return; }
    const merged = (rows ?? []).map((p) => ({
      ...(p as Partner),
      referral_count: referralCounts[p.referral_code] ?? 0,
    }));
    setPartners(merged);
  }

  // ── Create partner ───────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    if (!name.trim() || !email.trim() || !referralCode.trim()) {
      setCreateError("All fields are required.");
      return;
    }
    const code = referralCode.trim().toLowerCase().replace(/\s+/g, "-");
    setCreating(true);
    const { error } = await supabase
      .from("partners")
      .insert({ name: name.trim(), email: email.trim().toLowerCase(), referral_code: code });
    setCreating(false);
    if (error) {
      setCreateError(
        error.message.includes("duplicate") || error.message.includes("unique")
          ? "That email or referral code is already in use."
          : error.message,
      );
      return;
    }
    setName("");
    setEmail("");
    setReferralCode("");
    void loadPartners();
  }

  // ── Toggle active ────────────────────────────────────────────────────────────
  async function handleToggleActive(p: Partner) {
    setToggling((t) => ({ ...t, [p.id]: true }));
    await supabase.from("partners").update({ is_active: !p.is_active }).eq("id", p.id);
    setPartners((prev) =>
      prev.map((r) => (r.id === p.id ? { ...r, is_active: !p.is_active } : r)),
    );
    setToggling((t) => { const n = { ...t }; delete n[p.id]; return n; });
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

  const inputCls =
    "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/admin" className="text-sm text-gray-500 hover:underline">← Admin</a>
          <span className="text-gray-300">/</span>
          <h1 className="text-lg font-bold text-gray-900">Partners</h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
        {/* Create form */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Add new partner</h2>
          <form onSubmit={(e) => void handleCreate(e)} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Organisation name</label>
                <input
                  className={inputCls}
                  placeholder="Wiltshire Refugee Network"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Login email</label>
                <input
                  className={inputCls}
                  type="email"
                  placeholder="partner@example.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Referral code</label>
                <input
                  className={inputCls}
                  placeholder="wiltshire"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                />
                <p className="mt-0.5 text-xs text-gray-400">Lowercase, no spaces (hyphens ok). Becomes ?ref=code in URL.</p>
              </div>
            </div>
            {createError && (
              <p className="text-sm text-red-600">{createError}</p>
            )}
            <button
              type="submit"
              disabled={creating}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {creating ? "Creating…" : "Create partner"}
            </button>
          </form>
        </div>

        {/* Partners table */}
        {loadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            Failed to load: {loadError}
          </div>
        )}

        {partners.length === 0 && !loadError ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-400">
            No partners yet. Create one above.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Organisation</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Referral code</th>
                  <th className="px-4 py-3">Referred users</th>
                  <th className="px-4 py-3">Claimed</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((p) => (
                  <tr
                    key={p.id}
                    className={`border-t border-gray-100 ${!p.is_active ? "opacity-50" : ""}`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3 text-gray-600">{p.email}</td>
                    <td className="px-4 py-3">
                      <code className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                        {p.referral_code}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-gray-900">
                      {p.referral_count ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      {p.user_id ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Yes
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-400">
                      {fmtDate(p.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={!!toggling[p.id]}
                        onClick={() => void handleToggleActive(p)}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                          p.is_active
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {toggling[p.id] ? "…" : p.is_active ? "Active" : "Inactive"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

export const Route = createFileRoute("/admin/partners")({
  codeSplitGroupings: [],
  component: AdminPartnersPage,
});
