import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

function AdminBillingPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate({ to: "/build" }); return; }
    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data: p }) => {
        if (p?.role === "super_admin") {
          setIsSuperAdmin(true);
        } else {
          setIsSuperAdmin(false);
          navigate({ to: "/dashboard" });
        }
      });
  }, [authLoading, user, navigate]);

  if (authLoading || isSuperAdmin === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!isSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-lg font-bold text-gray-900">Billing</h1>
        <p className="text-xs text-gray-500 mt-0.5">Subscription and usage coming soon.</p>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-8 py-16">
          <p className="text-2xl font-bold text-gray-300">Coming soon</p>
          <p className="mt-2 text-sm text-gray-400">
            Billing and subscription management will appear here.
          </p>
        </div>
      </main>
    </div>
  );
}

export const Route = createFileRoute("/admin/billing")({
  codeSplitGroupings: [],
  component: AdminBillingPage,
});
