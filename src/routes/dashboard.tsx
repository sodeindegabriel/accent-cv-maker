import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { t } from "@/lib/buildTranslations";

interface Profile {
  full_name: string | null;
  preferred_ui_language: string | null;
  default_cv_language: string | null;
}

interface CVDocument {
  id: string;
  title: string;
  status: string;
  created_at: string;
}

function DashboardPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [cvs, setCVs] = useState<CVDocument[]>([]);
  const [downloadCount, setDownloadCount] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const lang = profile?.preferred_ui_language || "en";

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      try { sessionStorage.setItem("cvlingo:redirectAfterAuth", "/dashboard"); } catch { /* ignore */ }
      navigate({ to: "/build" });
    }
  }, [authLoading, user, navigate]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    setError(null);
    try {
      const [profileRes, cvsRes, downloadsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, preferred_ui_language, default_cv_language")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("cv_documents")
          .select("id, title, status, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("downloads")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
      ]);

      if (profileRes.error) {
        console.error("Dashboard: profiles query error:", profileRes.error);
        throw profileRes.error;
      }
      if (cvsRes.error) {
        console.error("Dashboard: cv_documents query error:", cvsRes.error);
        throw cvsRes.error;
      }
      if (downloadsRes.error) {
        console.error("Dashboard: downloads query error:", downloadsRes.error);
      }

      // If no profile row exists yet, create one from auth user_metadata
      let resolvedProfile = profileRes.data;
      if (!resolvedProfile) {
        const metaName = (user.user_metadata as { full_name?: string })?.full_name ?? null;
        const { error: upsertErr } = await supabase
          .from("profiles")
          .upsert({ id: user.id, full_name: metaName });
        if (upsertErr) console.error("Dashboard: profile upsert error:", upsertErr);
        resolvedProfile = { full_name: metaName, preferred_ui_language: null, default_cv_language: null };
      }

      setProfile(resolvedProfile);
      setCVs((cvsRes.data as CVDocument[]) ?? []);
      setDownloadCount(downloadsRes.count ?? 0);
    } catch (err) {
      console.error("Dashboard: load failed:", err);
      setError("error");
    } finally {
      setDataLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (authLoading || (!user && !authLoading)) return null;

  const fullName = profile?.full_name
    ?? (user?.user_metadata as { full_name?: string })?.full_name
    ?? null;
  const firstName = fullName?.split(" ")[0] ?? user?.email ?? "";
  const FREE_LIMIT = 2;

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return iso;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">{t(lang, "dashboardTitle")}</h1>
        <button
          onClick={() => signOut().then(() => navigate({ to: "/" }))}
          className="text-sm text-gray-600 hover:text-gray-900 underline"
        >
          {t(lang, "dashboardLogout")}
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Welcome */}
        <p className="text-gray-700 text-lg">
          {t(lang, "dashboardWelcome", { name: firstName })}
        </p>

        {dataLoading ? (
          <p className="text-gray-500">{t(lang, "dashboardLoading")}</p>
        ) : error ? (
          <div className="bg-white rounded-lg border border-red-200 p-6 text-center space-y-3">
            <p className="text-red-600">{t(lang, "dashboardError")}</p>
            <button
              onClick={() => loadData()}
              className="text-sm text-primary hover:underline font-medium"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Build new CV */}
            <div>
              <button
                onClick={() => navigate({ to: "/build" })}
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-5 py-3 rounded-lg transition-colors"
              >
                + {t(lang, "dashboardNewCV")}
              </button>
            </div>

            {/* My CVs */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">{t(lang, "dashboardMyCVs")}</h2>
              {cvs.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
                  <p className="text-gray-500 mb-4">{t(lang, "dashboardNoCVsMsg")}</p>
                  <button
                    onClick={() => navigate({ to: "/build" })}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    {t(lang, "dashboardBuildFirst")}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {cvs.map((cv) => (
                    <CVCard key={cv.id} cv={cv} lang={lang} formatDate={formatDate} />
                  ))}
                </div>
              )}
            </section>

            {/* Usage */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">{t(lang, "dashboardUsageTitle")}</h2>
              <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                <UsageTile
                  label={t(lang, "dashboardDownloadsUsed", { used: String(downloadCount), limit: String(FREE_LIMIT) })}
                  used={downloadCount}
                  limit={FREE_LIMIT}
                />
                <UsageTile
                  label={t(lang, "dashboardEditsUsed", { used: "0", limit: String(FREE_LIMIT) })}
                  used={0}
                  limit={FREE_LIMIT}
                />
              </div>
            </section>

            {/* Profile */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">{t(lang, "dashboardProfileTitle")}</h2>
              <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
                <ProfileRow label={t(lang, "dashboardProfileName")} value={profile?.full_name ?? "—"} />
                <ProfileRow label={t(lang, "dashboardProfileEmail")} value={user?.email ?? "—"} />
                <ProfileRow label={t(lang, "dashboardProfileUILang")} value={profile?.preferred_ui_language ?? "en"} />
                <ProfileRow label={t(lang, "dashboardProfileCVLang")} value={profile?.default_cv_language ?? "—"} />
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function CVCard({
  cv,
  lang,
  formatDate,
}: {
  cv: CVDocument;
  lang: string;
  formatDate: (iso: string) => string;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium text-gray-900 truncate">{cv.title || "CV"}</p>
          <p className="text-sm text-gray-500 mt-0.5">{t(lang, "dashboardCVCreated", { date: formatDate(cv.created_at) })}</p>
          <span className="inline-block mt-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
            {t(lang, "dashboardStatusDraft")}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={`/result?cv=${cv.id}`}
            className="text-sm text-primary hover:underline"
          >
            {t(lang, "dashboardView")}
          </a>
          <a
            href={`/result?cv=${cv.id}&download=1`}
            className="text-sm text-primary hover:underline"
          >
            {t(lang, "dashboardDownload")}
          </a>
          <span
            className="text-sm text-gray-400 cursor-not-allowed"
            title={t(lang, "dashboardEditSoon")}
          >
            {t(lang, "dashboardEdit")}
          </span>
        </div>
      </div>
    </div>
  );
}

function UsageTile({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  return (
    <div>
      <p className="text-sm text-gray-700 mb-1">{label}</p>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${pct >= 100 ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3 flex gap-4">
      <span className="text-sm text-gray-500 w-36 shrink-0">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
}

export const Route = createFileRoute("/dashboard")({
  codeSplitGroupings: [],
  component: DashboardPage,
});
