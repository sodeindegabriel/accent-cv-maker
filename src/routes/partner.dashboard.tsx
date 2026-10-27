import { createFileRoute } from "@tanstack/react-router";
import { usePartner } from "@/context/PartnerContext";
import type { ManagerDashData, MentorDashData } from "@/context/PartnerContext";
import {
  StatCard,
  BreakdownBar,
  ReferralLinkCard,
  downloadImpactReport,
} from "@/components/partner-shared";

export const Route = createFileRoute("/partner/dashboard")({
  codeSplitGroupings: [],
  component: OverviewScreen,
});

function OverviewScreen() {
  const { roleInfo, dashData, loading } = usePartner();

  if (loading || !roleInfo || !dashData) return null;

  const referralUrl = `https://cvlingo.com/?ref=${dashData.referral_code}`;

  if (!roleInfo.is_manager) {
    return <MentorOverview dashData={dashData as MentorDashData} referralUrl={referralUrl} />;
  }
  return <ManagerOverview dashData={dashData as ManagerDashData} referralUrl={referralUrl} />;
}

function ManagerOverview({ dashData, referralUrl }: { dashData: ManagerDashData; referralUrl: string }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Overview</h1>

      <ReferralLinkCard referralUrl={referralUrl} partnerName={dashData.partner_name} />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="CVs this month" value={dashData.month_cvs} />
        <StatCard label="Active this month" value={dashData.active_this_month ?? 0} />
        <StatCard label="Total CVs built" value={dashData.total_cvs} />
        <StatCard label="Candidates" value={dashData.total_candidates} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <BreakdownBar label="Languages" items={dashData.lang_breakdown} />
        <BreakdownBar label="Job types" items={dashData.job_breakdown} />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => downloadImpactReport(dashData)}
          className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors min-h-[44px]"
        >
          Download impact report (PDF)
        </button>
      </div>
    </div>
  );
}

function MentorOverview({ dashData, referralUrl }: { dashData: MentorDashData; referralUrl: string }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Overview</h1>

      <ReferralLinkCard referralUrl={referralUrl} partnerName={dashData.partner_name} />

      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Clients assigned to me" value={dashData.my_assigned} />
        <StatCard label="Cases closed" value={dashData.my_closed} />
      </div>
    </div>
  );
}
